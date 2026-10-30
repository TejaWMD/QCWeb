import React, { useRef, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { actingUserName } from "@/lib/permissions";
import { parseCsv, coerceValue } from "@/lib/csv";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import FieldMappingList from "@/components/import/FieldMappingList";
import { Upload, FileText, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";

const CHUNK_SIZE = 100;
const norm = (s) => (s || "").toLowerCase().replace(/[^a-z0-9]/g, "");

// Builds the import payload: only mapped fields with a value are sent, so
// entity defaults apply to the rest. Rows that fail coercion or miss required
// fields are reported instead of imported.
function buildRecords({ fields, required, headers, rows, mapping }) {
  const labelOf = (key) => fields.find((f) => f.key === key)?.key || key;
  const records = [];
  const errors = [];
  rows.forEach((row, idx) => {
    const rec = {};
    let rowError = null;
    for (const f of fields) {
      const col = mapping[f.key];
      if (!col) continue;
      const raw = row[headers.indexOf(col)];
      if (raw === undefined || raw === "") continue;
      const coerced = coerceValue(f, raw);
      if (coerced.skip) continue;
      if (coerced.error) { rowError = `${f.key}: ${coerced.error}`; break; }
      rec[f.key] = coerced.value;
    }
    if (rowError) { errors.push({ row: idx + 2, error: rowError }); return; }
    const missing = required.filter((k) => rec[k] === undefined || rec[k] === "");
    if (missing.length) { errors.push({ row: idx + 2, error: `Missing required field(s): ${missing.map(labelOf).join(", ")}` }); return; }
    records.push(rec);
  });
  return { records, errors };
}

function ResultBanner({ result, label }) {
  const ok = result.created > 0 && result.rowErrors.length === 0;
  const shown = result.rowErrors.slice(0, 15);
  return (
    <div className={`rounded-lg border px-4 py-3 space-y-2 ${ok ? "border-[#00ff9d]/40 bg-[#00ff9d]/10" : "border-[#ff4d4d]/40 bg-[#ff4d4d]/10"}`}>
      <div className="flex items-center gap-2 text-sm">
        {ok ? <CheckCircle2 className="w-4 h-4 text-[#00ff9d]" /> : <AlertTriangle className="w-4 h-4 text-[#ff9f43]" />}
        <span className="text-white font-medium">
          {result.created} record{result.created === 1 ? "" : "s"} added to {label}
          {result.rowErrors.length > 0 && `, ${result.rowErrors.length} row${result.rowErrors.length === 1 ? "" : "s"} skipped`}
          .
        </span>
      </div>
      {shown.length > 0 && (
        <ul className="text-xs text-[#a0aec0] space-y-1 max-h-40 overflow-y-auto">
          {shown.map((e, i) => (
            <li key={i}>Row {e.row ?? "?"}: {e.error}</li>
          ))}
          {result.rowErrors.length > shown.length && <li>… and {result.rowErrors.length - shown.length} more</li>}
        </ul>
      )}
    </div>
  );
}

// CSV import for one entity: pick a file, confirm the column mapping, then the
// rows are appended as new records. Existing data is never modified or deleted.
export default function CsvImportPanel({ config }) {
  const { entity, label, fields, required } = config;
  const { user } = useAuth();
  const { toast } = useToast();
  const fileRef = useRef(null);
  const [fileName, setFileName] = useState(null);
  const [headers, setHeaders] = useState([]);
  const [rows, setRows] = useState([]);
  const [mapping, setMapping] = useState({});
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [result, setResult] = useState(null);

  const onFile = (e) => {
    const file = e.target.files?.[0];
    e.target.value = null;
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const parsed = parseCsv(reader.result);
      if (!parsed.headers.length || !parsed.rows.length) {
        toast({ title: "Could not read that CSV", description: "Make sure the file has a header row and at least one data row.", variant: "destructive" });
        return;
      }
      const auto = {};
      fields.forEach((f) => {
        const hit = parsed.headers.find((h) => norm(h) === norm(f.key)) || parsed.headers.find((h) => norm(h) === norm(f.key.replace(/_/g, " ")));
        auto[f.key] = hit || "";
      });
      setHeaders(parsed.headers);
      setRows(parsed.rows);
      setMapping(auto);
      setFileName(file.name);
      setResult(null);
    };
    reader.readAsText(file);
  };

  const runImport = async () => {
    const { records, errors } = buildRecords({ fields, required, headers, rows, mapping });
    if (!records.length) {
      setResult({ created: 0, rowErrors: errors });
      return;
    }
    setImporting(true);
    setResult(null);
    setProgress({ done: 0, total: records.length });
    let created = 0;
    const rowErrors = [...errors];
    for (let i = 0; i < records.length; i += CHUNK_SIZE) {
      const chunk = records.slice(i, i + CHUNK_SIZE);
      try {
        await base44.entities[entity].bulkCreate(chunk);
        created += chunk.length;
      } catch {
        // A few bad rows can fail a whole batch: retry them one by one so the
        // good rows still get in.
        for (const rec of chunk) {
          try {
            await base44.entities[entity].create(rec);
            created++;
          } catch (err) {
            rowErrors.push({ row: null, error: `${err?.message || String(err)} (${required[0]}: ${rec[required[0]]})` });
          }
        }
      }
      setProgress({ done: Math.min(i + CHUNK_SIZE, records.length), total: records.length });
    }
    setImporting(false);
    setResult({ created, rowErrors });
    try {
      const now = new Date();
      await base44.entities.AuditLog.create({
        event_time: now.toISOString(),
        event_stamp: now.toISOString().slice(0, 19).replace("T", " "),
        user_name: actingUserName(user) || "—",
        module: "CSV Data Import",
        action: "Imported",
        record_id: label,
        details: `Imported ${created} record(s) into ${label} from ${fileName}`,
        new_value: `${created} created`,
      });
    } catch {
      // The import itself already succeeded; the audit entry must not undo it.
    }
  };

  return (
    <div className="bg-[#101828] rounded-xl border border-[#1e2740] p-4 space-y-4">
      <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={onFile} disabled={importing} />
      <div className="flex flex-wrap items-center gap-3">
        <Button
          onClick={() => fileRef.current?.click()}
          disabled={importing}
          variant="outline"
          className="bg-[#0e131d] border-[#1e2740] text-white hover:bg-[#16203a] hover:text-[#00e5ff]"
        >
          <Upload className="w-4 h-4 mr-1.5" /> Choose CSV file
        </Button>
        {fileName && (
          <span className="inline-flex items-center gap-1.5 text-sm text-[#a0aec0]">
            <FileText className="w-4 h-4 text-[#00e5ff] shrink-0" />
            {fileName} — {rows.length} data rows, {headers.length} columns
          </span>
        )}
      </div>

      {rows.length > 0 && (
        <FieldMappingList
          fields={fields}
          headers={headers}
          mapping={mapping}
          required={required}
          onChange={setMapping}
          disabled={importing}
        />
      )}

      {rows.length > 0 && (
        <Button onClick={runImport} disabled={importing} className="bg-[#00e5ff] hover:bg-[#00c3d7] text-[#0a0e17]">
          {importing && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}
          {importing ? `Importing… ${progress.done} / ${progress.total}` : `Add ${rows.length} rows to ${label}`}
        </Button>
      )}

      {result && <ResultBanner result={result} label={label} />}
    </div>
  );
}