import React, { useEffect, useState } from "react";
import { useToast } from "@/components/ui/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";
import { todayStr } from "@/lib/warehouse";
import {
  BATCH_PATTERN_DEFAULT, BATCH_PATTERN_TOKENS, buildBatchCodes, saveProductionSettings,
} from "@/lib/production";
import { inputClass, primaryButton, subtleButton, labelClass } from "@/components/planning/styles";

const TOKEN_HELP = [
  ["{CODE}", "product code"],
  ["{DDMMYYYY}", "production date"],
  ["{YYMMDD}", "short date"],
  ["{LETTER}", "A, B, C…"],
  ["{SEQ}", "01, 02, 03…"],
];

// Batch number pattern, editable per plant. The preview uses a sample product
// code and today's date so the result is visible before saving.
export default function ProductionSettingsDialog({ open, onClose, settings, user, onSaved }) {
  const { toast } = useToast();
  const [pattern, setPattern] = useState(BATCH_PATTERN_DEFAULT);
  const [defaultCph, setDefaultCph] = useState(300);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setPattern(settings?.batch_pattern || BATCH_PATTERN_DEFAULT);
    setDefaultCph(settings?.default_cph || 300);
    setSaving(false);
  }, [open, settings]);

  const preview = buildBatchCodes({
    code: "RCE",
    plannedStart: new Date().toISOString(),
    count: 3,
    pattern: pattern || BATCH_PATTERN_DEFAULT,
  }).join(", ");

  const save = async () => {
    setSaving(true);
    try {
      await saveProductionSettings({ settings: { id: settings?.id, batch_pattern: pattern, default_cph: defaultCph }, user });
      toast({ title: "Production settings saved", description: `Batch pattern set to ${pattern || BATCH_PATTERN_DEFAULT}.` });
      onSaved?.();
      onClose();
    } catch (e) {
      toast({ title: "Could not save the settings", description: e?.message || "Please try again.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="bg-[#0b1018] border-[#1e2740] text-white max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-white">Production Settings</DialogTitle>
          <p className="text-xs text-[#5f6b7f]">The batch pattern applies to every new order.</p>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1">
            <label className={labelClass}>Batch number pattern</label>
            <Input value={pattern} onChange={(e) => setPattern(e.target.value)} className={inputClass} placeholder={BATCH_PATTERN_DEFAULT} />
            <p className="text-[11px] text-[#5f6b7f]">Example for today: <span className="text-[#00e5ff]">{preview}</span></p>
          </div>

          <div className="rounded-lg border border-[#1e2740] bg-[#0e131d] p-2">
            <p className="text-[10px] uppercase tracking-widest text-[#5f6b7f] font-semibold mb-1">Tokens</p>
            <div className="flex flex-wrap gap-1.5">
              {TOKEN_HELP.map(([token, label]) => (
                <button
                  key={token}
                  type="button"
                  onClick={() => setPattern((p) => `${p || ""}${token}`)}
                  className="text-[11px] px-1.5 py-0.5 rounded bg-[#00e5ff]/10 text-[#00e5ff] border border-[#00e5ff]/30 hover:bg-[#00e5ff]/20"
                >
                  {token} <span className="text-[#5f6b7f]">{label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1">
            <label className={labelClass}>Default capacity (cartons / hour)</label>
            <Input type="number" min="1" value={defaultCph} onChange={(e) => setDefaultCph(e.target.value)} className={inputClass} />
            <p className="text-[11px] text-[#5f6b7f]">Used for run-time estimates when a machine has no capacity set.</p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setPattern(BATCH_PATTERN_DEFAULT)} className={subtleButton} disabled={saving}>Reset pattern</Button>
          <Button onClick={save} disabled={saving} className={primaryButton}>
            {saving && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}
            {saving ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}