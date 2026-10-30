import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CheckCircle2, XCircle, ShieldAlert } from "lucide-react";
import { canApproveStock, decideApproval, fmtQty } from "@/lib/packaging";

const STATUS_STYLES = {
  Pending: "bg-[#ff9f43]/15 text-[#ff9f43] border-[#ff9f43]/40",
  Approved: "bg-[#00ff9d]/10 text-[#00ff9d] border-[#00ff9d]/30",
  Rejected: "bg-[#ff4d4d]/15 text-[#ff4d4d] border-[#ff4d4d]/40",
};

export default function PackagingApprovals() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [rows, setRows] = useState([]);
  const [comments, setComments] = useState({});
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");

  const load = async () => {
    const page = await base44.entities.PackagingApproval.filter({}, { sort: "-created_date", limit: 200 });
    setRows(page.items || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const decide = async (approval, decision) => {
    const comment = comments[approval.id] || "";
    if (decision === "Rejected" && !comment.trim()) {
      toast({ title: "Comment required", description: "Add a comment explaining the rejection.", variant: "destructive" });
      return;
    }
    setBusyId(approval.id);
    try {
      await decideApproval({ approval, decision, comment, user });
      toast({ title: `Request ${decision.toLowerCase()}`, description: `${approval.item_code} updated.` });
      await load();
    } catch (e) {
      toast({ title: "Could not save the decision", description: e?.message || "Please try again.", variant: "destructive" });
    } finally {
      setBusyId("");
    }
  };

  const canDecide = canApproveStock(user);
  const pending = rows.filter((r) => r.status === "Pending");
  const decided = rows.filter((r) => r.status !== "Pending");

  const renderCard = (a, isPending) => (
    <div key={a.id} className="rounded-xl border border-[#1e2740] bg-[#0e131d] p-3 space-y-2">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-white text-sm font-semibold">{a.item_code} · {a.item_name}</p>
          <p className="text-[11px] text-[#5f6b7f] mt-0.5">{a.approval_type}</p>
        </div>
        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${STATUS_STYLES[a.status] || ""}`}>{a.status}</span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
        <div>
          <p className="text-[10px] uppercase tracking-widest text-[#5f6b7f]">System</p>
          <p className="text-[#a0aec0]">{fmtQty(a.system_qty)} {a.unit}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-widest text-[#5f6b7f]">{a.approval_type === "Stock Adjustment" ? "Counted" : "Issue qty"}</p>
          <p className="text-white font-medium">{fmtQty(a.requested_qty)} {a.unit}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-widest text-[#5f6b7f]">Difference</p>
          <p className={Number(a.difference) === 0 ? "text-[#a0aec0]" : "text-[#ff9f43] font-medium"}>
            {Number(a.difference) > 0 ? "+" : ""}{fmtQty(a.difference)}
          </p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-widest text-[#5f6b7f]">Batch</p>
          <p className="text-[#a0aec0]">{a.batch_number || "—"}</p>
        </div>
      </div>

      {a.reason && <p className="text-xs text-[#a0aec0]">Reason: {a.reason}</p>}
      {a.production_order && <p className="text-xs text-[#5f6b7f]">Order: {a.production_order}{a.production_line ? ` · ${a.production_line}` : ""}</p>}

      <p className="text-[11px] text-[#5f6b7f]">
        Requested by {a.requested_by || "—"} · {(a.requested_date || a.created_date || "").slice(0, 16).replace("T", " ")}
        {a.decided_by ? ` · ${a.status} by ${a.decided_by}` : ""}
      </p>
      {a.decision_comment && <p className="text-[11px] text-[#a0aec0]">Comment: {a.decision_comment}</p>}

      {isPending && canDecide && (
        <div className="flex flex-col sm:flex-row gap-2 pt-1">
          <Input
            value={comments[a.id] || ""}
            onChange={(e) => setComments((c) => ({ ...c, [a.id]: e.target.value }))}
            placeholder="Comment (required to reject)"
            className="bg-[#0a0e17] border-[#1e2740] text-white"
          />
          <div className="flex gap-2">
            <Button onClick={() => decide(a, "Approved")} disabled={busyId === a.id} className="bg-[#00ff9d] hover:bg-[#00e08a] text-[#0a0e17] font-semibold">
              <CheckCircle2 className="w-4 h-4" /> Approve
            </Button>
            <Button onClick={() => decide(a, "Rejected")} disabled={busyId === a.id} variant="outline" className="border-[#ff4d4d]/50 bg-transparent text-[#ff4d4d] hover:bg-[#ff4d4d]/10">
              <XCircle className="w-4 h-4" /> Reject
            </Button>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0a0e17] p-4 md:p-6 space-y-4">
      <div>
        <h2 className="text-white text-lg font-semibold">Stock Approvals</h2>
        <p className="text-[#a0aec0] text-sm mt-1">Stock count adjustments and issues above the approval threshold.</p>
      </div>

      {!canDecide && (
        <div className="rounded-xl border border-[#1e2740] bg-[#101828] px-4 py-3 flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-[#00e5ff]" />
          <p className="text-xs text-[#a0aec0]">Only a Warehouse Supervisor or Admin can approve or reject these requests.</p>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-[#1e2740] border-t-[#00e5ff] rounded-full animate-spin" />
        </div>
      ) : (
        <>
          <div className="space-y-2">
            <h3 className="text-[10px] uppercase tracking-widest text-[#5f6b7f] font-semibold">Pending ({pending.length})</h3>
            {pending.length === 0 ? (
              <div className="rounded-xl border border-[#1e2740] bg-[#0e131d] p-6 text-center text-sm text-[#a0aec0]">Nothing waiting for approval.</div>
            ) : (
              pending.map((a) => renderCard(a, true))
            )}
          </div>

          {decided.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-[10px] uppercase tracking-widest text-[#5f6b7f] font-semibold">Recent decisions</h3>
              {decided.slice(0, 20).map((a) => renderCard(a, false))}
            </div>
          )}
        </>
      )}
    </div>
  );
}