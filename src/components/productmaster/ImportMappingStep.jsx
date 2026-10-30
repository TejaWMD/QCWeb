import React from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowRight, Sparkles } from "lucide-react";
import { CUSTOM_TARGET, MAPPING_TARGETS, REQUIRED_TARGETS, mappedTargets } from "@/lib/productImportFlow";
import { selectClass, subtleButton, panelClass, labelClass } from "@/components/planning/styles";

const TARGETS = [...MAPPING_TARGETS, { key: CUSTOM_TARGET, label: "Keep as custom field" }];

// Column mapping: the target list holds every datasheet field.
export default function ImportMappingStep({ columns = [], mapping = {}, setMapping, onReset, saveMapping, setSaveMapping }) {
  const used = mappedTargets(mapping);
  const missingRequired = REQUIRED_TARGETS.filter((key) => !used.has(key));

  const setColumn = (index, value) => {
    const next = { ...mapping };
    if (!value || value === "ignore") delete next[index];
    else next[index] = value;
    setMapping(next);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-[#a0aec0]">Match each column in the file to a datasheet field.</p>
        <Button variant="outline" onClick={onReset} className={subtleButton}>
          <Sparkles className="w-4 h-4 mr-1.5" /> Reset to best guess
        </Button>
      </div>

      {missingRequired.length > 0 && (
        <p className="text-xs text-[#ff9f43]">
          Map these before continuing: {missingRequired.map((key) => MAPPING_TARGETS.find((t) => t.key === key)?.label).join(", ")}
        </p>
      )}

      <div className={`${panelClass} divide-y divide-[#131926] max-h-[46vh] overflow-y-auto`}>
        {columns.map((column) => (
          <div key={column.index} className="grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr] items-center gap-2 px-3 py-2">
            <div>
              <p className="text-sm text-white">{column.label}</p>
              <p className="text-[10px] text-[#5f6b7f]">Column {column.index + 1}</p>
            </div>
            <ArrowRight className="w-4 h-4 text-[#5f6b7f] hidden sm:block" />
            <Select value={mapping[column.index] || "ignore"} onValueChange={(v) => setColumn(column.index, v)}>
              <SelectTrigger className={selectClass}><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ignore">Ignore this column</SelectItem>
                {TARGETS.map((target) => (
                  <SelectItem key={target.key} value={target.key}>{target.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ))}
      </div>

      <label className="flex items-center gap-2 text-xs text-[#a0aec0]">
        <Checkbox checked={saveMapping} onCheckedChange={(v) => setSaveMapping(!!v)} />
        Remember this mapping for the next file with the same columns
      </label>
      <p className={labelClass}>Net filling and cartons per batch are calculated by the system; mapped values are only checked.</p>
    </div>
  );
}