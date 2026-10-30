import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Settings2, Download, ArrowLeftRight, CheckCircle2, Boxes } from "lucide-react";
import ItemCard from "@/components/packaging/ItemCard";
import ItemDialog from "@/components/packaging/ItemDialog";
import StockInDialog from "@/components/packaging/StockInDialog";
import StockUseDialog from "@/components/packaging/StockUseDialog";
import StockCheckDialog from "@/components/packaging/StockCheckDialog";
import ItemDetailDialog from "@/components/packaging/ItemDetailDialog";
import PackagingSettingsDialog from "@/components/packaging/PackagingSettingsDialog";
import { actingUserName } from "@/lib/permissions";
import { downloadCsv } from "@/lib/warehouse";
import {
  DEFAULT_UNITS,
  canApproveStock,
  canManagePackaging,
  fmtQty,
  isLowStock,
  isPackagingStaff,
  itemStatus,
  loadPackagingSettings,
  loadProductionOrders,
} from "@/lib/packaging";

const ITEM_CSV_COLUMNS = [
  { label: "Item Code", key: "item_code" },
  { label: "Description", key: "description" },
  { label: "Category", key: "category" },
  { label: "Quantity", key: "quantity" },
  { label: "Unit", key: "unit" },
  { label: "Minimum Level", key: "min_level" },
  { label: "Rack", key: "default_rack" },
  { label: "Supplier", key: "supplier" },
];

export default function PackagingStock() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [items, setItems] = useState([]);
  const [racks, setRacks] = useState([]);
  const [pendingIds, setPendingIds] = useState(new Set());
  const [settings, setSettings] = useState({ id: "", categories: [], threshold: 0 });
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [mode, setMode] = useState("all");
  const [itemDialog, setItemDialog] = useState({ open: false, item: null });
  const [inItem, setInItem] = useState(null);
  const [useItem, setUseItem] = useState(null);
  const [checkItem, setCheckItem] = useState(null);
  const [detailItem, setDetailItem] = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const [itemRows, rackPage, approvalPage, loadedSettings] = await Promise.all([
      base44.entities.PackagingItem.list("-created_date", 500),
      base44.entities.WarehouseRack.filter({ status: "Active" }, { sort: "rack_code", limit: 500 }),
      base44.entities.PackagingApproval.filter({ status: "Pending" }, { limit: 500 }),
      loadPackagingSettings(),
    ]);
    setItems(Array.isArray(itemRows) ? itemRows : []);
    setRacks(rackPage.items || []);
    setPendingIds(new Set((approvalPage.items || []).map((a) => a.item_id)));
    setSettings(loadedSettings);
    setLoading(false);
  };

  useEffect(() => {
    load();
    loadProductionOrders().then(setOrders).catch(() => setOrders([]));
  }, []);

  const audit = async (action, recordId, details) => {
    try {
      await base44.entities.AuditLog.create({
        event_time: new Date().toISOString(),
        event_stamp: new Date().toISOString().slice(0, 19).replace("T", " "),
        user_name: actingUserName(user),
        module: "Packaging Stock",
        action,
        record_id: recordId,
        details,
      });
    } catch {
      // The stock action itself must not fail because of the audit trail.
    }
  };

  const remove = async () => {
    if (!deleting) return;
    setBusy(true);
    try {
      const history = await base44.entities.PackagingMovement.filter({ item_id: deleting.id }, { limit: 1 });
      if ((history.items || []).length) {
        await base44.entities.PackagingItem.update(deleting.id, { active: false });
        toast({ title: "Item deactivated", description: `${deleting.item_code} has movement history, so it was set inactive.` });
        await audit("Updated", deleting.id, `Deactivated ${deleting.item_code} (has movement history)`);
      } else {
        await base44.entities.PackagingItem.delete(deleting.id);
        toast({ title: "Item deleted", description: `${deleting.item_code} removed.` });
        await audit("Deleted", deleting.id, `Deleted ${deleting.item_code}`);
      }
      setDeleting(null);
      load();
    } catch (e) {
      toast({ title: "Could not remove item", description: e?.message || "Please try again.", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const visible = items.filter((item) => {
    if (mode === "low" && !isLowStock(item)) return false;
    if (category !== "all" && item.category !== category) return false;
    const term = search.trim().toLowerCase();
    if (term && ![item.item_code, item.description, item.category, item.supplier].some((v) => (v || "").toLowerCase().includes(term))) return false;
    return true;
  });

  const lowCount = items.filter(isLowStock).length;
  const totalUnits = items.reduce((sum, i) => sum + (Number(i.quantity) || 0), 0);
  const units = DEFAULT_UNITS;

  return (
    <div className="min-h-screen bg-[#0a0e17] p-4 md:p-6 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-white text-lg font-semibold">Packaging Stock</h2>
          <p className="text-[#a0aec0] text-sm mt-1">Stock on hand for packaging materials, with every in, use and count recorded.</p>
        </div>
        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
          {isPackagingStaff(user) && (
            <Button onClick={() => setItemDialog({ open: true, item: null })} className="flex-1 sm:flex-none bg-[#00e5ff] hover:bg-[#00c3d7] text-[#0a0e17] font-semibold">
              <Plus className="w-4 h-4" /> Add Item
            </Button>
          )}
          {canManagePackaging(user) && (
            <Button variant="outline" onClick={() => setSettingsOpen(true)} className="flex-1 sm:flex-none border-[#1e2740] bg-[#0e131d] text-[#a0aec0] hover:bg-white/5 hover:text-white">
              <Settings2 className="w-4 h-4" /> Categories
            </Button>
          )}
          <Button
            variant="outline"
            onClick={() => downloadCsv(`packaging-stock-${new Date().toISOString().slice(0, 10)}.csv`, ITEM_CSV_COLUMNS, visible)}
            className="flex-1 sm:flex-none border-[#1e2740] bg-[#0e131d] text-[#a0aec0] hover:bg-white/5 hover:text-white"
          >
            <Download className="w-4 h-4" /> Export
          </Button>
          <Button asChild variant="outline" className="flex-1 sm:flex-none border-[#1e2740] bg-[#0e131d] text-[#a0aec0] hover:bg-white/5 hover:text-white">
            <Link to="/packaging-movements"><ArrowLeftRight className="w-4 h-4" /> Movements</Link>
          </Button>
          <Button asChild variant="outline" className="flex-1 sm:flex-none border-[#1e2740] bg-[#0e131d] text-[#a0aec0] hover:bg-white/5 hover:text-white">
            <Link to="/packaging-approvals">
              <CheckCircle2 className="w-4 h-4" /> Approvals
              {pendingIds.size > 0 && (
                <span className="ml-1 rounded-full bg-[#ff9f43] text-[#0a0e17] text-[10px] font-bold px-1.5">{pendingIds.size}</span>
              )}
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-xl border border-[#1e2740] bg-[#0e131d] px-4 py-3">
          <p className="text-[10px] uppercase tracking-widest text-[#5f6b7f] font-semibold">Total Items</p>
          <p className="text-2xl text-white font-semibold mt-1">{items.length}</p>
        </div>
        <div className={`rounded-xl border px-4 py-3 ${lowCount ? "border-[#ff9f43]/50 bg-[#ff9f43]/10" : "border-[#1e2740] bg-[#0e131d]"}`}>
          <p className="text-[10px] uppercase tracking-widest text-[#5f6b7f] font-semibold">Low Stock</p>
          <p className={`text-2xl font-semibold mt-1 ${lowCount ? "text-[#ff9f43]" : "text-white"}`}>{lowCount}</p>
        </div>
        <div className="rounded-xl border border-[#1e2740] bg-[#0e131d] px-4 py-3">
          <p className="text-[10px] uppercase tracking-widest text-[#5f6b7f] font-semibold">Total Units</p>
          <p className="text-2xl text-white font-semibold mt-1">{fmtQty(totalUnits)}</p>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row lg:items-center gap-2">
        <div className="flex-1 flex items-center gap-2">
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search item code, description or supplier" className="bg-[#0e131d] border-[#1e2740] text-white" />
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="w-44 bg-[#0e131d] border-[#1e2740] text-white"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {settings.categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="flex gap-1">
          {["all", "low"].map((m) => (
            <Button
              key={m}
              size="sm"
              variant={mode === m ? "default" : "outline"}
              onClick={() => setMode(m)}
              className={mode === m ? "bg-[#00e5ff] hover:bg-[#00c3d7] text-[#0a0e17] font-semibold" : "border-[#1e2740] bg-[#0e131d] text-[#a0aec0] hover:bg-white/5 hover:text-white"}
            >
              {m === "all" ? "All" : "Low Stock"}
            </Button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-[#1e2740] border-t-[#00e5ff] rounded-full animate-spin" />
        </div>
      ) : visible.length === 0 ? (
        <div className="rounded-xl border border-[#1e2740] bg-[#0e131d] p-10 text-center">
          <Boxes className="w-8 h-8 text-[#3a465c] mx-auto" />
          <p className="text-[#a0aec0] text-sm mt-3">
            {items.length === 0 ? "No packaging items yet — add your first item to start tracking stock." : "No items match these filters."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3">
          {visible.map((item) => (
            <ItemCard
              key={item.id}
              item={item}
              status={itemStatus(item, pendingIds.has(item.id))}
              canEdit={isPackagingStaff(user)}
              canDelete={canApproveStock(user)}
              onIn={() => setInItem(item)}
              onUse={() => setUseItem(item)}
              onCheck={() => setCheckItem(item)}
              onEdit={() => setItemDialog({ open: true, item })}
              onDelete={() => setDeleting(item)}
              onDetail={() => setDetailItem(item)}
            />
          ))}
        </div>
      )}

      <ItemDialog
        open={itemDialog.open}
        item={itemDialog.item}
        categories={settings.categories}
        units={units}
        racks={racks}
        onClose={() => setItemDialog({ open: false, item: null })}
        onSaved={load}
      />
      <StockInDialog open={!!inItem} item={inItem} items={items} racks={racks} user={user} onClose={() => setInItem(null)} onSaved={load} />
      <StockUseDialog
        open={!!useItem}
        item={useItem}
        user={user}
        orders={orders}
        threshold={settings.threshold}
        onClose={() => setUseItem(null)}
        onSaved={(result) => {
          load();
          if (result?.approval) toast({ title: "Sent for approval", description: "This issue is above the approval threshold." });
        }}
      />
      <StockCheckDialog
        open={!!checkItem}
        item={checkItem}
        user={user}
        onClose={() => setCheckItem(null)}
        onSaved={() => {
          load();
          toast({ title: "Adjustment requested", description: "A supervisor will review the counted difference." });
        }}
      />
      <ItemDetailDialog open={!!detailItem} item={detailItem} onClose={() => setDetailItem(null)} />
      <PackagingSettingsDialog
        open={settingsOpen}
        updatedBy={actingUserName(user)}
        onClose={() => setSettingsOpen(false)}
        onSaved={load}
      />

      <Dialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <DialogContent className="bg-[#131926] border-[#1e2740] text-white sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white">Remove {deleting?.item_code}?</DialogTitle>
            <DialogDescription className="text-[#a0aec0] text-sm">
              An item with movement history is deactivated instead of deleted, so past movements stay intact.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleting(null)} className="text-[#a0aec0] hover:bg-white/5 hover:text-white">Cancel</Button>
            <Button onClick={remove} disabled={busy} className="bg-[#ff4d4d] hover:bg-[#e63b3b] text-white">
              {busy ? "Working..." : "Remove item"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}