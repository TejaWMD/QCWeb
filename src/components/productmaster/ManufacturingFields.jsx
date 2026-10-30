import React from "react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import Field from "@/components/planning/Field";
import { num } from "@/lib/productMaster";
import { inputClass, selectClass } from "@/components/planning/styles";

// Manufacturing block: line, batch prefix, shelf life and timings.
export default function ManufacturingFields({ form, set, machines = [], disabled }) {
  const lineNames = Array.from(new Set([...machines.map((m) => m.name), form.line_code].filter(Boolean)));
  const months = num(form.shelf_life_months);

  const setMonths = (value) => {
    set("shelf_life_months", value);
    set("shelf_life_days", value === "" ? "" : num(value) * 30);
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <Field label="Line Code" hint="Linked to the Machines list">
        <Select value={form.line_code || undefined} onValueChange={(v) => set("line_code", v)} disabled={disabled}>
          <SelectTrigger className={selectClass}><SelectValue placeholder="Select line / machine" /></SelectTrigger>
          <SelectContent>
            {lineNames.length === 0 && <SelectItem value="none" disabled>No machines yet</SelectItem>}
            {lineNames.map((name) => <SelectItem key={name} value={name}>{name}</SelectItem>)}
          </SelectContent>
        </Select>
      </Field>
      <Field label="Batch Prefix" hint="Used with the pattern to build batch numbers">
        <Input value={form.batch_prefix} onChange={(e) => set("batch_prefix", e.target.value.toUpperCase())} className={inputClass} placeholder="RCE" disabled={disabled} />
      </Field>
      <Field label="Shelf Life (months)" hint="Days are stored too: months × 30">
        <Input type="number" min="0" step="1" value={form.shelf_life_months} onChange={(e) => setMonths(e.target.value)} className={inputClass} placeholder="12" disabled={disabled} />
      </Field>
      <Field label="Shelf Life (days)">
        <Input type="number" min="0" step="1" value={form.shelf_life_days} onChange={(e) => set("shelf_life_days", e.target.value)} className={inputClass} placeholder={months ? String(months * 30) : "365"} />
      </Field>
      <Field label="Cooking Time (min)">
        <Input type="number" min="0" step="1" value={form.cooking_time_min} onChange={(e) => set("cooking_time_min", e.target.value)} className={inputClass} placeholder="25" disabled={disabled} />
      </Field>
      <Field label="Batch Output (kg)" hint="Needed before the product can be scheduled">
        <Input type="number" min="0" step="0.1" value={form.batch_output_kg} onChange={(e) => set("batch_output_kg", e.target.value)} className={inputClass} placeholder="180" disabled={disabled} />
      </Field>
      <Field label="Packing Time (min)">
        <Input type="number" min="0" step="1" value={form.packing_time_min} onChange={(e) => set("packing_time_min", e.target.value)} className={inputClass} placeholder="15" disabled={disabled} />
      </Field>
      <Field label="Standard Batch (cartons)" hint="Used by order generation">
        <Input type="number" min="0" value={form.standard_batch_cartons} onChange={(e) => set("standard_batch_cartons", e.target.value)} className={inputClass} placeholder="100" disabled={disabled} />
      </Field>
    </div>
  );
}