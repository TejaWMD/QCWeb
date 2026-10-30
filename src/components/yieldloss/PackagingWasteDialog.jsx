import React, { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import Field from "@/components/planning/Field";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { dialogClass, inputClass, selectClass, primaryButton, subtleButton, panelClass, labelClass } from "@/components/planning/styles";
import { useAuth } from "@/lib/AuthContext";
import { useToast } from "@/components/ui/use-toast";
import { base44 } from "@/api/base44Client";
import { actingUserName } from "@/lib/permissions";
import { num } from "@/lib/planning";
import { productionLines } from "@/lib/shiftLogConstants";
import { todayStr } from "@/lib/warehouse";
import { SHIFTS, logYieldAudit, packagingUsedForLine, shiftEntryWaste, wasteSummary } from "@/lib/yieldLoss";

const FIELDS = [
  { key: "film_m", label: "Film (m)" },
  { key: "film_kg", label: "Film (kg)" },
  { key: "cartons", label: "Cartons" },
  { key: "labels", label: "Labels" },
  { key: "pouches", label: "Pouches" },
];

export default function PackagingWasteDialog({ open, onClose, settings, movements = [], shiftEntries = [], onSaved }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [form, setForm] = useState({ waste_date: todayStr(), production_line: "", shift_type: "Morning", reason: "", film_m: "", film_kg: "", cartons: "", labels: "", pouches: "", notes: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const pulled = useMemo(
    () => shiftEntryWaste({ entries: shiftEntries, dateStr: form.waste_date, line: form.production_line, shift: form.shift_type }),
    [shiftEntries, form.waste_date, form.production_line, form.shift_type]
  );

  const used = useMemo(
    () => packagingUsedForLine({ movements, dateStr: form.waste_date, line: form.production_line }),
    [movements, form.waste_date, form.production_line]
  );
  const usedUnits = used.pieces || pulled?.usedFromEntry || 0;
  const summary = wasteSummary({ cartons: form.cartons, labels: form.labels, pouches: form.pouches, usedUnits, thresholdPct: settings.packaging_waste_threshold_pct });

  useEffect(() => {
    if (!open) return;
    setError("");
    setForm({ waste_date: todayStr(), production_line: "", shift_type: "Morning", reason: settings.waste_reasons?.[0] || "Other", film_m: "", film_kg: "", cartons: "", labels: "", pouches: "", notes: "" });
  }, [open, settings.waste_reasons]);

  // Figures already logged in the Daily Packaging Entry are copied in, never retyped.
  useEffect(() => {
    if (!open || !pulled) return;
    setForm((f) => ({
      ...f,
      film_m: pulled.film_m ? String(pulled.film_m) : f.film_m,
      cartons: pulled.cartons ? String(pulled.cartons) : f.cartons,
      labels: pulled.labels ? String(pulled.labels) : f.labels,
      pouches: pulled.pouches ? String(pulled.pouches) : f.pouches,
    }));
  }, [open, pulled]);

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const save = async () => {
    if (!form.production_line) return setError("Select the line.");
    if (!(num(form.cartons) + num(form.labels) + num(form.pouches) + num(form.film_m) + num(form.film_kg) > 0)) return setError("Record at least one waste figure.");
    if (!form.reason) return setError("Select a waste reason.");
    setSaving(true);
    setError("");
    try {
      const payload = {
        waste_date: form.waste_date,
        production_line: form.production_line,
        shift_type: form.shift_type,
        film_m: num(form.film_m),
        film_kg: num(form.film_kg),
        cartons: num(form.cartons),
        labels: num(form.labels),
        pouches: num(form.pouches),
        reason: form.reason,
        used_units: usedUnits,
        waste_units: summary.waste_units,
        waste_pct: summary.waste_pct,
        exceeded: summary.exceeded,
        source: pulled?.hasWaste ? "Daily Packaging Entry" : "Manual",
        shift_log_id: pulled?.id || "",
        status: "Draft",
        owner: actingUserName(user),
        owner_id: user?.id || "",
        notes: form.notes.trim(),
      };
      const created = await base44.entities.PackagingWaste.create(payload);
      await logYieldAudit({
        user,
        action: "Created",
        recordId: created?.id || `${form.waste_date}-${form.production_line}`,
        details: `Packaging waste ${form.production_line} ${form.shift_type} on ${form.waste_date}: ${summary.waste_units} pcs (${summary.waste_pct}% of ${usedUnits} issued) · ${form.reason}`,
        newValue: summary.exceeded ? "Above threshold" : "Within threshold",
      });
      toast({ title: "Waste recorded", description: `${summary.waste_pct}%${summary.exceeded ? " · above threshold" : ""}` });
      onSaved?.();
      onClose();
    } catch (e) {
      setError(e?.message || "Could not save the waste record.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className={dialogClass}>
        <DialogHeader>
          <DialogTitle className="text-white">New Packaging Waste Entry</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Field label="Date">
            <Input type="date" value={form.waste_date} onChange={(e) => set("waste_date", e.target.value)} className={inputClass} />
          </Field>
          <Field label="Line">
            <Select value={form.production_line || undefined} onValueChange={(v) => set("production_line", v)}>
              <SelectTrigger className={selectClass}><SelectValue placeholder="Select line" /></SelectTrigger>
              <SelectContent>{productionLines.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Shift">
            <Select value={form.shift_type} onValueChange={(v) => set("shift_type", v)}>
              <SelectTrigger className={selectClass}><SelectValue /></SelectTrigger>
              <SelectContent>{SHIFTS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
        </div>

        {pulled?.hasWaste && (
          <div className="rounded-lg border border-[#00ff9d]/30 bg-[#00ff9d]/5 px-3 py-2">
            <p className="text-[11px] text-[#00ff9d] font-semibold">Pulled from the Daily Packaging Entry — no need to enter it twice.</p>
            <p className="text-[11px] text-[#a0aec0] mt-0.5">Adjust a figure only if the entry is wrong.</p>
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {FIELDS.map((f) => (
            <Field key={f.key} label={f.label}>
              <Input type="number" min="0" step="0.01" value={form[f.key]} onChange={(e) => set(f.key, e.target.value)} className={inputClass} placeholder="0" />
            </Field>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Reason" hint="Managed in Settings">
            <Select value={form.reason || undefined} onValueChange={(v) => set("reason", v)}>
              <SelectTrigger className={selectClass}><SelectValue placeholder="Select reason" /></SelectTrigger>
              <SelectContent>{(settings.waste_reasons || []).map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Notes">
            <Textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} className={`${inputClass} min-h-[38px]`} placeholder="Optional" />
          </Field>
        </div>

        <div className={`${panelClass} p-3 grid grid-cols-3 gap-2`}>
          <div><p className={labelClass}>Issued pieces</p><p className="text-white text-sm font-semibold">{usedUnits.toLocaleString("en-US")}</p></div>
          <div><p className={labelClass}>Waste pieces</p><p className="text-white text-sm font-semibold">{summary.waste_units.toLocaleString("en-US")}</p></div>
          <div><p className={labelClass}>Waste %</p><p className={`text-sm font-semibold ${summary.exceeded ? "text-[#ff4d4d]" : "text-[#00ff9d]"}`}>{summary.waste_pct}%</p></div>
        </div>
        <p className="text-[11px] text-[#5f6b7f]">
          Threshold {settings.packaging_waste_threshold_pct}% · used pieces come from Packaging Stock and the Daily Packaging Entry issued quantities.
        </p>
        {error && <p className="text-sm text-[#ff4d4d]">{error}</p>}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} className={subtleButton}>Cancel</Button>
          <Button onClick={save} disabled={saving} className={primaryButton}>{saving ? "Saving..." : "Save waste"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}