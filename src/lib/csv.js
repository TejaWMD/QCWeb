// Lightweight CSV parsing and value coercion for the CSV Data Import feature.

// Parses CSV text into { headers, rows }. Handles quoted fields, escaped
// quotes, CRLF line endings and a leading BOM. The delimiter is sniffed from
// the first line (comma or semicolon).
export function parseCsv(text) {
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  const firstLine = text.slice(0, text.indexOf("\n") === -1 ? text.length : text.indexOf("\n"));
  const delimiter = ((firstLine.match(/;/g) || []).length > (firstLine.match(/,/g) || []).length) ? ";" : ",";

  const parsed = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else inQuotes = false;
      } else field += c;
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === delimiter) {
      row.push(field); field = "";
    } else if (c === "\n") {
      row.push(field); field = ""; parsed.push(row); row = [];
    } else if (c !== "\r") {
      field += c;
    }
  }
  if (field !== "" || row.length > 0) { row.push(field); parsed.push(row); }

  const headers = parsed.length ? parsed[0].map((h) => h.trim()) : [];
  const rows = parsed
    .slice(1)
    .map((r) => r.map((v) => (v ?? "").toString().trim()))
    .filter((r) => r.some((v) => v !== ""));
  return { headers, rows };
}

// Coerces a raw CSV cell into the entity field's type.
// Returns { skip } for empty cells, { value } on success or { error } on failure.
export function coerceValue(field, raw) {
  const value = (raw ?? "").toString().trim();
  if (value === "") return { skip: true };
  const type = field.type || "text";

  if (type === "number") {
    const n = Number(value.replace(/,/g, ""));
    if (!Number.isFinite(n)) return { error: `"${value}" is not a number` };
    return { value: n };
  }

  if (type === "date") {
    if (/^\d{4}-\d{2}-\d{2}/.test(value)) return { value: value.slice(0, 10) };
    const dmy = value.match(/^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{4})$/); // DD/MM/YYYY (plant locale)
    if (dmy) {
      const pad = (s) => s.padStart(2, "0");
      return { value: `${dmy[3]}-${pad(dmy[2])}-${pad(dmy[1])}` };
    }
    const d = new Date(value);
    if (!isNaN(d.getTime())) return { value: d.toISOString().slice(0, 10) };
    return { error: `"${value}" is not a valid date` };
  }

  if (type === "datetime") {
    if (/^\d{4}-\d{2}-\d{2}T/.test(value)) return { value: new Date(value).toISOString() };
    const d = new Date(value);
    if (!isNaN(d.getTime())) return { value: d.toISOString() };
    return { error: `"${value}" is not a valid date/time` };
  }

  if (type === "boolean") {
    if (/^(true|yes|1)$/i.test(value)) return { value: true };
    if (/^(false|no|0)$/i.test(value)) return { value: false };
    return { error: `"${value}" is not true/false` };
  }

  if (type === "enum") {
    if (!field.options || field.options.includes(value)) return { value };
    return { error: `"${value}" is not one of: ${field.options.join(", ")}` };
  }

  if (type === "array") {
    return { value: value.split(/[,;]/).map((s) => s.trim()).filter(Boolean) };
  }

  return { value };
}