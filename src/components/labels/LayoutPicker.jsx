import React from "react";
import { Input } from "@/components/ui/input";
import { ECC_LEVELS, DEFAULT_LAYOUTS } from "@/lib/labels";
import { inputClass, labelClass } from "@/components/planning/styles";

const sizeText = (layout) => `${layout.width_mm} × ${layout.height_mm} mm · ${layout.qr_mm} mm QR · ECC ${layout.qr_ecc}`;

// Layout buttons; "Custom Manual" opens the width, height and font size fields.
export default function LayoutPicker({ layouts = DEFAULT_LAYOUTS, value, custom, onSelect, onCustomChange }) {
  const list = layouts.length ? layouts : DEFAULT_LAYOUTS;
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {list.map((layout) => {
          const active = layout.id === value;
          return (
            <button
              key={layout.id}
              type="button"
              onClick={() => onSelect(layout.id)}
              className={`text-left rounded-lg border px-2.5 py-2 transition-colors ${
                active
                  ? "border-[#00e5ff] bg-[#00e5ff]/10 text-white"
                  : "border-[#1e2740] bg-[#0a0e17] text-[#a0aec0] hover:border-[#2a3654] hover:text-white"
              }`}
            >
              <span className="block text-xs font-semibold">{layout.name}</span>
              <span className="block text-[10px] text-[#5f6b7f] mt-0.5">{sizeText(layout)}</span>
            </button>
          );
        })}
      </div>

      {value === "custom" && (
        <div className="grid grid-cols-3 gap-2 pt-1">
          <div className="space-y-1">
            <label className={labelClass}>Width (mm)</label>
            <Input type="number" min="20" step="0.5" value={custom.width_mm} onChange={(e) => onCustomChange({ ...custom, width_mm: e.target.value })} className={inputClass} />
          </div>
          <div className="space-y-1">
            <label className={labelClass}>Height (mm)</label>
            <Input type="number" min="20" step="0.5" value={custom.height_mm} onChange={(e) => onCustomChange({ ...custom, height_mm: e.target.value })} className={inputClass} />
          </div>
          <div className="space-y-1">
            <label className={labelClass}>Font size (pt)</label>
            <Input type="number" min="4" step="0.5" value={custom.font_size} onChange={(e) => onCustomChange({ ...custom, font_size: e.target.value })} className={inputClass} />
          </div>
          <div className="space-y-1">
            <label className={labelClass}>QR size (mm)</label>
            <Input type="number" min="5" step="0.5" value={custom.qr_mm} onChange={(e) => onCustomChange({ ...custom, qr_mm: e.target.value })} className={inputClass} />
          </div>
          <div className="space-y-1">
            <label className={labelClass}>QR error correction</label>
            <div className="flex gap-1">
              {ECC_LEVELS.map((level) => (
                <button
                  key={level}
                  type="button"
                  onClick={() => onCustomChange({ ...custom, qr_ecc: level })}
                  className={`flex-1 rounded-md border px-1 py-1.5 text-xs font-semibold ${
                    custom.qr_ecc === level
                      ? "border-[#00e5ff] bg-[#00e5ff]/10 text-[#00e5ff]"
                      : "border-[#1e2740] text-[#a0aec0] hover:text-white"
                  }`}
                >
                  {level}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}