import React, { useEffect, useState } from "react";
import { useAuth } from "@/lib/AuthContext";
import { useToast } from "@/components/ui/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2 } from "lucide-react";
import { saveProductSettings } from "@/lib/productMaster";
import { inputClass, subtleButton, primaryButton, dialogClass, labelClass } from "@/components/planning/styles";

const NameList = ({ title, hint, rows, setRows, placeholder }) => {
  const [draft, setDraft] = useState("");

  const add = () => {
    const name = draft.trim();
    if (!name || rows.some((row) => row.name.toLowerCase() === name.toLowerCase())) return;
    setRows([...rows, { name, status: "Active" }]);
    setDraft("");
  };

  return (
    <div className="space-y-2">
      <p className={labelClass}>{title}</p>
      <p className="text-[11px] text-[#5f6b7f]">{hint}</p>
      <div className="flex gap-2">
        <Input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }} placeholder={placeholder} className={inputClass} />
        <Button variant="outline" onClick={add} disabled={!draft.trim()} className={subtleButton}><Plus className="w-4 h-4" /></Button>
      </div>
      <div className="rounded-lg border border-[#1e2740] divide-y divide-[#131926] max-h-52 overflow-y-auto">
        {rows.length === 0 ? (
          <p className="px-3 py-3 text-xs text-[#5f6b7f]">Nothing on the list yet.</p>
        ) : (
          rows.map((row, index) => (
            <div key={`${row.name}-${index}`} className="flex items-center gap-2 px-3 py-1.5">
              <span className="flex-1 text-sm text-white truncate">{row.name}</span>
              <select
                value={row.status || "Active"}
                onChange={(e) => setRows(rows.map((entry, i) => (i === index ? { ...entry, status: e.target.value } : entry)))}
                className="bg-[#0a0e17] border border-[#1e2740] rounded text-xs text-[#a0aec0] px-1.5 py-1"
              >
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
              <button type="button" onClick={() => setRows(rows.filter((_, i) => i !== index))} className="text-[#5f6b7f] hover:text-[#ff4d4d]">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

// Brands and the customer / channel list used across the master datasheet.
export default function MasterSettingsDialog({ open, onClose, settings, onSaved }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [brands, setBrands] = useState([]);
  const [channels, setChannels] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setBrands(settings.brands || []);
    setChannels(settings.channels || []);
  }, [open, settings]);

  const save = async () => {
    setSaving(true);
    try {
      await saveProductSettings({ settings: { ...settings, brands, channels }, user });
      toast({ title: "Master lists saved", description: `${brands.length} brand(s), ${channels.length} channel(s).` });
      onSaved?.();
      onClose();
    } catch (e) {
      toast({ title: "Could not save", description: e?.message || "Please try again.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className={dialogClass}>
        <DialogHeader>
          <DialogTitle className="text-white">Product Master Settings</DialogTitle>
          <p className="text-xs text-[#5f6b7f]">Brands and customers / channels offered on the datasheet. Imports add to these lists automatically.</p>
        </DialogHeader>

        <NameList title="Brands" hint="One row per brand; inactive brands stay in history but leave the dropdown." rows={brands} setRows={setBrands} placeholder="Add a brand" />
        <NameList title="Customers / Channels" hint="The same product can be sold through more than one channel." rows={channels} setRows={setChannels} placeholder="Add a customer or channel" />

        <DialogFooter>
          <Button variant="outline" onClick={onClose} className={subtleButton}>Cancel</Button>
          <Button onClick={save} disabled={saving} className={primaryButton}>{saving ? "Saving..." : "Save lists"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}