import React, { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Field from "@/components/planning/Field";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { dialogClass, inputClass, selectClass, primaryButton, subtleButton, panelClass, labelClass } from "@/components/planning/styles";
import { useAuth } from "@/lib/AuthContext";
import { useToast } from "@/components/ui/use-toast";
import { base44 } from "@/api/base44Client";
import { actingUserName } from "@/lib/permissions";
import { num } from "@/lib/planning";
import { productionLines } from "@/lib/shiftLogConstants";
import { todayStr } from "@/lib/warehouse";
import { createCapaDraft } from "@/lib/capaDraft";
import { SHIFTS, fillSummary, logYieldAudit } from "@/lib/yieldLoss";

const blankSamples = () => ["", "", "", "", ""];
const clockNow = () => new Date().toTimeString().slice(0, 5);

// Fill-weight check: several sample weights per check, averaged into giveaway.
export default function FillCheckDialog({ open, onClose, products = [], records = [], onSaved }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [form, setForm] = useState({ check_date: todayStr(), check_time: clockNow(), production_line: "", shift_type: "Morning", product_id: "", batch_number: "", notes: "" });
  const [samples, setSamples] = useState(blankSamples());
  const [raiseCapa, setRaiseCapa] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setError("");
    setSamples(blankSamples());
    setRaiseCapa(true);
    setForm({ check_date: todayStr(), check_time: clockNow(), production_line: "", shift_type: "Morning", product_id: "", batch_number: "", notes: "" });
  }, [open]);

  const product = products.find((p) => p.id === form.product_id) || null;
  const batch = records.find((r) => r.batch_number === form.batch_number) || null;
  const packs = product && batch ? num(batch.quantity_cartons) * num(product.carton_size) : 0;
  const target = num(product?.target_net_weight_g);
  const lower = num(product?.lower_tolerance_g);
  const summary = useMemo(
    () => fillSummary({ samples, targetG: target, lowerG: lower, packs, costPerKg: product?.cost_per_kg }),
    [samples, target, lower, packs, product]
  );

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));
  const setSample = (index, value) => setSamples((prev) => prev.map((s, i) => (i === index ? value : s)));

  const productBatches = records.filter((r) => r.product_id === form.product_id);

  const save = async () => {
    if (!form.production_line) return setError("Select the line.");
    if (!product) return setError("Select the product.");
    if (!(target > 0)) return setError("This product has no target net weight in Product Master.");
    if (!summary.sample_count) return setError("Enter at least one sample weight.");
    setSaving(true);
    setError("");
    try {
      const payload = {
        check_date: form.check_date,
        check_time: form.check_time,
        production_line: form.production_line,
        shift_type: form.shift_type,
        product_id: product.id,
        product_code: product.product_code || "",
        product_name: product.product_name || "",
        batch_number: form.batch_number || "",
        target_weight_g: target,
        lower_limit_g: lower,
        samples: samples.map(num).filter((v) => v > 0),
        sample_count: summary.sample_count,
        avg_g: summary.avg_g,
        giveaway_g: summary.giveaway_g,
        giveaway_pct: summary.giveaway_pct,
        cost_per_kg: num(product.cost_per_kg),
        packs_in_batch: packs,
        cost_per_batch: summary.cost_per_batch,
        underweight_count: summary.underweight_count,
        compliance_risk: summary.compliance_risk,
        status: "Draft",
        owner: actingUserName(user),
        owner_id: user?.id || "",
        notes: form.notes.trim(),
      };
      const created = await base44.entities.FillCheck.create(payload);

      if (summary.compliance_risk && raiseCapa && created?.id) {
        const capa = await createCapaDraft(user, {
          title: `Underweight packs on ${form.production_line} · ${product.product_name}`,
          source_module: "Yield & Loss — Fill Weight",
          production_line: form.production_line,
          shift_date: form.check_date,
          description: `${summary.underweight_count} of ${summary.sample_count} samples fell below the ${lower} g underweight limit (average ${summary.avg_g} g, target ${target} g). Batch ${form.batch_number || "—"}.`,
          source_record_id: created.id,
        });
        if (capa?.id) await base44.entities.FillCheck.update(created.id, { capa_id: capa.id });
      }

      await logYieldAudit({
        user,
        action: "Created",
        recordId: created?.id || `${form.check_date}-${form.production_line}`,
        details: `Fill check ${form.production_line} · ${product.product_code} · avg ${summary.avg_g} g, giveaway ${summary.giveaway_g} g (${summary.giveaway_pct}%)`,
        newValue: summary.compliance_risk ? `Underweight risk (${summary.underweight_count} sample(s))` : "Within limits",
      });
      toast({
        title: "Fill check saved",
        description: summary.compliance_risk ? "Underweight sample flagged — a CAPA draft was raised." : `Giveaway ${summary.giveaway_pct}%`,
      });
      onSaved?.();
      onClose();
    } catch (e) {
      setError(e?.message || "Could not save the fill check.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className={dialogClass}>
        <DialogHeader>
          <DialogTitle className="text-white">New Fill-Weight Check</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Field label="Date">
            <Input type="date" value={form.check_date} onChange={(e) => set("check_date", e.target.value)} className={inputClass} />
          </Field>
          <Field label="Time">
            <Input type="time" value={form.check_time} onChange={(e) => set("check_time", e.target.value)} className={inputClass} />
          </Field>
          <Field label="Shift">
            <Select value={form.shift_type} onValueChange={(v) => set("shift_type", v)}>
              <SelectTrigger className={selectClass}><SelectValue /></SelectTrigger>
              <SelectContent>{SHIFTS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Line">
            <Select value={form.production_line || undefined} onValueChange={(v) => set("production_line", v)}>
              <SelectTrigger className={selectClass}><SelectValue placeholder="Select line" /></SelectTrigger>
              <SelectContent>{productionLines.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Product" className="sm:col-span-2">
            <Select value={form.product_id || undefined} onValueChange={(v) => set("product_id", v)}>
              <SelectTrigger className={selectClass}><SelectValue placeholder="Select product" /></SelectTrigger>
              <SelectContent>
                {products.map((p) => <SelectItem key={p.id} value={p.id}>{p.product_code} — {p.product_name}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Batch" className="sm:col-span-2" hint={form.product_id ? "Optional" : "Select a product first"}>
            <Select value={form.batch_number || undefined} onValueChange={(v) => set("batch_number", v)}>
              <SelectTrigger className={selectClass}><SelectValue placeholder="Optional" /></SelectTrigger>
              <SelectContent>
                {productBatches.slice(0, 100).map((r) => <SelectItem key={r.id} value={r.batch_number}>{r.batch_number}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
        </div>

        <div>
          <p className={`${labelClass} mb-1`}>Sample weights (g)</p>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            {samples.map((value, index) => (
              <Input key={index} type="number" step="0.1" value={value} onChange={(e) => setSample(index, e.target.value)} className={inputClass} placeholder={`#${index + 1}`} />
            ))}
          </div>
          <Button variant="outline" onClick={() => setSamples((prev) => [...prev, ""])} className="mt-2 border-dashed border-[#1e2740] bg-transparent text-[#a0aec0] hover:bg-white/5 hover:text-white">
            Add sample
          </Button>
        </div>

        <div className={`${panelClass} p-3 grid grid-cols-2 sm:grid-cols-4 gap-2`}>
          <div><p className={labelClass}>Target</p><p className="text-white text-sm font-semibold">{target ? `${target} g` : "not set"}</p></div>
          <div><p className={labelClass}>Average</p><p className="text-white text-sm font-semibold">{summary.sample_count ? `${summary.avg_g} g` : "—"}</p></div>
          <div><p className={labelClass}>Giveaway</p><p className={`text-sm font-semibold ${summary.giveaway_g > 0 ? "text-[#ff9f43]" : "text-[#00ff9d]"}`}>{summary.sample_count ? `${summary.giveaway_g} g · ${summary.giveaway_pct}%` : "—"}</p></div>
          <div><p className={labelClass}>Cost / batch</p><p className="text-white text-sm font-semibold">{product?.cost_per_kg && packs ? `${summary.cost_per_batch.toLocaleString("en-US")}` : "—"}</p></div>
        </div>

        {summary.compliance_risk && (
          <div className="rounded-lg border border-[#ff4d4d]/50 bg-[#ff4d4d]/10 px-3 py-2 space-y-2">
            <p className="text-xs text-[#ff4d4d] font-semibold">
              {summary.underweight_count} sample{summary.underweight_count === 1 ? "" : "s"} below the {lower} g underweight limit.
            </p>
            <label className="flex items-center gap-2 text-xs text-[#e2e8f0]">
              <Checkbox checked={raiseCapa} onCheckedChange={(v) => setRaiseCapa(!!v)} />
              Raise a CAPA for this compliance risk
            </label>
          </div>
        )}
        {product && !lower && <p className="text-[11px] text-[#ff9f43]">Set the lower tolerance on this product to screen for underweight packs.</p>}
        {error && <p className="text-sm text-[#ff4d4d]">{error}</p>}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} className={subtleButton}>Cancel</Button>
          <Button onClick={save} disabled={saving} className={primaryButton}>{saving ? "Saving..." : "Save check"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}