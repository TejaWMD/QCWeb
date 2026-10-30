import React, { useEffect, useState } from "react";
import { useToast } from "@/components/ui/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, RotateCcw } from "lucide-react";
import { DEFAULT_LAYOUTS, ECC_LEVELS, saveLabelSettings } from "@/lib/labels";
import { inputClass, selectClass, primaryButton, subtleButton, labelClass } from "@/components/planning/styles";

// Admin-managed label layouts: size, font, QR size and error correction level.
export default function LabelSettingsDialog({ open, onClose, settings, user, onSaved }) {
  const { toast } = useToast();
  const [layouts, setLayouts] = useState(DEFAULT_LAYOUTS);
  const [defaultId, setDefaultId] = useState(DEFAULT_LAYOUTS[0].id);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLayouts(settings?.layouts?.length ? settings.layouts : DEFAULT_LAYOUTS);
    setDefaultId(settings?.default_layout_id || DEFAULT_LAYOUTS[0].id);
    setSaving(false);
  }, [open, settings]);

  const patch = (id, field, value) =>
    setLayouts((list) => list.map((l) => (l.id === id ? { ...l, [field]: value } : l)));

  const save = async () => {
    setSaving(true);
    try {
      await saveLabelSettings({ settings: { id: settings?.id, layouts, default_layout_id: defaultId }, user });
      toast({ title: "Label settings saved", description: "The Create Batch page uses these layouts." });
      onSaved?.();
      onClose();
    } catch (e) {
      toast({ title: "Could not save the label settings", description: e?.message || "Please try again.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="bg-[#0b1018] border-[#1e2740] text-white max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-white">Label Settings</DialogTitle>
          <p className="text-xs text-[#5f6b7f]">Sizes are in millimetres, the font size in points. Only Admin can change these.</p>
        </DialogHeader>

        <div className="space-y-2">
          <div className="space-y-1 max-w-xs">
            <label className={labelClass}>Default layout for all products</label>
            <Select value={defaultId} onValueChange={setDefaultId}>
              <SelectTrigger className={selectClass}><SelectValue /></SelectTrigger>
              <SelectContent>
                {layouts.map((l) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-lg border border-[#1e2740] overflow-hidden">
            <div className="hidden sm:grid grid-cols-[1.4fr_repeat(4,0.7fr)_0.7fr] gap-2 px-2 py-1.5 bg-[#0e131d] text-[10px] uppercase tracking-widest text-[#5f6b7f] font-semibold">
              <span>Layout</span><span>Width mm</span><span>Height mm</span><span>Font pt</span><span>QR mm</span><span>ECC</span>
            </div>
            {layouts.map((layout) => (
              <div key={layout.id} className="grid grid-cols-2 sm:grid-cols-[1.4fr_repeat(4,0.7fr)_0.7fr] gap-2 px-2 py-1.5 border-t border-[#131926] items-center">
                <Input value={layout.name} onChange={(e) => patch(layout.id, "name", e.target.value)} className={`${inputClass} h-8 text-sm`} />
                <Input type="number" min="20" step="0.5" value={layout.width_mm} onChange={(e) => patch(layout.id, "width_mm", e.target.value)} className={`${inputClass} h-8 text-sm`} />
                <Input type="number" min="20" step="0.5" value={layout.height_mm} onChange={(e) => patch(layout.id, "height_mm", e.target.value)} className={`${inputClass} h-8 text-sm`} />
                <Input type="number" min="4" step="0.5" value={layout.font_size} onChange={(e) => patch(layout.id, "font_size", e.target.value)} className={`${inputClass} h-8 text-sm`} />
                <Input type="number" min="5" step="0.5" value={layout.qr_mm} onChange={(e) => patch(layout.id, "qr_mm", e.target.value)} className={`${inputClass} h-8 text-sm`} />
                <Select value={layout.qr_ecc || "M"} onValueChange={(v) => patch(layout.id, "qr_ecc", v)}>
                  <SelectTrigger className={`${selectClass} h-8 text-sm`}><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ECC_LEVELS.map((level) => <SelectItem key={level} value={level}>{level}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setLayouts(DEFAULT_LAYOUTS)} className={subtleButton} disabled={saving}>
            <RotateCcw className="w-3.5 h-3.5 mr-1.5" /> Reset to defaults
          </Button>
          <Button onClick={save} disabled={saving} className={primaryButton}>
            {saving && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}
            {saving ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}