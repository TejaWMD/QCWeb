import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus, X } from "lucide-react";
import { DEFAULT_UNITS, SETTINGS_KEY } from "@/lib/warehouse";

const FIELD = "bg-[#0e131d] border-[#1e2740] text-white";

// Units of measure offered on the receiving form, stored in Warehouse Settings.
export default function UnitSettingsCard({ updatedBy }) {
  const [docId, setDocId] = useState(null);
  const [units, setUnits] = useState(DEFAULT_UNITS);
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const page = await base44.entities.WarehouseSettings.filter({ key: SETTINGS_KEY }, { limit: 1 });
      const doc = (page.items || [])[0];
      if (doc) {
        setDocId(doc.id);
        setUnits(Array.isArray(doc.units) && doc.units.length ? doc.units : DEFAULT_UNITS);
      }
    })();
  }, []);

  const persist = async (next) => {
    setUnits(next);
    setBusy(true);
    try {
      const payload = { key: SETTINGS_KEY, units: next, updated_by: updatedBy || "" };
      if (docId) await base44.entities.WarehouseSettings.update(docId, payload);
      else setDocId((await base44.entities.WarehouseSettings.create(payload)).id);
    } finally {
      setBusy(false);
    }
  };

  const add = () => {
    const unit = value.trim();
    if (!unit || units.includes(unit)) return;
    setValue("");
    persist([...units, unit]);
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder="New unit (e.g. drum)"
          className={FIELD}
        />
        <Button onClick={add} disabled={busy} className="bg-[#00e5ff] hover:bg-[#00c3d7] text-[#0a0e17] shrink-0">
          <Plus className="w-4 h-4" /> Add
        </Button>
      </div>
      <div className="flex flex-wrap gap-2">
        {units.map((unit) => (
          <span key={unit} className="flex items-center gap-1.5 rounded-md border border-[#1e2740] bg-[#0e131d] px-2.5 py-1.5 text-sm text-white">
            {unit}
            <button
              type="button"
              onClick={() => persist(units.filter((u) => u !== unit))}
              disabled={busy || units.length === 1}
              className="text-[#5f6b7f] hover:text-[#ff4d4d] disabled:opacity-40"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </span>
        ))}
      </div>
    </div>
  );
}