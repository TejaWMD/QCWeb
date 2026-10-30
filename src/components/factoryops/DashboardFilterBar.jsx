import React from "react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Filter, RotateCcw } from "lucide-react";
import { productionLines } from "@/lib/shiftLogConstants";

// Global filter bar of the Attention Dashboard. Values are controlled by the page.
export default function DashboardFilterBar({ date, shift, line, status, onChange, onReset }) {
  return (
    <div className="bg-[#131926] rounded-xl border border-[#1e2740] px-4 py-3 flex flex-wrap items-center gap-3">
      <span className="flex items-center gap-1.5 text-sm text-[#00e5ff] font-medium">
        <Filter className="w-4 h-4" /> Global Filters:
      </span>
      <Input
        type="date"
        value={date}
        onChange={(e) => onChange("date", e.target.value)}
        className="w-[160px] bg-[#0e131d] border-[#1e2740] text-white"
      />
      <Select value={shift} onValueChange={(v) => onChange("shift", v)}>
        <SelectTrigger className="w-[160px] bg-[#0e131d] border-[#1e2740] text-white">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Shifts</SelectItem>
          <SelectItem value="Morning">Shift A (Day)</SelectItem>
          <SelectItem value="Night">Shift B (Night)</SelectItem>
        </SelectContent>
      </Select>
      <Select value={line} onValueChange={(v) => onChange("line", v)}>
        <SelectTrigger className="w-[240px] bg-[#0e131d] border-[#1e2740] text-white">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Production Lines</SelectItem>
          {productionLines.map((l) => (
            <SelectItem key={l} value={l}>{l}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={status} onValueChange={(v) => onChange("status", v)}>
        <SelectTrigger className="w-[150px] bg-[#0e131d] border-[#1e2740] text-white">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Statuses</SelectItem>
          <SelectItem value="Open">Open</SelectItem>
          <SelectItem value="Overdue">Overdue</SelectItem>
          <SelectItem value="Verified">Verified</SelectItem>
        </SelectContent>
      </Select>
      <Button variant="ghost" onClick={onReset} className="text-[#a0aec0] hover:text-white hover:bg-white/5">
        <RotateCcw className="w-3.5 h-3.5 mr-1" /> Reset
      </Button>
    </div>
  );
}