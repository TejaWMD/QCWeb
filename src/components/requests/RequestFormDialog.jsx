import React, { useEffect, useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import { actingUserName } from "@/lib/permissions";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { productionLines } from "@/lib/shiftLogConstants";
import EvidenceUploader from "@/components/requests/EvidenceUploader";
import {
  REQUEST_TYPES,
  DOWNTIME_TYPE,
  ITEM_TYPE,
  APPROVAL_TYPE,
  APPROVAL_CONDITIONAL_FIELDS,
  DEFAULT_FORM_CONFIG,
  DEFAULT_REQUIRED,
  FIELD_LABELS,
  LABELLING_TYPE,
  PURCHASE_TYPE,
  TYPE_FIELDS,
} from "@/lib/requestConstants";

const eventStamp = () => {
  const d = new Date();
  return `${d.toISOString().slice(0, 10)} ${d.toTimeString().slice(0, 8)}`;
};

const keysOf = (type) => TYPE_FIELDS[type].map((f) => f.key);

// The fields shown for the selected type; hidden fields are neither required
// nor saved.
const visibleKeysFor = (type, values) => {
  if (type === DOWNTIME_TYPE) return [...keysOf(DOWNTIME_TYPE), "notes", "is_demo"];
  if (type === ITEM_TYPE) return keysOf(ITEM_TYPE);
  return [...keysOf(APPROVAL_TYPE), ...(APPROVAL_CONDITIONAL_FIELDS[values.approval_type] || [])];
};

// How each field renders; select options come from the admin-editable config.
const fieldDefs = (config) => ({
  shift_date: { type: "date" },
  shift_type: { type: "select", options: ["Morning", "Night"], default: "Morning" },
  start_time: { type: "text" },
  end_time: { type: "text" },
  duration_min: { type: "number" },
  category: { type: "select", options: config.categories, default: "Mechanical" },
  reason: { type: "textarea" },
  immediate_action_taken: { type: "textarea" },
  product_affected: { type: "select", options: ["No", "Yes"], default: "No" },
  notes: { type: "textarea" },
  is_demo: { type: "checkbox" },
  item_name: { type: "text" },
  quantity: { type: "number" },
  urgency: { type: "select", options: config.urgencies, default: "Normal" },
  needed_by_date: { type: "date" },
  item_category: { type: "select", options: config.item_categories },
  estimated_cost: { type: "number" },
  approval_type: { type: "select", options: config.approval_types },
  description: { type: "textarea" },
  product_sku: { type: "text" },
  batch_number: { type: "text" },
  order_number: { type: "text" },
  quantity_affected: { type: "number" },
  proposed_action: { type: "select", options: config.proposed_actions },
  impact_if_not_approved: { type: "textarea" },
  needed_by_datetime: { type: "datetime" },
  printed_value: { type: "text" },
  correct_value: { type: "text" },
  printed_item: { type: "select", options: config.printed_items },
  qty_produced: { type: "number" },
  already_packed: { type: "select", options: ["No", "Yes"], default: "No" },
  packed_qty: { type: "number" },
  line_stopped: { type: "select", options: ["No", "Yes"], default: "No" },
  ot_workers: { type: "number" },
  ot_hours: { type: "number" },
  ot_reason: { type: "text" },
  ot_date: { type: "date" },
  rework_reason: { type: "textarea" },
  rework_method: { type: "text" },
  qa_signoff: { type: "text" },
  hold_reference: { type: "text" },
  qa_decision: { type: "text" },
  purchase_amount: { type: "number" },
  sop_reference: { type: "text" },
  sop_deviation: { type: "textarea" },
  sop_risk: { type: "text" },
  sop_duration: { type: "text" },
});

// New Request form: common fields for all three types, per-type fields that
// change with the Request Type, required-field validation with asterisks,
// and evidence upload. Hidden fields are never required and never saved.
export default function RequestFormDialog({ open, onOpenChange, user, config = DEFAULT_FORM_CONFIG }) {
  const [type, setType] = useState(DOWNTIME_TYPE);
  const [values, setValues] = useState({});
  const [evidenceFiles, setEvidenceFiles] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const defs = useMemo(() => fieldDefs(config), [config]);

  const defaults = useMemo(() => {
    const d = { owners: [], production_line: "" };
    Object.entries(defs).forEach(([k, def]) => {
      d[k] = def.type === "checkbox" ? false : def.default !== undefined ? def.default : "";
    });
    return d;
  }, [defs]);

  useEffect(() => {
    if (open) {
      setType(DOWNTIME_TYPE);
      const init = { ...defaults };
      if (user?.line) init.production_line = user.line;
      setValues(init);
      setEvidenceFiles([]);
      setError("");
    }
  }, [open, defaults]);

  const visibleKeys = visibleKeysFor(type, values);
  const requiredKeys = config.required?.[type] || DEFAULT_REQUIRED[type];
  const requesterName = user?.full_name || user?.email || "";

  // Labelling / Packaging Error requests are always routed to the QA/QC Team.
  const qaForced = type === APPROVAL_TYPE && values.approval_type === LABELLING_TYPE;

  // Changing the Request Type clears the hidden fields but keeps the common ones.
  const switchType = (t) => {
    setType(t);
    setValues((v) => ({
      ...defaults,
      production_line: v.production_line,
      owners: v.owners,
    }));
    setError("");
  };

  const set = (key, value) => setValues((v) => ({ ...v, [key]: value }));

  const setApprovalType = (v) => {
    setValues((prev) => {
      const owners = [...(prev.owners || [])];
      if (v === LABELLING_TYPE && !owners.includes("QA/QC Team")) owners.push("QA/QC Team");
      return { ...prev, approval_type: v, owners };
    });
  };

  const toggleOwner = (team, checked) => {
    if (qaForced && team === "QA/QC Team" && !checked) return;
    setValues((v) => ({
      ...v,
      owners: checked ? [...(v.owners || []), team] : (v.owners || []).filter((t) => t !== team),
    }));
  };

  // Auto-calculate the downtime duration from the start and end times.
  useEffect(() => {
    if (type !== DOWNTIME_TYPE) return;
    const m = /^(\d{1,2}):(\d{2})$/.exec(values.start_time || "");
    const n = /^(\d{1,2}):(\d{2})$/.exec(values.end_time || "");
    if (m && n) {
      const mins = +n[1] * 60 + +n[2] - (+m[1] * 60 + +m[2]);
      if (mins > 0) setValues((v) => (v.duration_min === mins ? v : { ...v, duration_min: mins }));
    }
  }, [type, values.start_time, values.end_time]);

  const evidenceRequired =
    type === DOWNTIME_TYPE
      ? config.evidence_required_downtime !== false
      : type === ITEM_TYPE
        ? false
        : (config.evidence_required_approval_types || []).includes(values.approval_type);

  const audit = async (action, recordId, details) => {
    try {
      await base44.entities.AuditLog.create({
        event_time: new Date().toISOString(),
        event_stamp: eventStamp(),
        user_name: actingUserName(user),
        module: "Requests & Stoppages",
        action,
        record_id: recordId || "",
        details,
        old_value: "",
        new_value: "Submitted",
      });
    } catch {
      // An audit write must never block the submission.
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    const missing = [];
    if (!values.production_line) missing.push("Production Line");
    if (!(values.owners || []).length) missing.push("Owner");
    visibleKeys.forEach((k) => {
      if (requiredKeys.includes(k) && (values[k] === "" || values[k] === undefined || values[k] === null)) {
        missing.push(FIELD_LABELS[k] || k);
      }
    });
    if (missing.length) {
      setError(`Please fill the required fields: ${missing.join(", ")}.`);
      return;
    }
    if (evidenceRequired && evidenceFiles.length === 0) {
      setError("A photo is required for this request type. Add evidence before submitting.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      // Upload evidence privately; the uploader and time are recorded per file.
      const evidence_files = [];
      for (const f of evidenceFiles) {
        const { file_uri } = await base44.integrations.Core.UploadPrivateFile({ file: f.file });
        evidence_files.push({
          file_uri,
          file_name: f.file.name,
          caption: f.caption || "",
          uploaded_by: requesterName,
          uploaded_date: new Date().toISOString(),
        });
      }

      // Auto-routing rules.
      const owners = [...(values.owners || [])];
      if (qaForced && !owners.includes("QA/QC Team")) owners.push("QA/QC Team");
      if (
        type === APPROVAL_TYPE &&
        values.approval_type === PURCHASE_TYPE &&
        (values.purchase_amount || 0) > (config.purchase_md_limit || 500) &&
        !owners.includes("MD")
      ) {
        owners.push("MD");
      }

      // Only the visible fields of the selected type are saved.
      const payload = { production_line: values.production_line, owners, evidence_files };
      visibleKeys.forEach((k) => {
        payload[k] = values[k];
      });

      let created;
      if (type === DOWNTIME_TYPE) {
        created = await base44.entities.Downtime.create({ ...payload, status: "Open" });
      } else {
        created = await base44.entities.Request.create({
          ...payload,
          request_type: type,
          requester_name: requesterName,
          requester_id: user?.id || "",
          status: "Submitted",
        });
      }
      await audit("Created", created?.id, `New ${type} submitted${evidence_files.length ? ` with ${evidence_files.length} evidence file(s)` : ""}`);

      // Labelling / Packaging Error: hold the affected product until QA/QC decides.
      if (type === APPROVAL_TYPE && values.approval_type === LABELLING_TYPE) {
        const hold = await base44.entities.ProductHold.create({
          production_line: values.production_line || "",
          shift_date: new Date().toISOString().slice(0, 10),
          product_name: values.product_sku || "",
          batch_number: values.batch_number || "",
          hold_qty: values.qty_produced || 0,
          hold_reason: `Labelling / Packaging Error — ${values.description || "under review"}`.slice(0, 200),
          held_by: requesterName,
          owner: "QA/QC Team",
          status: "Open",
          notes: "Automatically held from the approval request until QA/QC decides.",
        });
        await audit("Created", hold?.id, "Affected product automatically placed on Hold (Labelling / Packaging Error)");
      }

      onOpenChange(false);
    } catch (err) {
      setError(err?.message || "Could not submit the request. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const renderField = (key) => {
    const def = defs[key];
    if (!def) return null;
    const label = FIELD_LABELS[key] || key;
    const required = requiredKeys.includes(key);
    if (def.type === "checkbox") {
      return (
        <div key={key} className="flex items-center gap-2 pt-1">
          <Checkbox id={key} checked={!!values[key]} onCheckedChange={(c) => set(key, c === true)} />
          <Label htmlFor={key} className="text-sm text-[#a0aec0] font-normal">{label}</Label>
        </div>
      );
    }
    return (
      <div key={key} className="space-y-1.5">
        <Label htmlFor={key} className="text-xs text-[#a0aec0]">
          {label} {required && <span className="text-[#ff4d4d]">*</span>}
        </Label>
        {def.type === "select" ? (
          <Select value={values[key] || undefined} onValueChange={(v) => (key === "approval_type" ? setApprovalType(v) : set(key, v))}>
            <SelectTrigger id={key} className="bg-[#0e131d] border-[#1e2740] text-white">
              <SelectValue placeholder={`Select ${label}`} />
            </SelectTrigger>
            <SelectContent>
              {(def.options || []).map((opt) => (
                <SelectItem key={opt} value={opt}>{opt}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : def.type === "textarea" ? (
          <Textarea
            id={key}
            value={values[key] ?? ""}
            onChange={(e) => set(key, e.target.value)}
            className="bg-[#0e131d] border-[#1e2740] text-white min-h-[70px]"
          />
        ) : (
          <Input
            id={key}
            type={def.type === "number" ? "number" : def.type === "date" ? "date" : def.type === "datetime" ? "datetime-local" : "text"}
            value={values[key] ?? ""}
            onChange={(e) => set(key, def.type === "number" ? (e.target.value === "" ? "" : Number(e.target.value)) : e.target.value)}
            className="bg-[#0e131d] border-[#1e2740] text-white"
          />
        )}
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#131926] border-[#1e2740] text-white max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-white">New Request</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs text-[#a0aec0]">
              Request Type <span className="text-[#ff4d4d]">*</span>
            </Label>
            <Select value={type} onValueChange={switchType}>
              <SelectTrigger className="bg-[#0e131d] border-[#1e2740] text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {REQUEST_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-[#a0aec0]">
              Production Line / Area <span className="text-[#ff4d4d]">*</span>
            </Label>
            <Select value={values.production_line || undefined} onValueChange={(v) => set("production_line", v)}>
              <SelectTrigger className="bg-[#0e131d] border-[#1e2740] text-white">
                <SelectValue placeholder="Select Production Line" />
              </SelectTrigger>
              <SelectContent>
                {productionLines.map((l) => (
                  <SelectItem key={l} value={l}>{l}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-[#a0aec0]">Requester</Label>
            <p className="text-sm text-[#e2e8f0] bg-[#0e131d] border border-[#1e2740] rounded-md px-3 py-2">
              {requesterName || "—"} <span className="text-[#a0aec0] text-xs">(auto-filled from login)</span>
            </p>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-[#a0aec0]">
              Owner <span className="text-[#ff4d4d]">*</span>
            </Label>
            <div className="flex flex-wrap gap-4">
              {(config.owner_teams || []).map((t) => (
                <label key={t} className="flex items-center gap-2 text-sm text-[#e2e8f0] cursor-pointer">
                  <Checkbox
                    checked={(values.owners || []).includes(t)}
                    onCheckedChange={(c) => toggleOwner(t, c === true)}
                    disabled={qaForced && t === "QA/QC Team"}
                  />
                  {t}
                </label>
              ))}
            </div>
            {qaForced && (
              <p className="text-[10px] text-[#a0aec0]">Labelling / Packaging Error requests are always routed to the QA/QC Team.</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-[#a0aec0]">
              Evidence / Proof {evidenceRequired && <span className="text-[#ff4d4d]">*</span>}
            </Label>
            <EvidenceUploader files={evidenceFiles} onChange={setEvidenceFiles} />
            {evidenceRequired && <p className="text-[10px] text-[#a0aec0]">A photo is required for this request type.</p>}
          </div>

          {visibleKeys.map(renderField)}

          {error && <p className="text-xs text-[#ff4d4d]">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} className="text-[#a0aec0] hover:text-white hover:bg-white/5">
              Cancel
            </Button>
            <Button type="submit" disabled={saving} className="bg-[#00e5ff] hover:bg-[#00c3d7] text-[#0a0e17]">
              {saving ? "Submitting..." : "Submit Request"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}