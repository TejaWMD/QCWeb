import React from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Download, X } from "lucide-react";

const FIELD = "bg-[#0e131d] border-[#1e2740] text-white";

const Label = ({ children }) => (
  <label className="text-[10px] uppercase tracking-widest text-[#5f6b7f] font-semibold">{children}</label>
);

// Date range, item code, batch, rack and free-text search across the goods log.
export default function TrackerFilters({ filters, onChange, racks, onExport, exporting }) {
  const set = (key, value) => onChange({ ...filters, [key]: value });
  const clear = () => onChange({ from: "", to: "", item_code: "", batch: "", rack: "", search: "" });

  return (
    <div className="rounded-xl border border-[#1e2740] bg-[#0e131d] p-3 space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#5f6b7f]" />
        <Input
          value={filters.search}
          onChange={(e) => set("search", e.target.value)}
          placeholder="Search item code, description or batch number"
          className={`pl-9 ${FIELD}`}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="space-y-1">
          <Label>From</Label>
          <Input type="date" value={filters.from} onChange={(e) => set("from", e.target.value)} className={FIELD} />
        </div>
        <div className="space-y-1">
          <Label>To</Label>
          <Input type="date" value={filters.to} onChange={(e) => set("to", e.target.value)} className={FIELD} />
        </div>
        <div className="space-y-1">
          <Label>Item Code</Label>
          <Input value={filters.item_code} onChange={(e) => set("item_code", e.target.value)} placeholder="e.g. RM-1001" className={FIELD} />
        </div>
        <div className="space-y-1">
          <Label>Batch Number</Label>
          <Input value={filters.batch} onChange={(e) => set("batch", e.target.value)} placeholder="Batch / lot" className={FIELD} />
        </div>
        <div className="space-y-1">
          <Label>Rack</Label>
          <Select value={filters.rack || undefined} onValueChange={(v) => set("rack", v)}>
            <SelectTrigger className={FIELD}><SelectValue placeholder="All racks" /></SelectTrigger>
            <SelectContent>
              {racks.map((r) => <SelectItem key={r.id} value={r.rack_code}>{r.rack_code}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button variant="ghost" size="sm" onClick={clear} className="text-[#a0aec0] hover:bg-white/5 hover:text-white">
          <X className="w-4 h-4" /> Clear filters
        </Button>
        <Button
          onClick={onExport}
          disabled={exporting}
          size="sm"
          className="ml-auto bg-[#00e5ff] hover:bg-[#00c3d7] text-[#0a0e17]"
        >
          <Download className="w-4 h-4" /> {exporting ? "Exporting..." : "Export CSV"}
        </Button>
      </div>
    </div>
  );
}