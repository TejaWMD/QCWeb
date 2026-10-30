import React, { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import Field from "@/components/planning/Field";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { dialogClass, inputClass, selectClass, primaryButton, subtleButton, panelClass, labelClass } from "@/components/planning/styles";
import { useAuth } from "@/lib/AuthContext";
import { useToast } from "@/components/ui/use-toast";
import { base44 } from "@/api/base44Client";
import { actingUserName } from "@/lib/permissions";
import { activeRecipe, num } from "@/lib/planning";
import { SHIFTS, fmtKg, fmtPct, issuedIngredientsForBatch, logYieldAudit, outputKgFor, yieldPctFor, yieldVariance } from "@/lib/yieldLoss";

const round2 = (v) => Math.round(num(v) * 100) / 100;

// Ingredient yield for one batch: the input kg comes from the goods issued to the
// batch, the output from the batch cartons and the product net weight.
export default function BatchYieldDialog({ open, onClose, settings, records = [], products = [], recipes = [], orders = [], movements = [], yields = [], onSaved }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [batchId, setBatchId] = useState("");
  const [inputKg, setInputKg] = useState("");
  const [touched, setTouched] = useState(false);
  const [reason, setReason] = useState("");
  const [shift, setShift] = useState("Morning");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const available = useMemo(
    () => records.filter((r) => !yields.some((y) => y.batch_record_id === r.id || y.batch_number === r.batch_number)),
    [records, yields]
  );

  const record = records.find((r) => r.id === batchId) || null;
  const product = products.find((p) => p.id === record?.product_id) || null;
  const recipe = product ? activeRecipe(recipes, product.id) : null;
  const order = record
    ? orders.find((o) => (record.order_id && o.id === record.order_id) || (o.batch_codes || []).includes(record.batch_number)) || null
    : null;
  const auto = issuedIngredientsForBatch({ record, order, recipe, movements });
  const outputKg = outputKgFor({ cartons: record?.quantity_cartons, cartonSize: product?.carton_size, netWeightG: product?.target_net_weight_g });
  const yieldNow = yieldPctFor(outputKg, inputKg);
  const variance = yieldVariance({ yieldPct: yieldNow, standardPct: num(recipe?.standard_yield_pct), tolerancePct: settings.yield_tolerance_pct });
  const overridden = touched && Math.abs(num(inputKg) - round2(auto.kg)) > 0.01;

  useEffect(() => {
    if (!open) return;
    setError("");
    setBatchId("");
    setInputKg("");
    setTouched(false);
    setReason("");
    setShift("Morning");
    setNotes("");
  }, [open]);

  const pickBatch = (id) => {
    setBatchId(id);
    setTouched(false);
    const picked = records.find((r) => r.id === id) || null;
    const pickedProduct = products.find((p) => p.id === picked?.product_id) || null;
    const pickedRecipe = pickedProduct ? activeRecipe(recipes, pickedProduct.id) : null;
    const pickedOrder = picked
      ? orders.find((o) => (picked.order_id && o.id === picked.order_id) || (o.batch_codes || []).includes(picked.batch_number)) || null
      : null;
    const calc = issuedIngredientsForBatch({ record: picked, order: pickedOrder, recipe: pickedRecipe, movements });
    setInputKg(calc.kg ? String(round2(calc.kg)) : "");
  };

  const save = async () => {
    if (!record) return setError("Select the batch this yield belongs to.");
    if (!(num(inputKg) > 0)) return setError("Enter the ingredient input in kg.");
    if (!(outputKg > 0)) return setError("This product has no target net weight in Product Master, so the output kg cannot be calculated.");
    if (overridden && !reason.trim()) return setError("A manual input needs a reason.");
    setSaving(true);
    setError("");
    try {
      const payload = {
        batch_record_id: record.id,
        batch_number: record.batch_number,
        order_number: record.order_number || order?.order_number || "",
        product_id: record.product_id || "",
        product_code: record.product_code || "",
        product_name: record.product_name || "",
        production_line: record.machine || "",
        shift_date: record.production_date || "",
        shift_type: shift,
        cartons: num(record.quantity_cartons),
        carton_size: num(product?.carton_size),
        net_weight_g: num(product?.target_net_weight_g),
        output_kg: round2(outputKg),
        input_auto_kg: round2(auto.kg),
        input_kg: round2(inputKg),
        input_source: overridden ? "Manual" : "Goods Issued",
        issued_lines: auto.lineCount,
        override_reason: overridden ? reason.trim() : "",
        yield_pct: Math.round(yieldNow * 10) / 10,
        standard_yield_pct: num(recipe?.standard_yield_pct),
        tolerance_pct: num(settings.yield_tolerance_pct),
        variance_pct: variance.variance_pct,
        within_tolerance: variance.within_tolerance,
        status: "Draft",
        owner: actingUserName(user),
        owner_id: user?.id || "",
        notes: notes.trim(),
      };
      const created = await base44.entities.BatchYield.create(payload);
      await logYieldAudit({
        user,
        action: "Created",
        recordId: created?.id || record.batch_number,
        details: `Yield for batch ${record.batch_number}: ${payload.yield_pct}% (input ${payload.input_kg} kg, output ${payload.output_kg} kg)${overridden ? " · manual input override" : ""}`,
        newValue: payload.within_tolerance ? "Within tolerance" : "Flagged",
      });
      toast({ title: "Yield recorded", description: `${record.batch_number} · ${payload.yield_pct}%` });
      onSaved?.();
      onClose();
    } catch (e) {
      setError(e?.message || "Could not save the yield.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className={dialogClass}>
        <DialogHeader>
          <DialogTitle className="text-white">New Yield Entry</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Batch" className="sm:col-span-2" hint={available.length ? "Only batches without a yield record are listed" : "Every batch already has a yield record"}>
            <Select value={batchId || undefined} onValueChange={pickBatch}>
              <SelectTrigger className={selectClass}><SelectValue placeholder="Select batch" /></SelectTrigger>
              <SelectContent>
                {available.slice(0, 200).map((r) => (
                  <SelectItem key={r.id} value={r.id}>{r.batch_number} — {r.product_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field label="Input kg" hint={record ? (auto.lineCount ? `Auto from ${auto.lineCount} goods-issued line(s): ${fmtKg(auto.kg)}` : "No matching goods issued — enter it manually") : "Select a batch first"}>
            <Input
              type="number"
              step="0.01"
              value={inputKg}
              onChange={(e) => { setInputKg(e.target.value); setTouched(true); }}
              className={inputClass}
              placeholder="0.00"
            />
          </Field>
          <Field label="Output kg" hint="Cartons × carton size × net weight">
            <Input value={record ? round2(outputKg).toLocaleString("en-US") : ""} readOnly className={`${inputClass} opacity-80`} />
          </Field>

          {overridden && (
            <Field label="Override reason" className="sm:col-span-2" hint="Required when the auto input kg is changed">
              <Input value={reason} onChange={(e) => setReason(e.target.value)} className={inputClass} placeholder="e.g. 12 kg left in the line at handover" />
            </Field>
          )}

          <Field label="Shift">
            <Select value={shift} onValueChange={setShift}>
              <SelectTrigger className={selectClass}><SelectValue /></SelectTrigger>
              <SelectContent>{SHIFTS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Notes">
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} className={inputClass} placeholder="Optional" />
          </Field>
        </div>

        {record && (
          <div className={`${panelClass} p-3 grid grid-cols-2 sm:grid-cols-4 gap-2`}>
            <div><p className={labelClass}>Yield</p><p className="text-white text-sm font-semibold">{fmtPct(yieldNow)}</p></div>
            <div><p className={labelClass}>Standard</p><p className="text-white text-sm font-semibold">{recipe?.standard_yield_pct ? fmtPct(recipe.standard_yield_pct) : "not set"}</p></div>
            <div><p className={labelClass}>Variance</p><p className={`text-sm font-semibold ${variance.within_tolerance ? "text-[#00ff9d]" : "text-[#ff4d4d]"}`}>{variance.variance_pct > 0 ? "+" : ""}{variance.variance_pct}%</p></div>
            <div><p className={labelClass}>Flag</p><p className={`text-sm font-semibold ${variance.within_tolerance ? "text-[#00ff9d]" : "text-[#ff4d4d]"}`}>{variance.within_tolerance ? "Within tolerance" : "Below tolerance"}</p></div>
          </div>
        )}

        {record && !product?.target_net_weight_g && (
          <p className="text-xs text-[#ff9f43]">Set the target net weight on the product in Product Master so the output kg can be calculated.</p>
        )}
        {record && !recipe && <p className="text-xs text-[#ff9f43]">This product has no active recipe, so there is no standard yield to compare against.</p>}
        {error && <p className="text-sm text-[#ff4d4d]">{error}</p>}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} className={subtleButton}>Cancel</Button>
          <Button onClick={save} disabled={saving} className={primaryButton}>{saving ? "Saving..." : "Save yield"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}