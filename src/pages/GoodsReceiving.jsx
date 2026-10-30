import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Plus, Save, List, Settings as SettingsIcon, AlertTriangle } from "lucide-react";
import ReceiptLineEditor from "@/components/warehouse/ReceiptLineEditor";
import ItemListDialog from "@/components/warehouse/ItemListDialog";
import QuickAddItemDialog from "@/components/warehouse/QuickAddItemDialog";
import WarehouseSettingsDialog from "@/components/warehouse/WarehouseSettingsDialog";
import { actingUserName } from "@/lib/permissions";
import { findProduct } from "@/lib/findProduct";
import { loadRecipes } from "@/lib/planning";
import { productLink, recipeOf } from "@/lib/productLinks";
import {
  DEFAULT_UNITS,
  SETTINGS_KEY,
  duplicateKey,
  eventStamp,
  isWarehouseSupervisor,
  newGroupId,
  todayStr,
} from "@/lib/warehouse";

const FIELD = "bg-[#0e131d] border-[#1e2740] text-white";
let seq = 0;

const blankLine = (unit = "") => ({
  id: `l${++seq}`,
  item_code: "",
  product_id: "",
  product_code: "",
  product_name: "",
  product_recipe: "",
  product_description: "",
  batch_number: "",
  quantity: "",
  unit,
  rack_location: "",
  expiry_date: "",
  remarks: "",
});

// Goods receiving: one delivery note, several item lines, keyed in from a phone
// or tablet on the warehouse floor.
export default function GoodsReceiving() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [items, setItems] = useState([]);
  const [recipes, setRecipes] = useState([]);
  const [racks, setRacks] = useState([]);
  const [units, setUnits] = useState(DEFAULT_UNITS);
  const [header, setHeader] = useState({ date_received: todayStr(), supplier: "", delivery_note: "" });
  const [lines, setLines] = useState([blankLine()]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [duplicates, setDuplicates] = useState(null);
  const [quickAdd, setQuickAdd] = useState(null);
  const [itemListOpen, setItemListOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const load = async () => {
    const [itemRows, rackPage, settingsPage, recipeRows] = await Promise.all([
      base44.entities.WarehouseItem.list("-created_date", 500),
      base44.entities.WarehouseRack.filter({ status: "Active" }, { sort: "rack_code", limit: 500 }),
      base44.entities.WarehouseSettings.filter({ key: SETTINGS_KEY }, { limit: 1 }),
      loadRecipes().catch(() => []),
    ]);
    setItems(Array.isArray(itemRows) ? itemRows : itemRows?.items || []);
    setRacks(rackPage.items || []);
    setRecipes(Array.isArray(recipeRows) ? recipeRows : []);
    const configured = (settingsPage.items || [])[0]?.units;
    const nextUnits = Array.isArray(configured) && configured.length ? configured : DEFAULT_UNITS;
    setUnits(nextUnits);
    setLines((prev) => prev.map((l) => (l.unit ? l : { ...l, unit: nextUnits[0] })));
  };

  useEffect(() => { load(); }, []);

  const setLine = (id, patch) => setLines((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)));

  // Typing a known item code fills in the description and its default unit. A code that
  // is not a warehouse item is looked up in the Product Master (piece barcode, carton
  // barcode or Item Code), so finished goods received back stay linked to their item.
  const handleItemCode = async (id, value) => {
    const match = items.find((i) => (i.item_code || "").toLowerCase() === value.trim().toLowerCase());
    if (match) {
      setLines((prev) =>
        prev.map((l) =>
          l.id === id
            ? {
                ...l,
                item_code: value,
                product_id: "",
                product_code: "",
                product_name: "",
                product_recipe: "",
                product_description: match.description || l.product_description,
                unit: match.unit || l.unit,
              }
            : l
        )
      );
      return;
    }

    setLines((prev) => prev.map((l) => (l.id === id ? { ...l, item_code: value } : l)));
    if (!value.trim()) return;
    const found = await findProduct(value);
    const product = found.product;
    if (!product) return;
    setLines((prev) =>
      prev.map((l) =>
        l.id === id && l.item_code.trim() === value.trim()
          ? {
              ...l,
              item_code: product.product_code || value,
              ...productLink(product),
              product_recipe: recipeOf(recipes, product)?.recipe_name || "",
              product_description: l.product_description || product.product_name || "",
            }
          : l
      )
    );
  };

  const validate = () => {
    if (!header.date_received) return "Date received is required.";
    for (let i = 0; i < lines.length; i += 1) {
      const l = lines[i];
      if (!l.item_code.trim()) return `Item ${i + 1}: item code is required.`;
      if (!l.batch_number.trim()) return `Item ${i + 1}: batch number is required.`;
      if (!(Number(l.quantity) > 0)) return `Item ${i + 1}: quantity must be greater than zero.`;
      if (!l.unit) return `Item ${i + 1}: select a unit of measure.`;
      if (!l.rack_location) return `Item ${i + 1}: select a rack location.`;
    }
    const seen = new Set();
    for (const l of lines) {
      const key = duplicateKey(l);
      if (seen.has(key)) return `Item ${l.item_code} / batch ${l.batch_number} appears twice in this receipt.`;
      seen.add(key);
    }
    return "";
  };

  const findDuplicates = async () => {
    const clashes = [];
    for (const l of lines) {
      const page = await base44.entities.GoodsReceipt.filter(
        { date_received: header.date_received, batch_number: l.batch_number.trim() },
        { limit: 10 }
      );
      const hit = (page.items || []).some(
        (r) => (r.item_code || "").toLowerCase() === l.item_code.trim().toLowerCase()
      );
      if (hit) clashes.push(l);
    }
    return clashes;
  };

  const save = async (skipDuplicateCheck = false) => {
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }
    setError("");
    setSaving(true);
    try {
      if (!skipDuplicateCheck) {
        const clashes = await findDuplicates();
        if (clashes.length) {
          setDuplicates(clashes);
          return;
        }
      }

      const group = newGroupId();
      await base44.entities.GoodsReceipt.bulkCreate(
        lines.map((l) => ({
          receipt_group_id: group,
          date_received: header.date_received,
          supplier: header.supplier.trim(),
          delivery_note: header.delivery_note.trim(),
          ...(l.product_id ? { product_id: l.product_id, product_code: l.product_code } : {}),
          item_code: l.item_code.trim(),
          product_description: l.product_description.trim(),
          batch_number: l.batch_number.trim(),
          quantity: Number(l.quantity),
          unit: l.unit,
          rack_location: l.rack_location,
          remarks: l.remarks.trim(),
          received_by: actingUserName(user),
          received_by_id: user?.id || "",
          ...(l.expiry_date ? { expiry_date: l.expiry_date } : {}),
        }))
      );

      try {
        await base44.entities.AuditLog.create({
          event_time: new Date().toISOString(),
          event_stamp: eventStamp(),
          user_name: actingUserName(user),
          module: "Warehouse Goods Receiving",
          action: "Created",
          record_id: group,
          details: `Received ${lines.length} item line${lines.length === 1 ? "" : "s"}${
            header.delivery_note.trim() ? ` on delivery note ${header.delivery_note.trim()}` : ""
          }`,
        });
      } catch {
        // An audit write must never block the receipt itself.
      }

      toast({ title: "Goods received", description: `${lines.length} line${lines.length === 1 ? "" : "s"} saved.` });
      setDuplicates(null);
      setHeader((h) => ({ ...h, supplier: "", delivery_note: "" }));
      setLines([blankLine(units[0])]);
    } catch (e) {
      setError(e?.message || "Could not save the receipt. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0e17] p-4 md:p-6 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-white text-lg font-semibold">Goods Receiving</h2>
          <p className="text-[#a0aec0] text-sm mt-1">Record goods received against a delivery note — one delivery can hold several items.</p>
        </div>
        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
          <Button variant="outline" onClick={() => setItemListOpen(true)} className="flex-1 sm:flex-none border-[#1e2740] bg-[#0e131d] text-[#a0aec0] hover:bg-white/5 hover:text-white">
            <List className="w-4 h-4" /> Item list
          </Button>
          {isWarehouseSupervisor(user) && (
            <Button variant="outline" onClick={() => setSettingsOpen(true)} className="flex-1 sm:flex-none border-[#1e2740] bg-[#0e131d] text-[#a0aec0] hover:bg-white/5 hover:text-white">
              <SettingsIcon className="w-4 h-4" /> Settings
            </Button>
          )}
        </div>
      </div>

      <datalist id="warehouse-item-codes">
        {items.map((i) => <option key={i.id} value={i.item_code}>{i.description}</option>)}
      </datalist>

      <div className="rounded-xl border border-[#1e2740] bg-[#0e131d] p-3 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="space-y-1">
            <label className="text-[10px] uppercase tracking-widest text-[#5f6b7f] font-semibold">Date Received *</label>
            <Input
              type="date"
              value={header.date_received}
              onChange={(e) => setHeader((h) => ({ ...h, date_received: e.target.value }))}
              className={FIELD}
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] uppercase tracking-widest text-[#5f6b7f] font-semibold">Supplier</label>
            <Input
              value={header.supplier}
              onChange={(e) => setHeader((h) => ({ ...h, supplier: e.target.value }))}
              placeholder="Optional"
              className={FIELD}
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] uppercase tracking-widest text-[#5f6b7f] font-semibold">Delivery Note No.</label>
            <Input
              value={header.delivery_note}
              onChange={(e) => setHeader((h) => ({ ...h, delivery_note: e.target.value }))}
              placeholder="Optional"
              className={FIELD}
            />
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {lines.map((line, index) => (
          <ReceiptLineEditor
            key={line.id}
            index={index}
            line={line}
            items={items}
            units={units}
            racks={racks}
            onItemCode={(value) => handleItemCode(line.id, value)}
            onChange={(patch) => setLine(line.id, patch)}
            onRemove={() => setLines((prev) => prev.filter((l) => l.id !== line.id))}
            removable={lines.length > 1}
            onAddItem={(l) => setQuickAdd({ lineId: l.id, item_code: l.item_code.trim(), product_description: l.product_description })}
          />
        ))}
      </div>

      <Button
        variant="outline"
        onClick={() => setLines((prev) => [...prev, blankLine(units[0])])}
        className="w-full border-dashed border-[#1e2740] bg-transparent text-[#a0aec0] hover:bg-white/5 hover:text-white"
      >
        <Plus className="w-4 h-4" /> Add item line
      </Button>

      {error && <p className="text-sm text-[#ff4d4d]">{error}</p>}

      <div className="sticky bottom-0 -mx-4 md:-mx-6 px-4 md:px-6 py-3 bg-[#0a0e17] border-t border-[#1e2740] flex flex-wrap items-center gap-3">
        <p className="text-xs text-[#5f6b7f]">
          {lines.length} item line{lines.length === 1 ? "" : "s"} · keyed in by {actingUserName(user) || "—"}
        </p>
        <Button
          onClick={() => save()}
          disabled={saving}
          className="w-full sm:w-auto sm:ml-auto bg-[#00e5ff] hover:bg-[#00c3d7] text-[#0a0e17] font-semibold h-11"
        >
          <Save className="w-4 h-4" /> {saving ? "Saving..." : "Save receipt"}
        </Button>
      </div>

      {duplicates && (
        <Dialog open onOpenChange={(o) => !o && setDuplicates(null)}>
          <DialogContent className="bg-[#131926] border-[#1e2740] text-white sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-white flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-[#ff9f43]" /> Possible duplicate
              </DialogTitle>
              <DialogDescription className="text-[#a0aec0] text-sm">
                These items were already received today with the same batch number.
              </DialogDescription>
            </DialogHeader>
            <ul className="space-y-1 text-sm text-[#a0aec0]">
              {duplicates.map((d) => (
                <li key={d.id} className="rounded-md border border-[#1e2740] bg-[#0e131d] px-3 py-2">
                  <span className="text-white">{d.item_code}</span> · batch {d.batch_number}
                </li>
              ))}
            </ul>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setDuplicates(null)} className="text-[#a0aec0] hover:bg-white/5 hover:text-white">
                Go back and check
              </Button>
              <Button onClick={() => save(true)} disabled={saving} className="bg-[#ff9f43] hover:bg-[#f58a1f] text-[#0a0e17]">
                Save anyway
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {itemListOpen && (
        <ItemListDialog
          items={items}
          units={units}
          onClose={() => setItemListOpen(false)}
          onChanged={load}
        />
      )}

      <QuickAddItemDialog
        request={quickAdd}
        units={units}
        onClose={() => setQuickAdd(null)}
        onCreated={(item, lineId) => {
          setLines((prev) =>
            prev.map((l) =>
              l.id === lineId
                ? { ...l, product_description: l.product_description || item.description || "", unit: l.unit || item.unit || "" }
                : l
            )
          );
          load();
        }}
      />

      <WarehouseSettingsDialog
        open={settingsOpen}
        onClose={() => { setSettingsOpen(false); load(); }}
        updatedBy={actingUserName(user)}
      />
    </div>
  );
}