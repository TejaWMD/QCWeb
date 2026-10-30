import React from "react";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import Field from "@/components/planning/Field";
import { PRODUCT_CATEGORIES } from "@/lib/planning";
import { PRODUCT_STATUSES, SIZE_UNITS } from "@/lib/productMaster";
import { inputClass, selectClass } from "@/components/planning/styles";

// Identity block of the product datasheet: brand, name, pack size, status.
export default function IdentityFields({ form, set, brands = [], codeTaken, disabled }) {
  const brandOptions = Array.from(new Set([...(brands || []), form.brand].filter(Boolean)));

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <Field label="Brand">
        <Select value={form.brand || undefined} onValueChange={(v) => set("brand", v)} disabled={disabled}>
          <SelectTrigger className={selectClass}><SelectValue placeholder="Select brand" /></SelectTrigger>
          <SelectContent>
            {brandOptions.length === 0 && <SelectItem value="none" disabled>Add brands in Settings</SelectItem>}
            {brandOptions.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}
          </SelectContent>
        </Select>
      </Field>
      <Field label="Product Name">
        <Input value={form.product_name} onChange={(e) => set("product_name", e.target.value)} className={inputClass} placeholder="Full product name" disabled={disabled} />
      </Field>
      <Field label="Product Code" hint={codeTaken ? "This code is already used by another product" : "Short code used in batch numbers"}>
        <Input
          value={form.product_code}
          onChange={(e) => set("product_code", e.target.value.toUpperCase())}
          className={`${inputClass} ${codeTaken ? "border-[#ff4d4d]" : ""}`}
          placeholder="RCE"
          disabled={disabled}
        />
      </Field>
      <Field label="Category">
        <Select value={form.category || undefined} onValueChange={(v) => set("category", v)} disabled={disabled}>
          <SelectTrigger className={selectClass}><SelectValue placeholder="Select category" /></SelectTrigger>
          <SelectContent>
            {PRODUCT_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
      </Field>
      <Field label="Size Value">
        <Input type="number" min="0" step="0.01" value={form.size_value} onChange={(e) => set("size_value", e.target.value)} className={inputClass} placeholder="500" disabled={disabled} />
      </Field>
      <Field label="Size Unit">
        <Select value={form.size_unit || undefined} onValueChange={(v) => set("size_unit", v)} disabled={disabled}>
          <SelectTrigger className={selectClass}><SelectValue placeholder="Select unit" /></SelectTrigger>
          <SelectContent>
            {SIZE_UNITS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
          </SelectContent>
        </Select>
      </Field>
      <Field label="Status" hint="Pending products cannot be used for orders or labels">
        <Select value={form.status || "Active"} onValueChange={(v) => set("status", v)} disabled={disabled}>
          <SelectTrigger className={selectClass}><SelectValue /></SelectTrigger>
          <SelectContent>
            {PRODUCT_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
      </Field>
      <Field label="Hide from new records" hint="Hidden products stay on old records but leave the dropdowns">
        <label className="flex items-center gap-2 text-sm text-[#a0aec0] pt-2">
          <Checkbox checked={!!form.hidden} onCheckedChange={(v) => set("hidden", !!v)} disabled={disabled} />
          Hidden
        </label>
      </Field>
    </div>
  );
}