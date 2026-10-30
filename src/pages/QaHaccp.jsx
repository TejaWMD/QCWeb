import React from "react";
import { useAuth } from "@/lib/AuthContext";
import { appRoleOf, statusChangeGuard } from "@/lib/permissions";
import RecordsTable from "@/components/factoryops/RecordsTable";
import EvidenceLink from "@/components/factoryops/EvidenceLink";
import { createCapaDraft } from "@/lib/capaDraft";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { productionLines, lineCode } from "@/lib/shiftLogConstants";
import { CheckCircle2, XCircle } from "lucide-react";

const STATUSES = ["Open", "In Progress", "Overdue", "Completed", "Verified"];

const lineCol = { key: "production_line", label: "Line", render: (r) => lineCode(r.production_line || "") || "—" };
const dateCol = { key: "shift_date", label: "Date" };
const dueCol = { key: "due_date", label: "Due" };

// Every QA record points at a Product Master item; older records only carry a name.
const productCol = {
  key: "product_code",
  label: "Item",
  render: (r) =>
    r.product_code ? (
      <span className="block max-w-[180px]">
        <span className="text-white font-medium">{r.product_code}</span>
        <span className="block text-[10px] text-[#5f6b7f] truncate">{r.product_name || ""}</span>
      </span>
    ) : (
      r.product_name || "—"
    ),
};
const ownerCol = { key: "owner", label: "Owner" };
const evidenceCol = { key: "evidence_file_name", label: "Evidence", render: (r) => <EvidenceLink uri={r.evidence_file_uri} name={r.evidence_file_name} /> };

const resultCol = {
  key: "result",
  label: "Result",
  render: (r) =>
    r.result === "Pass" ? <span className="text-[#00ff9d]">Pass</span>
    : r.result === "Fail" ? <span className="text-[#ff4d4d]">Fail</span>
    : <span className="text-[#a0aec0]">Pending</span>,
};

// A HACCP/CCP check is automatically marked Overdue when its scheduled
// date/time has passed and it is still Pending and not completed.
const checkOverdue = (r, today) => {
  const nowHM = new Date().toTimeString().slice(0, 5);
  return (
    r.result === "Pending" &&
    !!r.due_date &&
    (r.due_date < today || (r.due_date === today && !!r.scheduled_time && r.scheduled_time < nowHM))
  );
};

// QA & HACCP Safety. Operators and Line Leaders see the Defects tab only;
// QA Officers, Production Managers and Admins manage every tab. A failed HACCP
// critical limit or an active product hold automatically creates a CAPA draft.
export default function QaHaccp() {
  const { user } = useAuth();
  const role = appRoleOf(user);
  const canManageQa = !role || ["admin", "manager", "qa_officer"].includes(role);

  const paramTab = new URLSearchParams(window.location.search).get("tab");
  const tabAllowed = (t) => t === "defects" || canManageQa;
  const initialTab = ["checks", "holds", "defects", "halal"].includes(paramTab) && tabAllowed(paramTab)
    ? paramTab
    : canManageQa ? "checks" : "defects";

  const guard = statusChangeGuard(user, { managerVerifies: true });

  const draftFromCheck = (record) => {
    if (!record || record.result !== "Fail" || record.status === "Verified") return;
    createCapaDraft(user, {
      title: `HACCP failure: ${record.check_name}`,
      source_module: "Failed HACCP Check",
      production_line: record.production_line,
      shift_date: record.shift_date,
      description: `Critical limit check "${record.check_name}" failed (critical limit: ${record.critical_limit || "—"}).`,
      source_record_id: record.id,
    });
  };

  const draftFromHold = (record) => {
    if (!record || ["Completed", "Verified"].includes(record.status)) return;
    createCapaDraft(user, {
      title: `Product hold: ${record.product_name || record.batch_number || "batch"}`,
      source_module: "Product Hold",
      production_line: record.production_line,
      shift_date: record.shift_date,
      description: `Product held: ${record.hold_reason}`,
      source_record_id: record.id,
    });
  };

  const lineDefault = user?.line || undefined;

  const checkFields = [
    { key: "check_name", label: "Check Name", type: "text", required: true },
    { key: "production_line", label: "Production Line", type: "select", options: productionLines, required: true, default: lineDefault },
    { key: "shift_date", label: "Shift Date", type: "date", required: true },
    { key: "shift_type", label: "Shift", type: "select", options: ["Morning", "Night"], default: "Morning" },
    { key: "due_date", label: "Due Date", type: "date" },
    { key: "scheduled_time", label: "Scheduled Time (HH:MM)", type: "text" },
    { key: "critical_limit", label: "Critical Limit Value", type: "text" },
    { key: "result", label: "Result", type: "select", options: ["Pending", "Pass", "Fail"], default: "Pending" },
    { key: "checked_by", label: "Checked By", type: "text" },
    { key: "owner", label: "Owner", type: "text" },
    { key: "evidence_file", label: "Evidence Attachment", type: "file" },
    { key: "notes", label: "Notes", type: "textarea" },
  ];

  const holdFields = [
    { key: "production_line", label: "Production Line", type: "select", options: productionLines, required: true, default: lineDefault },
    { key: "shift_date", label: "Date Held", type: "date", required: true },
    { key: "product", label: "Product (Product Master)", type: "product" },
    { key: "batch_number", label: "Batch", type: "batch" },
    { key: "hold_qty", label: "Qty on Hold", type: "number" },
    { key: "hold_reason", label: "Hold Reason", type: "textarea", required: true },
    { key: "held_by", label: "Held By", type: "text" },
    { key: "owner", label: "Owner", type: "text" },
    { key: "due_date", label: "Disposition Due", type: "date" },
    { key: "release_approval", label: "Release Approved By", type: "text" },
    { key: "released_date", label: "Released Date", type: "date" },
    { key: "evidence_file", label: "Evidence Attachment", type: "file" },
    { key: "notes", label: "Notes", type: "textarea" },
  ];

  const defectFields = [
    { key: "production_line", label: "Production Line", type: "select", options: productionLines, required: true, default: lineDefault },
    { key: "shift_date", label: "Shift Date", type: "date", required: true },
    { key: "shift_type", label: "Shift", type: "select", options: ["Morning", "Night"], default: "Morning" },
    { key: "product", label: "Product (Product Master)", type: "product" },
    { key: "batch_number", label: "Batch", type: "batch" },
    { key: "defect_type", label: "Defect Type", type: "text", required: true },
    { key: "defect_qty", label: "Defect Qty", type: "number" },
    { key: "severity", label: "Severity", type: "select", options: ["Minor", "Major", "Critical"], default: "Minor" },
    { key: "detected_by", label: "Detected By", type: "text" },
    { key: "owner", label: "Owner", type: "text" },
    { key: "due_date", label: "Disposition Due", type: "date" },
    { key: "evidence_file", label: "Evidence Attachment", type: "file" },
    { key: "notes", label: "Notes", type: "textarea" },
  ];

  const halalFields = [
    { key: "item_type", label: "Item Type", type: "select", options: ["Batch", "Ingredient"], default: "Batch" },
    { key: "product", label: "Product (Product Master)", type: "product" },
    { key: "item_name", label: "Batch Number / Ingredient", type: "text", required: true },
    { key: "production_line", label: "Production Line", type: "select", options: productionLines, default: lineDefault },
    { key: "shift_date", label: "Date", type: "date", required: true },
    { key: "due_date", label: "Due Date", type: "date" },
    { key: "verified", label: "Halal Verified", type: "checkbox" },
    { key: "verifier", label: "Verifier", type: "text" },
    { key: "owner", label: "Owner", type: "text" },
    { key: "certificate_file", label: "Halal Certificate", type: "file" },
    { key: "notes", label: "Notes", type: "textarea" },
  ];

  const tabTrigger = (value, label) => (
    <TabsTrigger value={value} className="data-[state=active]:bg-[#00e5ff] data-[state=active]:text-[#0a0e17] text-[#a0aec0]">{label}</TabsTrigger>
  );

  return (
    <div className="min-h-screen bg-[#0a0e17] p-4 md:p-6 space-y-4">
      <div>
        <h2 className="text-white text-lg font-semibold">QA &amp; HACCP Safety</h2>
        <p className="text-[#a0aec0] text-sm mt-1">CCP checks, product holds, defects and halal verification, with evidence on every record.</p>
      </div>
      <Tabs defaultValue={initialTab}>
        <TabsList className="bg-[#131926] border border-[#1e2740] flex-wrap h-auto">
          {canManageQa && tabTrigger("checks", "HACCP / CCP Checks")}
          {canManageQa && tabTrigger("holds", "Product Holds")}
          {tabTrigger("defects", "Defects")}
          {canManageQa && tabTrigger("halal", "Halal Verification")}
        </TabsList>

        {canManageQa && (
          <TabsContent value="checks" className="mt-3">
            <RecordsTable
              entity="HACCPCheck"
              title="HACCP / CCP Checks"
              subtitle="Checks become Overdue automatically when not done by the scheduled time; a failed limit creates a CAPA draft"
              addLabel="Add Check"
              columns={[
                { key: "check_name", label: "Check" },
                lineCol,
                dateCol,
                { key: "scheduled_time", label: "Scheduled" },
                { key: "critical_limit", label: "Critical Limit" },
                resultCol,
                { key: "checked_by", label: "Checked By" },
                ownerCol,
                dueCol,
                evidenceCol,
              ]}
              fields={checkFields}
              statuses={STATUSES}
              markOverdue={checkOverdue}
              guard={guard}
              onAfterCreate={draftFromCheck}
              onAfterChange={draftFromCheck}
            />
          </TabsContent>
        )}

        {canManageQa && (
          <TabsContent value="holds" className="mt-3">
            <RecordsTable
              entity="ProductHold"
              title="Product Holds"
              subtitle="Held batches with reason, holder and release approval; an active hold creates a CAPA draft"
              addLabel="Add Hold"
              columns={[
                lineCol,
                dateCol,
                productCol,
                { key: "batch_number", label: "Batch" },
                { key: "hold_qty", label: "Qty" },
                { key: "hold_reason", label: "Reason" },
                { key: "held_by", label: "Held By" },
                { key: "release_approval", label: "Release Approval" },
                ownerCol,
                dueCol,
                evidenceCol,
              ]}
              fields={holdFields}
              statuses={STATUSES}
              guard={guard}
              onAfterCreate={draftFromHold}
              onAfterChange={draftFromHold}
            />
          </TabsContent>
        )}

        <TabsContent value="defects" className="mt-3">
          <RecordsTable
            entity="QualityDefect"
            title="Defects"
            subtitle="Defects found on the lines, by type, quantity and batch"
            addLabel="Add Defect"
            columns={[
              lineCol,
              dateCol,
              productCol,
              { key: "batch_number", label: "Batch" },
              { key: "defect_type", label: "Defect Type" },
              { key: "defect_qty", label: "Qty" },
              { key: "severity", label: "Severity" },
              { key: "detected_by", label: "Detected By" },
              ownerCol,
              dueCol,
              evidenceCol,
            ]}
            fields={defectFields}
            statuses={STATUSES}
            guard={guard}
          />
        </TabsContent>

        {canManageQa && (
          <TabsContent value="halal" className="mt-3">
            <RecordsTable
              entity="HalalVerification"
              title="Halal Verification"
              subtitle="Batch and ingredient halal status with certificate attachments"
              addLabel="Add Verification"
              columns={[
                { key: "item_type", label: "Type" },
                productCol,
                { key: "item_name", label: "Batch / Ingredient" },
                lineCol,
                dateCol,
                {
                  key: "verified",
                  label: "Verified",
                  render: (r) => r.verified
                    ? <span className="inline-flex items-center gap-1 text-[#00ff9d] text-xs"><CheckCircle2 className="w-3.5 h-3.5" /> Yes</span>
                    : <span className="inline-flex items-center gap-1 text-[#ff4d4d] text-xs"><XCircle className="w-3.5 h-3.5" /> No</span>,
                },
                { key: "verifier", label: "Verifier" },
                {
                  key: "certificate_file_name",
                  label: "Certificate",
                  render: (r) => <EvidenceLink uri={r.certificate_file_uri} name={r.certificate_file_name} />,
                },
                ownerCol,
                dueCol,
              ]}
              fields={halalFields}
              statuses={STATUSES}
              guard={guard}
            />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}