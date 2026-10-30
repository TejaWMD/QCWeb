import React, { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Field from "@/components/planning/Field";
import { dialogClass, inputClass, primaryButton, subtleButton, labelClass } from "@/components/planning/styles";
import { useAuth } from "@/lib/AuthContext";
import { useToast } from "@/components/ui/use-toast";
import { num } from "@/lib/planning";
import { logYieldAudit, saveYieldSettings } from "@/lib/yieldLoss";

const linesToList = (value) => (value || "").split("\n").map((r) => r.trim()).filter(Boolean);

export default function YieldLossSettingsDialog({ open, onClose, settings, onSaved }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [form, setForm] = useState(settings);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setError("");
    setForm({
      ...settings,
      waste_reasons_text: (settings?.waste_reasons || []).join("\n"),
      rework_reasons_text: (settings?.rework_reasons || []).join("\n"),
    });
  }, [open, settings]);

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const save = async () => {
    const waste = linesToList(form.waste_reasons_text);
    const rework = linesToList(form.rework_reasons_text);
    if (!waste.length) return setError("Keep at least one waste reason.");
    if (!rework.length) return setError("Keep at least one rework reason.");
    setSaving(true);
    setError("");
    try {
      await saveYieldSettings({
        settings: {
          ...form,
          waste_reasons: waste,
          rework_reasons: rework,
          yield_tolerance_pct: num(form.yield_tolerance_pct),
          packaging_waste_threshold_pct: num(form.packaging_waste_threshold_pct),
          max_rework_pct: num(form.max_rework_pct),
        },
        user,
      });
      await logYieldAudit({
        user,
        action: "Updated",
        recordId: settings?.id || "yield_loss",
        details: `Settings changed: yield tolerance ${num(form.yield_tolerance_pct)}%, waste threshold ${num(form.packaging_waste_threshold_pct)}%, max rework ${num(form.max_rework_pct)}%`,
        oldValue: `${settings?.yield_tolerance_pct}% / ${settings?.packaging_waste_threshold_pct}% / ${settings?.max_rework_pct}%`,
        newValue: `${num(form.yield_tolerance_pct)}% / ${num(form.packaging_waste_threshold_pct)}% / ${num(form.max_rework_pct)}%`,
      });
      toast({ title: "Settings saved", description: "Tolerances and reason lists updated." });
      onSaved?.();
      onClose();
    } catch (e) {
      setError(e?.message || "Could not save the settings.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className={dialogClass}>
        <DialogHeader>
          <DialogTitle className="text-white">Yield &amp; Loss Settings</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Field label="Yield tolerance %" hint="Shortfall allowed below standard">
            <Input type="number" step="0.1" value={form?.yield_tolerance_pct ?? ""} onChange={(e) => set("yield_tolerance_pct", e.target.value)} className={inputClass} />
          </Field>
          <Field label="Waste threshold %" hint="Flag above this">
            <Input type="number" step="0.1" value={form?.packaging_waste_threshold_pct ?? ""} onChange={(e) => set("packaging_waste_threshold_pct", e.target.value)} className={inputClass} />
          </Field>
          <Field label="Max rework % per batch">
            <Input type="number" step="0.1" value={form?.max_rework_pct ?? ""} onChange={(e) => set("max_rework_pct", e.target.value)} className={inputClass} />
          </Field>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Waste reasons" hint="One per line">
            <textarea
              value={form?.waste_reasons_text || ""}
              onChange={(e) => set("waste_reasons_text", e.target.value)}
              className="w-full min-h-[140px] rounded-md border border-[#1e2740] bg-[#0a0e17] text-white text-sm p-2"
            />
          </Field>
          <Field label="Rework reasons" hint="One per line">
            <textarea
              value={form?.rework_reasons_text || ""}
              onChange={(e) => set("rework_reasons_text", e.target.value)}
              className="w-full min-h-[140px] rounded-md border border-[#1e2740] bg-[#0a0e17] text-white text-sm p-2"
            />
          </Field>
        </div>

        <p className={labelClass}>Only QA and Admin can change these values. Every change is written to the Audit Trail Log.</p>
        {error && <p className="text-sm text-[#ff4d4d]">{error}</p>}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} className={subtleButton}>Cancel</Button>
          <Button onClick={save} disabled={saving} className={primaryButton}>{saving ? "Saving..." : "Save settings"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}