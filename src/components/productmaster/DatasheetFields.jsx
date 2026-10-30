import React from "react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import Field from "@/components/planning/Field";
import { DEFAULT_CUSTOMER, derivedFields, num } from "@/lib/productMaster";
import { inputClass, selectClass } from "@/components/planning/styles";

const unique = (...lists) => [...new Set(lists.flat().filter(Boolean))];

// The datasheet fields; the calculated columns are shown but never typed in.
export default function DatasheetFields({ form, set, brands = [], customers = [], machines = [], recipeNames = [] }) {
  const derived = derivedFields({
    carton_size: form.carton_size,
    net_weight_kg: form.net_weight_kg,
    batch_output_kg: form.batch_output_kg,
    shelf_life_months: form.shelf_life_months,
    cooking_time_hr: form.cooking_time_hr,
  });
  const brandOptions = unique(brands, [form.brand]);
  const customerOptions = unique([DEFAULT_CUSTOMER], customers, [form.customer]);
  const machineOptions = unique(machines, [form.default_machine]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Field label="Item Code *">
          <Input value={form.product_code} onChange={(e) => set("product_code", e.target.value)} className={inputClass} placeholder="RSPT350GX12" />
        </Field>
        <Field label="Carton Description *" hint="Item description as printed on the carton">
          <Input value={form.product_name} onChange={(e) => set("product_name", e.target.value)} className={inputClass} placeholder="RASTO TRADITIONAL PASTA SAUCE 350G X 12" />
        </Field>
        <Field label="Brand">
          <Select value={form.brand || undefined} onValueChange={(v) => set("brand", v)}>
            <SelectTrigger className={selectClass}><SelectValue placeholder="Choose brand" /></SelectTrigger>
            <SelectContent>
              {brandOptions.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Field label="Recipe Name" hint="Products sharing a name share one recipe">
          <>
            <Input value={form.recipe_name} onChange={(e) => set("recipe_name", e.target.value)} className={inputClass} placeholder="RASTO TRADITIONAL PASTA SAUCE" list="recipe-name-options" />
            <datalist id="recipe-name-options">
              {recipeNames.map((name) => <option key={name} value={name} />)}
            </datalist>
          </>
        </Field>
        <Field label="Line Type" hint="SAUCE, POUCH, SYRUP — not a machine">
          <Input value={form.line_type} onChange={(e) => set("line_type", e.target.value)} className={inputClass} placeholder="SAUCE" />
        </Field>
        <Field label="Cooking Time (hr)">
          <Input type="number" min="0" step="0.25" value={form.cooking_time_hr} onChange={(e) => set("cooking_time_hr", e.target.value)} className={inputClass} placeholder="1.75" />
        </Field>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Field label="Pcs per Carton">
          <Input type="number" min="0" value={form.carton_size} onChange={(e) => set("carton_size", e.target.value)} className={inputClass} placeholder="12" />
        </Field>
        <Field label="Net Weight / Pc (kg)">
          <Input type="number" min="0" step="0.001" value={form.net_weight_kg} onChange={(e) => set("net_weight_kg", e.target.value)} className={inputClass} placeholder="0.35" />
        </Field>
        <Field label="Batch Output (kg)">
          <Input type="number" min="0" value={form.batch_output_kg} onChange={(e) => set("batch_output_kg", e.target.value)} className={inputClass} placeholder="608" />
        </Field>
        <Field label="Net Filling (kg/Carton)" hint="Calculated">
          <div className="h-9 flex items-center px-3 rounded-md border border-[#1e2740] bg-[#0a0e17] text-[#00e5ff] font-semibold">{derived.net_filling_kg || "—"}</div>
        </Field>
        <Field label="Cartons per Batch" hint="Calculated">
          <div className="h-9 flex items-center px-3 rounded-md border border-[#1e2740] bg-[#0a0e17] text-[#00e5ff] font-semibold">{derived.cartons_per_batch || "—"}</div>
        </Field>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Field label="Batch Code" hint="3-letter prefix in batch numbers">
          <Input value={form.batch_prefix} onChange={(e) => set("batch_prefix", e.target.value.toUpperCase().slice(0, 6))} className={inputClass} placeholder="RTP" />
        </Field>
        <Field label="Shelf Life (Months)">
          <Input type="number" min="0" value={form.shelf_life_months} onChange={(e) => set("shelf_life_months", e.target.value)} className={inputClass} placeholder="12" />
        </Field>
        <Field label="Customer" hint="Empty means GENERAL">
          <Select value={form.customer || DEFAULT_CUSTOMER} onValueChange={(v) => set("customer", v)}>
            <SelectTrigger className={selectClass}><SelectValue /></SelectTrigger>
            <SelectContent>
              {customerOptions.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Status">
          <Select value={form.status === "Active" ? "Active" : "Inactive"} onValueChange={(v) => set("status", v)}>
            <SelectTrigger className={selectClass}><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Active">Active</SelectItem>
              <SelectItem value="Inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </Field>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Field label="SKU Barcode" hint="Stored as text">
          <Input value={form.barcode} onChange={(e) => set("barcode", e.target.value)} className={inputClass} placeholder="9555721709349" />
        </Field>
        <Field label="Carton Barcode" hint="May be empty">
          <Input value={form.carton_barcode} onChange={(e) => set("carton_barcode", e.target.value)} className={inputClass} placeholder="9555721709424" />
        </Field>
        <Field label="Default Machine" hint="Optional; pre-selects the line on scheduling">
          <Select value={form.default_machine || undefined} onValueChange={(v) => set("default_machine", v)}>
            <SelectTrigger className={selectClass}><SelectValue placeholder="Not set" /></SelectTrigger>
            <SelectContent>
              {machineOptions.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Field label="Remarks">
          <Input value={form.remarks} onChange={(e) => set("remarks", e.target.value)} className={inputClass} placeholder="Optional remark" />
        </Field>
        <Field label="Net Filling check" hint={`${num(form.carton_size)} pcs × ${num(form.net_weight_kg)} kg`}>
          <div className="h-9 flex items-center px-3 rounded-md border border-[#1e2740] bg-[#0a0e17] text-[#5f6b7f] text-xs">
            Cartons per batch = {num(form.batch_output_kg)} ÷ {derived.net_filling_kg || "—"} = {derived.cartons_per_batch || "—"}
          </div>
        </Field>
      </div>
    </div>
  );
}