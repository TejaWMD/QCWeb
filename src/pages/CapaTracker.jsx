import React from "react";
import { useAuth } from "@/lib/AuthContext";
import { statusChangeGuard } from "@/lib/permissions";
import RecordsTable from "@/components/factoryops/RecordsTable";
import EvidenceLink from "@/components/factoryops/EvidenceLink";
import { productionLines } from "@/lib/shiftLogConstants";

const STATUSES = ["Open", "In Progress", "Overdue", "Completed", "Verified"];

const fields = [
  { key: "title", label: "CAPA Title", type: "text", required: true },
  { key: "source_module", label: "Source", type: "select", options: ["Defect", "Failed HACCP Check", "Downtime Event", "Audit Finding", "Other"] },
  { key: "production_line", label: "Production Line", type: "select", options: productionLines },
  { key: "shift_date", label: "Date Raised", type: "date", required: true },
  { key: "due_date", label: "Due Date", type: "date" },
  { key: "description", label: "Problem", type: "textarea" },
  { key: "root_cause", label: "Root Cause", type: "textarea" },
  { key: "corrective_action", label: "Corrective Action", type: "textarea" },
  { key: "preventive_action", label: "Preventive Action", type: "textarea" },
  { key: "owner", label: "Owner", type: "text" },
  { key: "evidence_file", label: "Evidence Attachment", type: "file" },
  { key: "notes", label: "Notes", type: "textarea" },
];

const columns = [
  { key: "title", label: "CAPA" },
  { key: "source_module", label: "Source" },
  { key: "production_line", label: "Line" },
  { key: "shift_date", label: "Raised" },
  { key: "due_date", label: "Due Date" },
  { key: "owner", label: "Owner" },
  { key: "verified_by", label: "Verified By" },
  { key: "evidence_file_name", label: "Evidence", render: (r) => <EvidenceLink uri={r.evidence_file_uri} name={r.evidence_file_name} /> },
];

// Unified CAPA Tracker: one list of all corrective and preventive actions from
// defects, failed HACCP checks, downtime events and audit findings. A CAPA
// cannot be closed without evidence, or verified without a manager.
export default function CapaTracker() {
  const { user } = useAuth();

  const guard = statusChangeGuard(user, { requireEvidenceToComplete: true, managerVerifies: true });

  return (
    <div className="min-h-screen bg-[#0a0e17] p-4 md:p-6 space-y-4">
      <div>
        <h2 className="text-white text-lg font-semibold">Unified CAPA Tracker</h2>
        <p className="text-[#a0aec0] text-sm mt-1">All corrective and preventive actions. Closure requires evidence; verification requires a manager.</p>
      </div>
      <RecordsTable
        entity="CAPA"
        title="Unified CAPA Tracker"
        subtitle="Raised from defects, failed HACCP checks, downtime events and audit findings"
        addLabel="Raise CAPA"
        columns={columns}
        fields={fields}
        statuses={STATUSES}
        guard={guard}
      />
    </div>
  );
}