import React from "react";
import { Link } from "react-router-dom";
import { FlaskConical, Package } from "lucide-react";
import { fmtDay } from "@/lib/labels";
import { fmtQty } from "@/lib/production";
import { panelClass, labelClass } from "@/components/planning/styles";

const LotChip = ({ lot }) => (
  <Link
    to={`/traceability?lot=${encodeURIComponent(lot)}`}
    className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full border border-[#00e5ff]/30 bg-[#00e5ff]/5 text-[#00e5ff] hover:bg-[#00e5ff]/15"
    title="Trace this lot to every finished batch"
  >
    {lot}
  </Link>
);

// Ingredient lots from the recipe and the packaging issued to this batch, each
// lot linking forward to every finished batch that used it.
export default function BatchLotLinks({ lots = [], packaging = [] }) {
  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
      <div className={`${panelClass} p-4`}>
        <p className={`${labelClass} flex items-center gap-1 mb-2`}>
          <FlaskConical className="w-3 h-3" /> Ingredient lots
        </p>
        {lots.length === 0 ? (
          <p className="text-xs text-[#5f6b7f]">This product has no active recipe, so no ingredient lots can be linked.</p>
        ) : (
          <ul className="space-y-2">
            {lots.map((material) => (
              <li key={material.code || material.name}>
                <p className="text-xs text-white">
                  {material.name}
                  <span className="text-[10px] text-[#5f6b7f] ml-1.5">
                    {material.code}{material.perBatch ? ` · ${fmtQty(material.perBatch)} ${material.unit} per batch` : ""}
                  </span>
                </p>
                {material.lots.length === 0 ? (
                  <p className="text-[11px] text-[#ff9f43]">No goods receipt found for this material.</p>
                ) : (
                  <div className="flex flex-wrap items-center gap-1.5 mt-1">
                    {material.lots.slice(0, 8).map((entry) => (
                      <span key={`${material.code}-${entry.lot}`} className="inline-flex items-center gap-1.5">
                        <LotChip lot={entry.lot} />
                        <span className="text-[10px] text-[#5f6b7f]">
                          {entry.supplier || "supplier not set"} · {fmtQty(entry.quantity)} {entry.unit}
                          {entry.date_received ? ` · ${fmtDay(entry.date_received)}` : ""}
                        </span>
                      </span>
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className={`${panelClass} p-4`}>
        <p className={`${labelClass} flex items-center gap-1 mb-2`}>
          <Package className="w-3 h-3" /> Packaging issued
        </p>
        {packaging.length === 0 ? (
          <p className="text-xs text-[#5f6b7f]">No packaging stock has been issued against this batch or its order yet.</p>
        ) : (
          <ul className="space-y-2">
            {packaging.map((item) => (
              <li key={item.code || item.name}>
                <p className="text-xs text-white">
                  {item.name}
                  <span className="text-[10px] text-[#5f6b7f] ml-1.5">{fmtQty(item.quantity)} {item.unit} issued</span>
                </p>
                <div className="flex flex-wrap items-center gap-1.5 mt-1">
                  {item.lots.map((entry, index) => (
                    entry.lot === "—" ? (
                      <span key={index} className="text-[10px] text-[#5f6b7f]">no lot recorded</span>
                    ) : (
                      <span key={index} className="inline-flex items-center gap-1.5">
                        <LotChip lot={entry.lot} />
                        <span className="text-[10px] text-[#5f6b7f]">
                          {fmtQty(entry.quantity)} {item.unit}{entry.movement_date ? ` · ${fmtDay(entry.movement_date)}` : ""}
                        </span>
                      </span>
                    )
                  ))}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}