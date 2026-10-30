import React from "react";
import { Button } from "@/components/ui/button";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { AlertTriangle, FolderOpen } from "lucide-react";

const STATUS_STYLES = {
  "Overdue": "bg-[#ff4d4d]/15 text-[#ff4d4d]",
  "Pending Verification": "bg-[#ff9f43]/15 text-[#ff9f43]",
  "Open": "bg-[#00e5ff]/15 text-[#00e5ff]",
  "Verified": "bg-[#00ff9d]/15 text-[#00ff9d]",
};

// Every overdue or unverified item across all modules, one row each with an Open button.
export default function CriticalAttentionTable({ items, onOpen }) {
  return (
    <div className="bg-[#131926] rounded-xl border border-[#1e2740]">
      <div className="px-4 py-3 border-b border-[#1e2740] flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-white text-sm font-semibold">
          <AlertTriangle className="w-4 h-4 text-[#ff4d4d]" />
          Critical Attention Required (Overdue &amp; Pending Verification)
        </h3>
        <span className="text-[11px] text-[#ff4d4d] bg-[#ff4d4d]/15 rounded-full px-2.5 py-1 font-medium">
          {items.length} Items
        </span>
      </div>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="border-[#1e2740] hover:bg-transparent">
              <TableHead className="text-[#a0aec0]">Item</TableHead>
              <TableHead className="text-[#a0aec0]">Module</TableHead>
              <TableHead className="text-[#a0aec0]">Owner</TableHead>
              <TableHead className="text-[#a0aec0]">Due Date</TableHead>
              <TableHead className="text-[#a0aec0]">Status</TableHead>
              <TableHead className="text-[#a0aec0] w-[90px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 && (
              <TableRow className="border-[#1e2740]">
                <TableCell colSpan={6} className="text-center text-[#a0aec0] py-8">
                  No overdue or unverified items for this filter. Everything is on track.
                </TableCell>
              </TableRow>
            )}
            {items.map((item, i) => (
              <TableRow key={i} className="border-[#1e2740]">
                <TableCell className="text-white text-sm">{item.item}</TableCell>
                <TableCell className="text-[#a0aec0] text-sm">{item.module}</TableCell>
                <TableCell className="text-[#a0aec0] text-sm">{item.owner || "—"}</TableCell>
                <TableCell className="text-[#a0aec0] text-sm">{item.due || "—"}</TableCell>
                <TableCell>
                  <span className={`text-[11px] font-medium rounded-full px-2.5 py-1 ${STATUS_STYLES[item.status] || STATUS_STYLES["Open"]}`}>
                    {item.status}
                  </span>
                </TableCell>
                <TableCell>
                  <Button size="sm" variant="outline" onClick={() => onOpen(item)} className="bg-transparent border-[#00e5ff]/40 text-[#00e5ff] hover:bg-[#00e5ff]/10 hover:text-[#00e5ff]">
                    <FolderOpen className="w-3.5 h-3.5 mr-1" /> Open
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}