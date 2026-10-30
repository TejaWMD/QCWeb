import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, X } from "lucide-react";
import RackSettingsCard from "@/components/warehouse/RackSettingsCard";
import { PACKAGING_SETTINGS_KEY, USE_THRESHOLD_DEFAULT, loadPackagingSettings } from "@/lib/packaging";

const FIELD = "bg-[#0e131d] border-[#1e2740] text-white";

// Categories, racks and the issue-approval threshold for Packaging Stock.
export default function PackagingSettingsDialog({ open, initialTab = "categories", updatedBy, onClose, onSaved }) {
  const [docId, setDocId] = useState("");
  const [categories, setCategories] = useState([]);
  const [threshold, setThreshold] = useState(String(USE_THRESHOLD_DEFAULT));
  const [newCategory, setNewCategory] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setError("");
    setNewCategory("");
    loadPackagingSettings().then((s) => {
      setDocId(s.id);
      setCategories(s.categories);
      setThreshold(String(s.threshold));
    });
  }, [open]);

  const save = async () => {
    if (!categories.length) return setError("Keep at least one category.");
    setSaving(true);
    setError("");
    try {
      const payload = {
        key: PACKAGING_SETTINGS_KEY,
        categories,
        use_approval_threshold: Number(threshold) || 0,
        updated_by: updatedBy || "",
      };
      if (docId) await base44.entities.PackagingSettings.update(docId, payload);
      else {
        const created = await base44.entities.PackagingSettings.create(payload);
        setDocId(created.id);
      }
      onSaved?.();
      onClose?.();
    } catch (e) {
      setError(e?.message || "Could not save the settings.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose?.()}>
      <DialogContent className="bg-[#131926] border-[#1e2740] text-white max-h-[88vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-white">Packaging stock settings</DialogTitle>
          <DialogDescription className="text-[#a0aec0] text-sm">
            Categories offered on the item form, the rack list, and the quantity above which an issue needs approval.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue={initialTab}>
          <TabsList className="bg-[#0e131d] border border-[#1e2740]">
            <TabsTrigger value="categories">Categories</TabsTrigger>
            <TabsTrigger value="racks">Racks</TabsTrigger>
            <TabsTrigger value="thresholds">Thresholds</TabsTrigger>
          </TabsList>

          <TabsContent value="categories" className="mt-3 space-y-3">
            <div className="flex gap-2">
              <Input
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                placeholder="New category name"
                className={FIELD}
                onKeyDown={(e) => {
                  if (e.key !== "Enter") return;
                  e.preventDefault();
                  const value = newCategory.trim();
                  if (!value || categories.includes(value)) return;
                  setCategories((prev) => [...prev, value]);
                  setNewCategory("");
                }}
              />
              <Button
                onClick={() => {
                  const value = newCategory.trim();
                  if (!value || categories.includes(value)) return;
                  setCategories((prev) => [...prev, value]);
                  setNewCategory("");
                }}
                className="bg-[#00e5ff] hover:bg-[#00c3d7] text-[#0a0e17]"
              >
                <Plus className="w-4 h-4" /> Add
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {categories.map((c) => (
                <span key={c} className="flex items-center gap-1 rounded-full border border-[#1e2740] bg-[#0e131d] px-2.5 py-1 text-xs text-[#a0aec0]">
                  {c}
                  <button type="button" onClick={() => setCategories((prev) => prev.filter((x) => x !== c))} className="text-[#5f6b7f] hover:text-[#ff4d4d]">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="racks" className="mt-3">
            <RackSettingsCard />
          </TabsContent>

          <TabsContent value="thresholds" className="mt-3 space-y-2">
            <div className="space-y-1">
              <label className="text-[10px] uppercase tracking-widest text-[#5f6b7f] font-semibold">Use Approval Threshold</label>
              <Input type="number" min="0" value={threshold} onChange={(e) => setThreshold(e.target.value)} className={FIELD} />
              <p className="text-[11px] text-[#5f6b7f]">A stock issue above this quantity goes to approvals instead of being deducted. Set 0 to never require approval.</p>
            </div>
          </TabsContent>
        </Tabs>

        {error && <p className="text-xs text-[#ff4d4d]">{error}</p>}

        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} className="text-[#a0aec0] hover:bg-white/5 hover:text-white">Close</Button>
          <Button onClick={save} disabled={saving} className="bg-[#00e5ff] hover:bg-[#00c3d7] text-[#0a0e17] font-semibold">
            {saving ? "Saving..." : "Save settings"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}