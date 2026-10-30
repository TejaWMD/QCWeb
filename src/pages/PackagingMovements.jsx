import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download } from "lucide-react";
import { MOVEMENT_CSV_COLUMNS, MOVEMENT_TYPES, fmtQty, loadPackagingSettings } from "@/lib/packaging";
import { downloadCsv } from "@/lib/warehouse";

const FIELD = "bg-[#0e131d] border-[#1e2740] text-white";
const EMPTY = { from: "", to: "", item: "all", category: "all", type: "all", user: "all" };

const TYPE_STYLES = {
  In: "text-[#00ff9d]",
  Use: "text-[#00e5ff]",
  Adjustment: "text-[#ff9f43]",
};

const buildQuery = (f) => {
  const query = {};
  const range = {};
  if (f.from) range.$gte = f.from;
  if (f.to) range.$lte = f.to;
  if (Object.keys(range).length) query.movement_date = range;
  if (f.item !== "all") query.item_id = f.item;
  if (f.category !== "all") query.category = f.category;
  if (f.type !== "all") query.type = f.type;
  if (f.user !== "all") query.user_name = f.user;
  return query;
};

export default function PackagingMovements() {
  const [filters, setFilters] = useState(EMPTY);
  const [rows, setRows] = useState([]);
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [users, setUsers] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    (async () => {
      const [itemRows, settings] = await Promise.all([
        base44.entities.PackagingItem.list("item_code", 500),
        loadPackagingSettings(),
      ]);
      setItems(Array.isArray(itemRows) ? itemRows : []);
      setCategories(settings.categories);
      try {
        const distinct = await base44.entities.PackagingMovement.list({ distinct: "user_name" });
        setUsers((distinct.items || []).filter(Boolean));
      } catch {
        setUsers([]);
      }
    })();
  }, []);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const page = await base44.entities.PackagingMovement.filter(buildQuery(filters), { sort: "-created_date", limit: 100 });
        if (!alive) return;
        setRows(page.items || []);
        setCursor(page.next_cursor || null);
        setHasMore(!!page.has_more);
      } finally {
        if (alive) setLoading(false);
      }
    }, 250);
    return () => { alive = false; clearTimeout(timer); };
  }, [filters]);

  const loadMore = async () => {
    if (!cursor) return;
    setLoadingMore(true);
    try {
      const page = await base44.entities.PackagingMovement.filter(buildQuery(filters), { sort: "-created_date", limit: 100, cursor });
      setRows((prev) => [...prev, ...(page.items || [])]);
      setCursor(page.next_cursor || null);
      setHasMore(!!page.has_more);
    } finally {
      setLoadingMore(false);
    }
  };

  const exportCsv = async () => {
    setExporting(true);
    try {
      const page = await base44.entities.PackagingMovement.filter(buildQuery(filters), { sort: "-created_date", limit: 1000 });
      downloadCsv(`stock-movements-${new Date().toISOString().slice(0, 10)}.csv`, MOVEMENT_CSV_COLUMNS, page.items || []);
    } finally {
      setExporting(false);
    }
  };

  const set = (key, value) => setFilters((f) => ({ ...f, [key]: value }));

  return (
    <div className="min-h-screen bg-[#0a0e17] p-4 md:p-6 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-white text-lg font-semibold">Stock Movements</h2>
          <p className="text-[#a0aec0] text-sm mt-1">Every stock in, use and adjustment. Movements cannot be edited or deleted — corrections are adjustments.</p>
        </div>
        <Button onClick={exportCsv} disabled={exporting} variant="outline" className="border-[#1e2740] bg-[#0e131d] text-[#a0aec0] hover:bg-white/5 hover:text-white">
          <Download className="w-4 h-4" /> {exporting ? "Exporting..." : "Export CSV"}
        </Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-6 gap-2">
        <Input type="date" value={filters.from} onChange={(e) => set("from", e.target.value)} className={FIELD} />
        <Input type="date" value={filters.to} onChange={(e) => set("to", e.target.value)} className={FIELD} />
        <Select value={filters.item} onValueChange={(v) => set("item", v)}>
          <SelectTrigger className={FIELD}><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All items</SelectItem>
            {items.map((i) => <SelectItem key={i.id} value={i.id}>{i.item_code}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filters.category} onValueChange={(v) => set("category", v)}>
          <SelectTrigger className={FIELD}><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filters.type} onValueChange={(v) => set("type", v)}>
          <SelectTrigger className={FIELD}><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            {MOVEMENT_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filters.user} onValueChange={(v) => set("user", v)}>
          <SelectTrigger className={FIELD}><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All users</SelectItem>
            {users.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-xl border border-[#1e2740] bg-[#0e131d] p-3">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs text-[#5f6b7f]">{loading ? "Loading…" : `${rows.length} movement${rows.length === 1 ? "" : "s"} shown`}</p>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-[#1e2740] hover:bg-transparent">
                <TableHead className="text-[#5f6b7f]">Date</TableHead>
                <TableHead className="text-[#5f6b7f]">Item</TableHead>
                <TableHead className="text-[#5f6b7f]">Type</TableHead>
                <TableHead className="text-[#5f6b7f] text-right">Qty</TableHead>
                <TableHead className="text-[#5f6b7f]">Batch</TableHead>
                <TableHead className="text-[#5f6b7f]">Rack</TableHead>
                <TableHead className="text-[#5f6b7f]">Production Order</TableHead>
                <TableHead className="text-[#5f6b7f]">User</TableHead>
                <TableHead className="text-[#5f6b7f]">Remarks</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!loading && rows.length === 0 && (
                <TableRow><TableCell colSpan={9} className="text-[#5f6b7f] text-center py-6">No movements match these filters.</TableCell></TableRow>
              )}
              {rows.map((m) => (
                <TableRow key={m.id} className="border-[#1e2740] hover:bg-white/5">
                  <TableCell className="text-[#a0aec0] whitespace-nowrap">{m.movement_date || (m.created_date || "").slice(0, 10)}</TableCell>
                  <TableCell className="text-white whitespace-nowrap">{m.item_code}</TableCell>
                  <TableCell className={`font-medium whitespace-nowrap ${TYPE_STYLES[m.type] || "text-[#a0aec0]"}`}>{m.type}</TableCell>
                  <TableCell className="text-right text-white whitespace-nowrap">
                    {m.type === "Adjustment" && Number(m.quantity) > 0 ? "+" : ""}
                    {fmtQty(m.quantity)} <span className="text-[#5f6b7f]">{m.unit}</span>
                  </TableCell>
                  <TableCell className="text-[#a0aec0] whitespace-nowrap">{m.batch_number || "—"}</TableCell>
                  <TableCell className="text-[#a0aec0] whitespace-nowrap">{m.rack_location || "—"}</TableCell>
                  <TableCell className="text-[#a0aec0] whitespace-nowrap">{m.production_order || "—"}</TableCell>
                  <TableCell className="text-[#a0aec0] whitespace-nowrap">{m.user_name || "—"}</TableCell>
                  <TableCell className="text-[#5f6b7f] max-w-[240px] truncate" title={m.remarks}>{m.remarks || "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        {hasMore && (
          <div className="pt-3 text-center">
            <Button variant="outline" onClick={loadMore} disabled={loadingMore} className="border-[#1e2740] bg-transparent text-[#a0aec0] hover:bg-white/5 hover:text-white">
              {loadingMore ? "Loading…" : "Load more"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}