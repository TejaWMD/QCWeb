import React from "react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function WastagePickerRow({ title, options, value, onValueChange, usedValue, wasteValue, onWasteChange, placeholder }) {
  const hasSelection = !!value;
  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden">
      {title &&
      <div className="px-3 py-1.5 bg-slate-100 text-xs font-semibold text-slate-600 uppercase tracking-wide border-b border-slate-200">
          {title}
        </div>
      }
      <table className="w-full text-sm">
        <thead className="bg-slate-50 border-b border-slate-200">
          <tr>
            <th className="px-3 py-2 text-left font-medium text-slate-600">Component</th>
            <th className="px-3 py-2 text-right font-medium text-slate-600 w-28">Used</th>
            <th className="px-3 py-2 text-right font-medium text-slate-600 w-28">Wasted</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="px-2 py-1.5">
              <Select value={value || undefined} onValueChange={onValueChange}>
                <SelectTrigger className="h-8 bg-[hsl(var(--sidebar-border))]"><SelectValue placeholder={placeholder || "Select"} /></SelectTrigger>
                <SelectContent className="max-h-72">
                  {options.map((c) =>
                  <SelectItem key={c.key} value={c.key}>{c.label}</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </td>
            <td className="px-2 py-1.5">
              <Input value={usedValue} readOnly className="h-8 text-right bg-slate-50 font-semibold text-slate-500" />
            </td>
            <td className="px-2 py-1.5">
              <Input
                type="number"
                value={wasteValue}
                disabled={!hasSelection}
                onChange={(e) => onWasteChange(Number(e.target.value))}
                className="h-8 text-right"
                placeholder={hasSelection ? "0" : ""} />
              
            </td>
          </tr>
        </tbody>
      </table>
    </div>);

}