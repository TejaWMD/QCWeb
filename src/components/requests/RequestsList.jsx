import React from "react";
import { canChangeRecord } from "@/lib/permissions";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import StatusBadge from "@/components/factoryops/StatusBadge";
import { Paperclip, Trash2 } from "lucide-react";
import { lineCode } from "@/lib/shiftLogConstants";
import { DOWNTIME_TYPE, ITEM_TYPE, TYPE_STYLES, statusesForType } from "@/lib/requestConstants";

const DemoBadge = () => (
  <span className="inline-block text-[10px] font-bold tracking-wider bg-[#ff9f43]/15 text-[#ff9f43] border border-[#ff9f43]/40 rounded px-1.5 py-0.5">DEMO</span>
);

const TypeBadge = ({ type }) => (
  <span className={`inline-block text-[10px] font-semibold tracking-wide border rounded px-1.5 py-0.5 ${TYPE_STYLES[type] || ""}`}>
    {type}
  </span>
);

const Details = ({ row }) => {
  if (row._type === DOWNTIME_TYPE) {
    return (
      <div>
        <p className="text-[#e2e8f0]">{row.reason || "—"}</p>
        {row.category && <p className="text-[#a0aec0] text-xs">{row.category}</p>}
      </div>
    );
  }
  if (row.request_type === ITEM_TYPE) {
    return (
      <div>
        <p className="text-[#e2e8f0]">{row.item_name || "—"}</p>
        <p className="text-[#a0aec0] text-xs">
          {row.quantity || "?"} {row.unit || ""} · needed by {row.needed_by_date || "—"}
        </p>
      </div>
    );
  }
  return (
    <div>
      <p className="text-[#e2e8f0]">{row.approval_type || "—"}</p>
      {row.description && <p className="text-[#a0aec0] text-xs">{row.description}</p>}
    </div>
  );
};

// One merged table for all three request types, each row tagged with its type.
export default function RequestsList({ rows, loading, user, onStatusChange, onRemove }) {
  return (
    <div className="bg-[#131926] rounded-xl border border-[#1e2740]">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="border-[#1e2740] hover:bg-transparent">
              <TableHead className="text-[#a0aec0]">Type</TableHead>
              <TableHead className="text-[#a0aec0]">Line</TableHead>
              <TableHead className="text-[#a0aec0]">Date</TableHead>
              <TableHead className="text-[#a0aec0]">Details</TableHead>
              <TableHead className="text-[#a0aec0]">Owner / Requester</TableHead>
              <TableHead className="text-[#a0aec0]">Status</TableHead>
              <TableHead className="text-[#a0aec0] w-[60px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && (
              <TableRow className="border-[#1e2740]">
                <TableCell colSpan={7} className="text-center text-[#a0aec0] py-8">
                  <span className="inline-block w-5 h-5 border-2 border-[#1e2740] border-t-[#00e5ff] rounded-full animate-spin" />
                </TableCell>
              </TableRow>
            )}
            {!loading && rows.length === 0 && (
              <TableRow className="border-[#1e2740]">
                <TableCell colSpan={7} className="text-center text-[#a0aec0] py-8">
                  No requests yet.
                </TableCell>
              </TableRow>
            )}
            {!loading && rows.map((row) => (
              <TableRow key={row.id} className="border-[#1e2740]">
                <TableCell>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <TypeBadge type={row._type} />
                    {row.is_demo && <DemoBadge />}
                    {(row.evidence_files || []).length > 0 && (
                      <span className="inline-flex items-center gap-0.5 text-[10px] text-[#a0aec0] border border-[#3a4560] bg-[#3a4560]/20 rounded px-1.5 py-0.5">
                        <Paperclip className="w-3 h-3" />{row.evidence_files.length}
                      </span>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-sm text-[#e2e8f0]">{lineCode(row.production_line || "") || "—"}</TableCell>
                <TableCell className="text-sm text-[#e2e8f0]">{row.shift_date || "—"}</TableCell>
                <TableCell><Details row={row} /></TableCell>
                <TableCell>
                  {row._type === DOWNTIME_TYPE ? (
                    <span className="text-sm text-[#e2e8f0]">
                      {(row.owners || []).length ? row.owners.join(", ") : row.owner || "—"}
                    </span>
                  ) : (
                    <div>
                      <p className="text-sm text-[#e2e8f0]">{(row.owners || []).join(", ") || "—"}</p>
                      <p className="text-[#a0aec0] text-xs">by {row.requester_name || "—"}</p>
                    </div>
                  )}
                </TableCell>
                <TableCell>
                  {canChangeRecord(user, row) ? (
                    <Select value={row.status || statusesForType(row)[0]} onValueChange={(v) => onStatusChange(row, v)}>
                      <SelectTrigger className="h-8 w-[150px] bg-[#0e131d] border-[#1e2740] text-white text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {statusesForType(row).map((s) => (
                          <SelectItem key={s} value={s}>{s}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <StatusBadge status={row.status} />
                  )}
                </TableCell>
                <TableCell>
                  {canChangeRecord(user, row) && (
                    <Button size="sm" variant="ghost" onClick={() => onRemove(row)} className="text-[#ff4d4d] hover:text-[#ff4d4d] hover:bg-[#ff4d4d]/10 h-8 w-8 p-0">
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}