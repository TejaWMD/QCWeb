import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, Loader2 } from "lucide-react";
import { todayStr } from "@/lib/warehouse";
import { num } from "@/lib/planning";
import { scheduleBlock } from "@/lib/productMaster";
import {
  PRIORITIES, addMinutes, batchCount, buildBatchCodes, capacityOf, fmtDateTime, fmtDuration, fmtQty,
  fromLocalInput, logProductionAudit, nextOrderNumber, overlapsOnMachine, runMinutes, suggestedMachine,
} from "@/lib/production";
import { inputClass, selectClass, primaryButton, subtleButton, labelClass } from "@/components/planning/styles";

const Field = ({ label, children, span }) => (
  <div className={`space-y-1 ${span || ""}`}>
    <label className={labelClass}>{label}</label>
    {children}
  </div>
);

// Creates a planned order from a product: batches come from the standard batch
// size, run time from the machine capacity, and the machine defaults to the one
// set on the product.
export default function GenerateOrderDialog({ open, onClose, onSaved, products = [], machines = [], orders = [], settings, user }) {
  const { toast } = useToast();
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [customer, setCustomer] = useState("");
  const [priority, setPriority] = useState("Normal");
  const [machineName, setMachineName] = useState("");
  const [startLocal, setStartLocal] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setProductId("");
    setQuantity("");
    setDueDate(todayStr());
    setCustomer("");
    setPriority("Normal");
    setMachineName("");
    setStartLocal(`${todayStr()}T08:00`);
    setNotes("");
    setSaving(false);
  }, [open]);

  const product = products.find((p) => p.id === productId) || null;
  const machine = machines.find((m) => m.name === machineName) || null;
  const cph = capacityOf(machine, settings);
  const batches = product ? batchCount(product, quantity) : 0;
  const minutes = num(quantity) > 0 ? runMinutes(quantity, cph) : 0;
  const startIso = startLocal ? fromLocalInput(startLocal) : "";
  const endIso = startIso && minutes ? addMinutes(startIso, minutes) : "";
  const codes = product && batches
    ? buildBatchCodes({ code: product.product_code, plannedStart: startIso || new Date().toISOString(), count: batches, pattern: settings?.batch_pattern })
    : [];
  const conflicts = startIso && endIso && machine ? overlapsOnMachine(orders, machine.name, startIso, endIso) : [];

  const pickProduct = (id) => {
    setProductId(id);
    const p = products.find((x) => x.id === id);
    const m = p ? suggestedMachine(p, machines) : null;
    if (m) setMachineName(m.name);
  };

  const save = async () => {
    if (!product) return toast({ title: "Choose a product", variant: "destructive" });
    const blocked = scheduleBlock(product);
    if (blocked) return toast({ title: "Product cannot be scheduled", description: `${product.product_name}: ${blocked}. Fix it in Product Master.`, variant: "destructive" });
    if (!(num(quantity) > 0)) return toast({ title: "Enter a target quantity in cartons", variant: "destructive" });
    if (!startIso) return toast({ title: "Choose a planned start", variant: "destructive" });
    if (!machine) return toast({ title: "Choose a machine", variant: "destructive" });
    setSaving(true);
    try {
      const orderNumber = nextOrderNumber(orders);
      const payload = {
        order_number: orderNumber,
        product_id: product.id,
        product_code: product.product_code || "",
        product_name: product.product_name || "",
        customer: customer.trim(),
        priority,
        quantity_cartons: num(quantity),
        batch_cartons: num(product.standard_batch_cartons),
        batches,
        machine: machine.name,
        machine_id: machine.id,
        capacity_cph: cph,
        due_date: dueDate || "",
        planned_start: startIso,
        planned_end: endIso,
        status: "Planned",
        batch_codes: codes,
        plan_changes: [],
        notes: notes.trim(),
        deleted: false,
      };
      const created = await base44.entities.ProductionOrder.create(payload);
      await logProductionAudit({
        user,
        action: "Created",
        recordId: created.id,
        details: `${orderNumber} · ${product.product_name} · ${fmtQty(payload.quantity_cartons)} cartons · ${batches} batch(es) on ${machine.name}`,
        newValue: `${fmtDateTime(startIso)} → ${fmtDateTime(endIso)}`,
      });
      toast({ title: "Order created", description: `${orderNumber} planned for ${fmtDateTime(startIso)}.` });
      onSaved?.();
      onClose();
    } catch (e) {
      toast({ title: "Could not create the order", description: e?.message || "Please try again.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="bg-[#0b1018] border-[#1e2740] text-white max-w-3xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-white">Generate Order</DialogTitle>
          <p className="text-xs text-[#5f6b7f]">Batches, run time and batch numbers are worked out from Product Master and the machine capacity.</p>
        </DialogHeader>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Product" span="sm:col-span-2">
            <Select value={productId} onValueChange={pickProduct}>
              <SelectTrigger className={selectClass}><SelectValue placeholder="Choose a product" /></SelectTrigger>
              <SelectContent>
                {products.length === 0 && <SelectItem value="none" disabled>No products in Product Master</SelectItem>}
                {products.map((p) => {
                  const blocked = scheduleBlock(p);
                  return (
                    <SelectItem key={p.id} value={p.id} disabled={!!blocked}>
                      {p.product_code} · {p.product_name}{blocked ? " · blocked" : ""}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
            {product && scheduleBlock(product) && (
              <p className="text-[11px] text-[#ff4d4d]">{scheduleBlock(product)} — fix it in Product Master to schedule this product.</p>
            )}
          </Field>
          <Field label="Target quantity (cartons)">
            <Input type="number" min="1" value={quantity} onChange={(e) => setQuantity(e.target.value)} className={inputClass} placeholder="e.g. 1200" />
          </Field>
          <Field label="Due date">
            <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={inputClass} />
          </Field>
          <Field label="Customer (optional)">
            <Input value={customer} onChange={(e) => setCustomer(e.target.value)} className={inputClass} placeholder="e.g. Lotus's" />
          </Field>
          <Field label="Priority">
            <Select value={priority} onValueChange={setPriority}>
              <SelectTrigger className={selectClass}><SelectValue /></SelectTrigger>
              <SelectContent>{PRIORITIES.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Machine">
            <Select value={machineName} onValueChange={setMachineName}>
              <SelectTrigger className={selectClass}><SelectValue placeholder="Choose a machine" /></SelectTrigger>
              <SelectContent>
                {machines.length === 0 && <SelectItem value="none" disabled>No machines set up</SelectItem>}
                {machines.map((m) => <SelectItem key={m.id} value={m.name}>{m.name}{m.status === "Under Maintenance" ? " · maintenance" : ""}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Planned start">
            <Input type="datetime-local" value={startLocal} onChange={(e) => setStartLocal(e.target.value)} className={inputClass} />
          </Field>
          <Field label="Notes" span="sm:col-span-2">
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} className={`${inputClass} min-h-[60px]`} placeholder="Optional" />
          </Field>
        </div>

        <div className="rounded-lg border border-[#1e2740] bg-[#0e131d] p-3 space-y-2">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <p className={labelClass}>Std batch</p>
              <p className="text-sm text-white">{product?.standard_batch_cartons ? `${fmtQty(product.standard_batch_cartons)} ctns` : "not set"}</p>
            </div>
            <div>
              <p className={labelClass}>Batches</p>
              <p className="text-sm text-white">{batches || "—"}</p>
            </div>
            <div>
              <p className={labelClass}>Run time</p>
              <p className="text-sm text-white">{minutes ? fmtDuration(minutes) : "—"}</p>
            </div>
            <div>
              <p className={labelClass}>Est. end</p>
              <p className="text-sm text-white">{endIso ? fmtDateTime(endIso) : "—"}</p>
            </div>
          </div>
          <p className="text-[11px] text-[#5f6b7f]">
            {machine ? `${machine.name} · ${fmtQty(cph)} cartons/hour${num(machine.capacity_cph) ? "" : " (default rate)"}` : "Choose a machine to estimate the run time"}
          </p>
          {product && (
            <p className="text-[11px] text-[#5f6b7f]">
              Item {product.product_code} · net filling {fmtQty(product.net_filling_kg)} kg/carton · shelf life {fmtQty(product.shelf_life_days)} days
            </p>
          )}
          {codes.length > 0 && (
            <div>
              <p className={labelClass}>Batch numbers</p>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {codes.slice(0, 12).map((c) => (
                  <span key={c} className="text-xs px-1.5 py-0.5 rounded bg-[#00e5ff]/10 text-[#00e5ff] border border-[#00e5ff]/30">{c}</span>
                ))}
                {codes.length > 12 && <span className="text-xs text-[#5f6b7f]">+{codes.length - 12} more</span>}
              </div>
            </div>
          )}
        </div>

        {(machine?.status === "Under Maintenance" || conflicts.length > 0) && (
          <div className="rounded-lg border border-[#ff9f43]/40 bg-[#ff9f43]/10 p-3 flex gap-2">
            <AlertTriangle className="w-4 h-4 text-[#ff9f43] shrink-0 mt-0.5" />
            <div className="text-xs text-[#ffb46b] space-y-1">
              {machine?.status === "Under Maintenance" && <p>{machine.name} is under maintenance.</p>}
              {conflicts.length > 0 && (
                <p>Overlaps {conflicts.map((o) => `${o.order_number} (${o.product_name})`).join(", ")} on this machine.</p>
              )}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} className={subtleButton} disabled={saving}>Cancel</Button>
          <Button onClick={save} disabled={saving} className={primaryButton}>
            {saving && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}
            {saving ? "Creating..." : "Create order"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}