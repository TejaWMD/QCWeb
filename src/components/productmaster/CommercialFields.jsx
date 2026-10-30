import React from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import Field from "@/components/planning/Field";
import ChannelPicker from "@/components/productmaster/ChannelPicker";
import { checkBarcode } from "@/lib/productMaster";
import { inputClass } from "@/components/planning/styles";

// Commercial block: barcode, channels, net weight and remarks.
export default function CommercialFields({ form, set, channels = [], disabled }) {
  const barcode = (form.barcode || "").trim();
  const check = barcode ? checkBarcode(barcode) : null;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <Field
        label="SKU Barcode"
        hint={check && !check.ok ? `Warning: ${check.reason} — should be 8, 12 or 13 digits with a valid check digit` : "Unit barcode used for traceability"}
      >
        <Input
          value={form.barcode}
          onChange={(e) => set("barcode", e.target.value.replace(/\s/g, ""))}
          className={`${inputClass} ${check && !check.ok ? "border-[#ff9f43]" : ""}`}
          placeholder="9556123456789"
          disabled={disabled}
        />
      </Field>
      <Field label="Net Weight (g)" hint="Used for yield output and giveaway">
        <Input type="number" min="0" step="0.1" value={form.target_net_weight_g} onChange={(e) => set("target_net_weight_g", e.target.value)} className={inputClass} placeholder="200" disabled={disabled} />
      </Field>
      <Field label="Customer / Channel" className="sm:col-span-2">
        <ChannelPicker value={form.channels} onChange={(v) => set("channels", v)} options={channels} disabled={disabled} />
      </Field>
      <Field label="Remarks" className="sm:col-span-2">
        <Textarea value={form.remarks} onChange={(e) => set("remarks", e.target.value)} className={`${inputClass} min-h-[60px]`} placeholder="Optional" disabled={disabled} />
      </Field>
    </div>
  );
}