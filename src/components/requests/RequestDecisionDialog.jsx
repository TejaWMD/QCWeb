import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { actingUserName } from "@/lib/permissions";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Clock, CheckCircle2, XCircle, Undo2 } from "lucide-react";
import { TYPE_STYLES, requestSummary } from "@/lib/requestConstants";

const eventStamp = () => {
  const d = new Date();
  return `${d.toISOString().slice(0, 10)} ${d.toTimeString().slice(0, 8)}`;
};

const DECISIONS = {
  Approve: { status: "Approved", verb: "approved", comment: false },
  Reject: { status: "Rejected", verb: "rejected", comment: true },
  Return: { status: "Returned for more info", verb: "returned", comment: true },
};

// Owner decision dialog: Approve, Reject or Return with a comment (required
// for Reject and Return). Records who decided and when, and blocks the
// requester from deciding on their own request.
export default function RequestDecisionDialog({ open, onOpenChange, request, user }) {
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setComment("");
      setError("");
    }
  }, [open]);

  if (!request) return null;

  const decide = async (action) => {
    if (request.requester_id === user?.id) {
      setError("You cannot decide on your own request.");
      return;
    }
    const d = action === "Start Review"
      ? { status: "Under Review", verb: "moved to Under Review", comment: false }
      : DECISIONS[action];
    if (d.comment && !comment.trim()) {
      setError("A comment is required to reject or return a request.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const prev = request.status;
      const name = user?.full_name || user?.email || "";
      await base44.entities.Request.update(request.id, {
        status: d.status,
        decided_by: name,
        decided_by_id: user?.id || "",
        decided_date: new Date().toISOString(),
        decision_comment: comment.trim(),
      });
      try {
        await base44.entities.AuditLog.create({
          event_time: new Date().toISOString(),
          event_stamp: eventStamp(),
          user_name: actingUserName(user),
          module: "Requests & Stoppages",
          action: "Updated",
          record_id: request.id,
          details: `Request "${requestSummary(request)}" ${d.verb} by ${name}${comment.trim() ? ` — comment: ${comment.trim()}` : ""}`,
          old_value: prev,
          new_value: d.status,
        });
      } catch {
        // An audit write must never block the decision.
      }
      onOpenChange(false);
    } catch (err) {
      setError(err?.message || "Could not record the decision. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#131926] border-[#1e2740] text-white max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-white">Review Request</DialogTitle>
        </DialogHeader>
        <div className="space-y-2 rounded-lg bg-[#0e131d] border border-[#1e2740] p-3 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`inline-block text-[10px] font-semibold border rounded px-1.5 py-0.5 ${TYPE_STYLES[request.request_type] || ""}`}>
              {request.request_type}
            </span>
            <span className="text-[#a0aec0] text-xs">
              from {request.requester_name || "—"} · {request.production_line || "—"} · {request.shift_date || "—"}
            </span>
          </div>
          <p className="text-white font-medium">{requestSummary(request)}</p>
          {request.reason && <p className="text-[#a0aec0] text-xs">Reason: {request.reason}</p>}
          {request.decision_comment && (
            <p className="text-[#a0aec0] text-xs">Previous decision comment: {request.decision_comment}</p>
          )}
          <p className="text-[#a0aec0] text-xs">Current status: {request.status}</p>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-[#a0aec0]">Comment (required to Reject or Return)</Label>
          <Textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            className="bg-[#0e131d] border-[#1e2740] text-white min-h-[70px]"
          />
        </div>
        {error && <p className="text-xs text-[#ff4d4d]">{error}</p>}
        <DialogFooter className="sm:flex-wrap gap-2">
          {request.status === "Submitted" && (
            <Button type="button" disabled={saving} onClick={() => decide("Start Review")} className="bg-[#0e131d] border border-[#1e2740] text-[#a0aec0] hover:text-white">
              <Clock className="w-4 h-4 mr-1" /> Start Review
            </Button>
          )}
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} className="text-[#a0aec0] hover:text-white hover:bg-white/5">
            Cancel
          </Button>
          <Button type="button" disabled={saving} onClick={() => decide("Approve")} className="bg-[#00ff9d] hover:bg-[#00e58f] text-[#0a0e17]">
            <CheckCircle2 className="w-4 h-4 mr-1" /> Approve
          </Button>
          <Button type="button" disabled={saving} onClick={() => decide("Return")} className="bg-[#ff9f43] hover:bg-[#f58a1f] text-[#0a0e17]">
            <Undo2 className="w-4 h-4 mr-1" /> Return
          </Button>
          <Button type="button" disabled={saving} onClick={() => decide("Reject")} className="bg-[#ff4d4d] hover:bg-[#e53939] text-white">
            <XCircle className="w-4 h-4 mr-1" /> Reject
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}