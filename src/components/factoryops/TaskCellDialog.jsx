import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { actingUserName, canChangeRecord, isManagerRole } from "@/lib/permissions";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import EvidenceUpload from "@/components/factoryops/EvidenceUpload";
import StatusBadge from "@/components/factoryops/StatusBadge";
import { PlayCircle, BadgeCheck, Lock } from "lucide-react";

const eventStamp = () => {
  const d = new Date();
  return `${d.toISOString().slice(0, 10)} ${d.toTimeString().slice(0, 8)}`;
};

// Task cell detail dialog from the Task Matrix: a supervisor can only close a
// task by attaching evidence; a manager (admin) then marks it Verified.
export default function TaskCellDialog({ task, onOpenChange, onUpdated }) {
  const { user } = useAuth();
  const [evidence, setEvidence] = useState({ uri: "", name: "" });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setEvidence({ uri: task?.evidence_file_uri || "", name: task?.evidence_file_name || "" });
  }, [task?.id]);

  if (!task) return null;

  const isManager = isManagerRole(user);
  const canEdit = canChangeRecord(user, task);
  const hasEvidence = !!evidence.uri;
  const me = (user?.full_name || user?.email || "").trim().toLowerCase();
  const isOwner = !!(task.owner && me && task.owner.trim().toLowerCase() === me);

  const audit = async (status, oldStatus) => {
    try {
      await base44.entities.AuditLog.create({
        event_time: new Date().toISOString(),
        event_stamp: eventStamp(),
        user_name: actingUserName(user),
        module: "Supervisor Task Matrix",
        action: status === "Verified" ? "Verified" : "Updated",
        record_id: task.id,
        details: `Task "${task.title}" marked ${status}`,
        old_value: oldStatus,
        new_value: status,
      });
    } catch {
      // An audit write must never block the operation itself.
    }
  };

  const update = async (status) => {
    if (status === "Verified" && isOwner) {
      window.alert("The verifier cannot be the owner of this item.");
      return;
    }
    setBusy(true);
    try {
      const oldStatus = task.status || "";
      await base44.entities.Task.update(task.id, {
        status,
        evidence_file_uri: evidence.uri || undefined,
        evidence_file_name: evidence.name || undefined,
      });
      await audit(status, oldStatus);
      onUpdated();
      onOpenChange(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={!!task} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#131926] border-[#1e2740] text-white sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-white">{task.title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div><span className="text-[#a0aec0]">Supervisor:</span> <span className="text-[#e2e8f0]">{task.owner || "Unassigned"}</span></div>
            <div><span className="text-[#a0aec0]">Module:</span> <span className="text-[#e2e8f0]">{task.module || "—"}</span></div>
            <div><span className="text-[#a0aec0]">Due Date:</span> <span className="text-[#e2e8f0]">{task.due_date || "—"}</span></div>
            <div><span className="text-[#a0aec0]">Priority:</span> <span className="text-[#e2e8f0]">{task.priority || "—"}</span></div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[#a0aec0] text-xs">Status:</span>
            <StatusBadge status={task.status} />
          </div>
          {task.notes && <p className="text-xs text-[#a0aec0] bg-[#0e131d] border border-[#1e2740] rounded-md p-2.5">{task.notes}</p>}
          <EvidenceUpload value={evidence} onChange={setEvidence} label="Evidence Attachment (required to close)" />
          <p className="text-[11px] text-[#a0aec0] flex items-start gap-1.5">
            <Lock className="w-3.5 h-3.5 shrink-0 mt-0.5 text-[#00e5ff]" />
            A task can only be closed by uploading evidence. A manager then marks it Verified.
          </p>
        </div>
        <DialogFooter className="gap-2">
          {task.status === "Open" && canEdit && (
            <Button disabled={busy} onClick={() => update("In Progress")} className="bg-[#00e5ff] hover:bg-[#00c3d7] text-[#0a0e17]">
              <PlayCircle className="w-4 h-4 mr-1" /> Start Task
            </Button>
          )}
          {canEdit && !["Completed", "Verified"].includes(task.status) && (
            <Button disabled={busy || !hasEvidence} onClick={() => update("Completed")} className="bg-[#ff9f43] hover:bg-[#ff8c1a] text-[#0a0e17]">
              <BadgeCheck className="w-4 h-4 mr-1" /> Upload Evidence &amp; Complete
            </Button>
          )}
          {isManager && (
            <Button
              disabled={busy || !hasEvidence || task.status !== "Completed"}
              onClick={() => update("Verified")}
              className="bg-[#00ff9d] hover:bg-[#00e08a] text-[#0a0e17]"
            >
              <BadgeCheck className="w-4 h-4 mr-1" /> Mark Verified
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}