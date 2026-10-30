import React, { useEffect, useMemo, useRef, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { useToast } from "@/components/ui/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, FileText, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import { parseCsv } from "@/lib/csv";
import { PRODUCT_IMPORT_FIELDS, autoMapProducts, buildProductPreview } from "@/lib/productImport";
import { logPlanningAudit } from "@/lib/planning";
import { selectClass, primaryButton, subtleButton } from "@/components/planning/styles";

const PREVIEW_LIMIT = 40;
const NONE = "__none__";

// CSV import for products: map the columns, check every row (required values,
// duplicate codes, unknown machines and packaging codes), then confirm.
export default function ProductImportDialog({ open, onClose, products = [], packagingItems = [], machineNames = [], onSaved }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const fileRef = useRef(null);
  const [fileName, setFileName] = useState("");
  const [parsed, setParsed] = useState({ headers: [], rows: [] });
  const [mapping, setMapping] = useState({});
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setFileName("");
    setParsed({ headers: [], rows: [] });
    setMapping({});
    setImporting(false);
  }, [open]);

  const onFile = (e) => {
    const file = e.target.files?.[0];
    e.target.value = null;
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = parseCsv(reader.result);
      if (!result.headers.length || !result.rows.length) {
        toast({ title: "Could not read that CSV", description: "The file needs a header row and at least one data row.", variant: "destructive" });
        return;
      }
      setFileName(file.name);
      setParsed(result);
      setMapping(autoMapProducts(result.headers));
    };
    reader.readAsText(file);
  };

  const { preview, ready, errorCount } = useMemo(
    () => buildProductPreview({ headers: parsed.headers, rows: parsed.rows, mapping, products, machineNames, packagingItems }),
    [parsed, mapping, products, machineNames, packagingItems]
  );

  const confirm = async () => {
    if (!ready.length) return;
    setImporting(true);
    try {
      const records = ready.map((r) => r.record);
      for (let i = 0; i < records.length; i += 100) {
        await base44.entities.Product.bulkCreate(records.slice(i, i + 100));
      }
      await logPlanningAudit({
        user,
        module: "Product Master",
        action: "Imported",
        recordId: fileName,
        details: `Imported ${records.length} product(s) from ${fileName}${errorCount ? `, ${errorCount} row(s) skipped` : ""}`,
        newValue: `${records.length} created`,
      });
      toast({ title: "Products imported", description: `${records.length} product(s) added from ${fileName}.` });
      onSaved?.();
      onClose();
    } catch (e) {
      toast({ title: "Import failed", description: e?.message || "Please try again.", variant: "destructive" });
    } finally {
      setImporting(false);
    }
  };

  const hasRows = parsed.rows.length > 0;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="bg-[#0b1018] border-[#1e2740] text-white max-w-4xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-white">Import Products from CSV</DialogTitle>
          <p className="text-xs text-[#5f6b7f]">
            Packaging per carton can be given as <span className="text-[#a0aec0]">CODE:QTY; CODE:QTY</span> using Packaging Stock item codes.
          </p>
        </DialogHeader>

        <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={onFile} disabled={importing} />
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={importing} className="bg-[#0e131d] border-[#1e2740] text-white hover:bg-[#16203a] hover:text-[#00e5ff]">
            <Upload className="w-4 h-4 mr-1.5" /> Choose CSV file
          </Button>
          {fileName && (
            <span className="inline-flex items-center gap-1.5 text-sm text-[#a0aec0]">
              <FileText className="w-4 h-4 text-[#00e5ff] shrink-0" />
              {fileName} — {parsed.rows.length} rows, {parsed.headers.length} columns
            </span>
          )}
        </div>

        {hasRows && (
          <div className="rounded-lg border border-[#1e2740] bg-[#0e131d] p-3">
            <p className="text-[10px] uppercase tracking-widest text-[#5f6b7f] font-semibold mb-2">Column mapping</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {PRODUCT_IMPORT_FIELDS.map((f) => (
                <div key={f.key} className="flex items-center gap-2">
                  <span className="text-xs text-[#a0aec0] flex-1 truncate">
                    {f.label}
                    {f.required && <span className="text-[#ff4d4d]"> *</span>}
                  </span>
                  <Select
                    value={mapping[f.key] || NONE}
                    onValueChange={(v) => setMapping((m) => ({ ...m, [f.key]: v === NONE ? "" : v }))}
                    disabled={importing}
                  >
                    <SelectTrigger className={`${selectClass} w-44`}><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>Not imported</SelectItem>
                      {parsed.headers.map((h) => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
          </div>
        )}

        {hasRows && (
          <>
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <span className="inline-flex items-center gap-1.5 text-[#00ff9d]">
                <CheckCircle2 className="w-4 h-4" /> {ready.length} row{ready.length === 1 ? "" : "s"} ready
              </span>
              <span className={`inline-flex items-center gap-1.5 ${errorCount ? "text-[#ff9f43]" : "text-[#5f6b7f]"}`}>
                <AlertTriangle className="w-4 h-4" /> {errorCount} with errors
              </span>
            </div>

            <div className="rounded-lg border border-[#1e2740] overflow-x-auto max-h-72 overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-[#101828]">
                  <tr className="text-[10px] uppercase tracking-widest text-[#5f6b7f]">
                    <th className="text-left font-semibold px-2 py-2">Row</th>
                    <th className="text-left font-semibold px-2 py-2">Code</th>
                    <th className="text-left font-semibold px-2 py-2">Product</th>
                    <th className="text-left font-semibold px-2 py-2">Machine</th>
                    <th className="text-right font-semibold px-2 py-2">Ctns</th>
                    <th className="text-right font-semibold px-2 py-2">Shelf</th>
                    <th className="text-right font-semibold px-2 py-2">Pkg</th>
                    <th className="text-left font-semibold px-2 py-2">Check</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.slice(0, PREVIEW_LIMIT).map((r) => (
                    <tr key={r.row} className="border-t border-[#131926]">
                      <td className="px-2 py-1.5 text-[#5f6b7f]">{r.row}</td>
                      <td className="px-2 py-1.5 text-white">{r.code}</td>
                      <td className="px-2 py-1.5 text-[#a0aec0] max-w-[220px] truncate">{r.name}</td>
                      <td className="px-2 py-1.5 text-[#a0aec0] max-w-[160px] truncate">{r.machine || "—"}</td>
                      <td className="px-2 py-1.5 text-right text-[#a0aec0]">{r.carton_size || "—"}</td>
                      <td className="px-2 py-1.5 text-right text-[#a0aec0]">{r.shelf_life_days || "—"}</td>
                      <td className="px-2 py-1.5 text-right text-[#a0aec0]">{r.packaging}</td>
                      <td className={`px-2 py-1.5 ${r.error ? "text-[#ff4d4d]" : "text-[#00ff9d]"}`}>{r.error || "OK"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {preview.length > PREVIEW_LIMIT && (
              <p className="text-[11px] text-[#5f6b7f]">Showing the first {PREVIEW_LIMIT} of {preview.length} rows.</p>
            )}
          </>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} className={subtleButton} disabled={importing}>Cancel</Button>
          <Button onClick={confirm} disabled={!ready.length || importing} className={primaryButton}>
            {importing && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}
            {importing ? "Importing..." : `Confirm import (${ready.length})`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}