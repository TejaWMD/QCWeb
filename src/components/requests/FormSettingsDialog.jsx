import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { actingUserName } from "@/lib/permissions";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  APPROVAL_TYPES,
  CONFIG_KEY,
  DEFAULT_FORM_CONFIG,
  DEFAULT_REQUIRED,
  EVIDENCE_REQUIRED_APPROVAL_TYPES,
  REQUEST_TYPES,
  TYPE_FIELDS,
} from "@/lib/requestConstants";

const eventStamp = () => {
  const d = new Date();
  return `${d.toISOString().slice(0, 10)} ${d.toTimeString().slice(0, 8)}`;
};

// Admin-editable dropdown lists (one value per line).
const LISTS = [
  { key: "categories", label: "Downtime Categories" },
  { key: "approval_types", label: "Approval Types" },
  { key: "item_categories", label: "Item / Material Categories" },
  { key: "urgencies", label: "Urgency Options" },
  { key: "proposed_actions", label: "Proposed Actions" },
  { key: "owner_teams", label: "Owner Teams" },
  { key: "printed_items", label: "What Was Printed Options" },
];

// Admin settings for the New Request form: dropdown lists, which fields are
// required per request type, evidence rules, and the purchase MD limit.
export default function FormSettingsDialog({ open, onOpenChange, config = DEFAULT_FORM_CONFIG, user, onSaved }) {
  const [lists, setLists] = useState({});
  const [required, setRequired] = useState(DEFAULT_REQUIRED);
  const [evidenceDowntime, setEvidenceDowntime] = useState(true);
  const [evidenceApprovals, setEvidenceApprovals] = useState([]);
  const [mdLimit, setMdLimit] = useState(500);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setLists(Object.fromEntries(LISTS.map((l) => [l.key, (config[l.key] || []).join("\n")])));
      setRequired(config.required || DEFAULT_REQUIRED);
      setEvidenceDowntime(config.evidence_required_downtime !== false);
      setEvidenceApprovals(config.evidence_required_approval_types || EVIDENCE_REQUIRED_APPROVAL_TYPES);
      setMdLimit(config.purchase_md_limit || 500);
      setError("");
    }
  }, [open, config]);

  const toggleRequired = (type, key) =>
    setRequired((r) => {
      const current = r[type] || [];
      return { ...r, [type]: current.includes(key) ? current.filter((k) => k !== key) : [...current, key] };
    });

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      const payload = {
        key: CONFIG_KEY,
        ...Object.fromEntries(
          LISTS.map((l) => [l.key, (lists[l.key] || "").split("\n").map((s) => s.trim()).filter(Boolean)])
        ),
        required,
        evidence_required_downtime: evidenceDowntime,
        evidence_required_approval_types: evidenceApprovals,
        purchase_md_limit: Number(mdLimit) || 0,
        updated_by: user?.full_name || user?.email || "",
      };
      const page = await base44.entities.FormConfig.filter({ key: CONFIG_KEY }, { limit: 1 });
      if (page.items?.length) {
        await base44.entities.FormConfig.update(page.items[0].id, payload);
      } else {
        await base44.entities.FormConfig.create(payload);
      }
      try {
        await base44.entities.AuditLog.create({
          event_time: new Date().toISOString(),
          event_stamp: eventStamp(),
          user_name: actingUserName(user),
          module: "Requests & Stoppages",
          action: "Updated",
          record_id: "",
          details: "Form dropdowns and required-field settings changed",
          old_value: "",
          new_value: "",
        });
      } catch {
        // An audit write must never block the save.
      }
      onSaved?.();
      onOpenChange(false);
    } catch (err) {
      setError(err?.message || "Could not save the settings. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#131926] border-[#1e2740] text-white max-h-[85vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="text-white">Form Settings</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {LISTS.map((l) => (
            <div key={l.key} className="space-y-1.5">
              <Label className="text-xs text-[#a0aec0]">{l.label} (one per line)</Label>
              <Textarea
                value={lists[l.key] || ""}
                onChange={(e) => setLists((s) => ({ ...s, [l.key]: e.target.value }))}
                className="bg-[#0e131d] border-[#1e2740] text-white min-h-[60px] text-sm"
              />
            </div>
          ))}

          <div className="space-y-3 rounded-lg border border-[#1e2740] bg-[#0e131d] p-3">
            <p className="text-xs font-semibold text-[#e2e8f0]">Required fields per request type</p>
            {REQUEST_TYPES.map((t) => (
              <div key={t} className="space-y-1.5">
                <p className="text-[10px] font-semibold tracking-wide text-[#00e5ff]">{t}</p>
                <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                  {TYPE_FIELDS[t].map((f) => (
                    <label key={f.key} className="flex items-center gap-1.5 text-xs text-[#e2e8f0] cursor-pointer">
                      <Checkbox checked={(required[t] || []).includes(f.key)} onCheckedChange={() => toggleRequired(t, f.key)} />
                      {f.label}
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="space-y-2 rounded-lg border border-[#1e2740] bg-[#0e131d] p-3">
            <p className="text-xs font-semibold text-[#e2e8f0]">Evidence requirements</p>
            <label className="flex items-center gap-2 text-sm text-[#e2e8f0] cursor-pointer">
              <Checkbox checked={evidenceDowntime} onCheckedChange={(c) => setEvidenceDowntime(c === true)} />
              Evidence photo required for Downtime / Stoppage
            </label>
            <p className="text-[10px] text-[#a0aec0]">Evidence photo required for these approval types:</p>
            <div className="flex flex-wrap gap-x-4 gap-y-1.5">
              {APPROVAL_TYPES.map((t) => (
                <label key={t} className="flex items-center gap-1.5 text-xs text-[#e2e8f0] cursor-pointer">
                  <Checkbox
                    checked={evidenceApprovals.includes(t)}
                    onCheckedChange={(c) => setEvidenceApprovals((list) => (c === true ? [...list, t] : list.filter((x) => x !== t)))}
                  />
                  {t}
                </label>
              ))}
            </div>
            <div className="space-y-1 pt-1">
              <Label className="text-xs text-[#a0aec0]">Purchase / Spending goes to the MD above this amount</Label>
              <Input
                type="number"
                value={mdLimit}
                onChange={(e) => setMdLimit(e.target.value)}
                className="bg-[#0e131d] border-[#1e2740] text-white"
              />
            </div>
          </div>

          {error && <p className="text-xs text-[#ff4d4d]">{error}</p>}
        </div>
        <DialogFooter className="mt-2">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} className="text-[#a0aec0] hover:text-white hover:bg-white/5">
            Cancel
          </Button>
          <Button type="button" disabled={saving} onClick={save} className="bg-[#00e5ff] hover:bg-[#00c3d7] text-[#0a0e17]">
            {saving ? "Saving..." : "Save Settings"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}