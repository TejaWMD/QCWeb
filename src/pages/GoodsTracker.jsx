import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { Plus, Settings as SettingsIcon } from "lucide-react";
import TrackerFilters from "@/components/warehouse/TrackerFilters";
import TrackerTable from "@/components/warehouse/TrackerTable";
import EditReceiptDialog from "@/components/warehouse/EditReceiptDialog";
import WarehouseSettingsDialog from "@/components/warehouse/WarehouseSettingsDialog";
import { actingUserName } from "@/lib/permissions";
import { DEFAULT_UNITS, SETTINGS_KEY, downloadCsv, isWarehouseSupervisor, todayStr } from "@/lib/warehouse";

const EMPTY_FILTERS = { from: "", to: "", item_code: "", batch: "", rack: "", search: "" };

const CSV_COLUMNS = [
  { label: "Date Received", key: "date_received" },
  { label: "Item Code", key: "item_code" },
  { label: "Description", key: "product_description" },
  { label: "Batch Number", key: "batch_number" },
  { label: "Quantity", key: "quantity" },
  { label: "Unit", key: "unit" },
  { label: "Rack", key: "rack_location" },
  { label: "Expiry Date", key: "expiry_date" },
  { label: "Supplier", key: "supplier" },
  { label: "Delivery Note", key: "delivery_note" },
  { label: "Received By", key: "received_by" },
  { label: "Remarks", key: "remarks" },
];

const buildQuery = (f) => {
  const query = {};
  const range = {};
  if (f.from) range.$gte = f.from;
  if (f.to) range.$lte = f.to;
  if (Object.keys(range).length) query.date_received = range;
  if (f.item_code.trim()) query.item_code = { $regex: f.item_code.trim() };
  if (f.batch.trim()) query.batch_number = { $regex: f.batch.trim() };
  if (f.rack) query.rack_location = f.rack;
  const term = f.search.trim();
  if (term) {
    query.$or = [
      { item_code: { $regex: term } },
      { product_code: { $regex: term } },
      { product_description: { $regex: term } },
      { batch_number: { $regex: term } },
    ];
  }
  return query;
};

// Goods tracker: every received line, searchable and filterable, with CSV export.
export default function GoodsTracker() {
  const { user } = useAuth();
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [rows, setRows] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [racks, setRacks] = useState([]);
  const [units, setUnits] = useState(DEFAULT_UNITS);
  const [editing, setEditing] = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    (async () => {
      const [rackPage, settingsPage] = await Promise.all([
        base44.entities.WarehouseRack.filter({}, { sort: "rack_code", limit: 500 }),
        base44.entities.WarehouseSettings.filter({ key: SETTINGS_KEY }, { limit: 1 }),
      ]);
      setRacks(rackPage.items || []);
      const configured = (settingsPage.items || [])[0]?.units;
      if (Array.isArray(configured) && configured.length) setUnits(configured);
    })();
  }, [settingsOpen, refresh]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const page = await base44.entities.GoodsReceipt.filter(buildQuery(filters), {
          sort: "-date_received",
          limit: 100,
        });
        if (!alive) return;
        setRows(page.items || []);
        setCursor(page.next_cursor || null);
        setHasMore(!!page.has_more);
      } finally {
        if (alive) setLoading(false);
      }
    }, 300);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [filters, refresh]);

  const loadMore = async () => {
    if (!cursor) return;
    setLoadingMore(true);
    try {
      const page = await base44.entities.GoodsReceipt.filter(buildQuery(filters), {
        sort: "-date_received",
        limit: 100,
        cursor,
      });
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
      const page = await base44.entities.GoodsReceipt.filter(buildQuery(filters), {
        sort: "-date_received",
        limit: 1000,
      });
      downloadCsv(`goods-received-${todayStr()}.csv`, CSV_COLUMNS, page.items || []);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0e17] p-4 md:p-6 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-white text-lg font-semibold">Goods Tracker</h2>
          <p className="text-[#a0aec0] text-sm mt-1">
            Every item received into the warehouse, with rack location and who keyed it in.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
          {isWarehouseSupervisor(user) && (
            <Button variant="outline" onClick={() => setSettingsOpen(true)} className="flex-1 sm:flex-none border-[#1e2740] bg-[#0e131d] text-[#a0aec0] hover:bg-white/5 hover:text-white">
              <SettingsIcon className="w-4 h-4" /> Settings
            </Button>
          )}
          <Button asChild className="flex-1 sm:flex-none bg-[#00e5ff] hover:bg-[#00c3d7] text-[#0a0e17] font-semibold">
            <Link to="/goods-receiving"><Plus className="w-4 h-4" /> Receive goods</Link>
          </Button>
        </div>
      </div>

      <TrackerFilters
        filters={filters}
        onChange={setFilters}
        racks={racks}
        onExport={exportCsv}
        exporting={exporting}
      />

      <div className="rounded-xl border border-[#1e2740] bg-[#0e131d] p-3">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
          <p className="text-xs text-[#5f6b7f]">
            {loading ? "Loading…" : `${rows.length} line${rows.length === 1 ? "" : "s"} shown`}
          </p>
          <p className="text-[11px] text-[#3a465c]">Edits: own entries for 24 hours · supervisors anytime</p>
        </div>
        <TrackerTable rows={rows} user={user} onEdit={setEditing} loading={loading && rows.length === 0} />
        {hasMore && (
          <div className="pt-3 text-center">
            <Button variant="outline" onClick={loadMore} disabled={loadingMore} className="border-[#1e2740] bg-transparent text-[#a0aec0] hover:bg-white/5 hover:text-white">
              {loadingMore ? "Loading…" : "Load more"}
            </Button>
          </div>
        )}
      </div>

      {editing && (
        <EditReceiptDialog
          record={editing}
          user={user}
          units={units}
          racks={racks}
          onClose={() => setEditing(null)}
          onSaved={() => setRefresh((n) => n + 1)}
        />
      )}

      <WarehouseSettingsDialog
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        updatedBy={actingUserName(user)}
      />
    </div>
  );
}