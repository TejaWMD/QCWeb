import React, { useEffect, useState } from "react";
import { Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/AuthContext";
import { DEFAULT_SETTINGS, canEditYieldSettings, loadYieldSettings } from "@/lib/yieldLoss";
import YieldLossDashboard from "@/components/yieldloss/YieldLossDashboard";
import BatchYieldTab from "@/components/yieldloss/BatchYieldTab";
import PackagingWasteTab from "@/components/yieldloss/PackagingWasteTab";
import GiveawayTab from "@/components/yieldloss/GiveawayTab";
import ReworkTab from "@/components/yieldloss/ReworkTab";
import YieldLossSettingsDialog from "@/components/yieldloss/YieldLossSettingsDialog";
import { subtleButton } from "@/components/planning/styles";

const TABS = [
  { key: "dashboard", label: "Dashboard" },
  { key: "yield", label: "Batch Yield" },
  { key: "waste", label: "Packaging Waste" },
  { key: "giveaway", label: "Giveaway" },
  { key: "rework", label: "Rework" },
];

// Yield & Loss: ingredient yield per batch, packaging waste per line, giveaway
// (overfilling) and rework, all measured from the existing production records.
export default function YieldLoss() {
  const { user } = useAuth();
  const [tab, setTab] = useState("dashboard");
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const load = async () => setSettings(await loadYieldSettings());

  useEffect(() => { load(); }, []);

  return (
    <div className="min-h-screen bg-[#0a0e17] p-4 md:p-6 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-white text-lg font-semibold">Yield &amp; Loss</h2>
          <p className="text-[#a0aec0] text-sm mt-1">
            Ingredient yield, packaging waste, giveaway and rework — measured against Product Master, Recipe Master and the stock movements.
          </p>
        </div>
        {canEditYieldSettings(user) && (
          <Button variant="outline" onClick={() => setSettingsOpen(true)} className={subtleButton}>
            <Settings2 className="w-4 h-4 mr-1.5" /> Settings
          </Button>
        )}
      </div>

      <div className="flex flex-wrap gap-1 border-b border-[#1e2740]">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-3 py-2 text-sm border-b-2 -mb-px transition-colors ${
              tab === t.key
                ? "border-[#00e5ff] text-[#00e5ff]"
                : "border-transparent text-[#a0aec0] hover:text-white"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <p className="text-[11px] text-[#5f6b7f]">
        Yield tolerance ±{settings.yield_tolerance_pct}% · waste threshold {settings.packaging_waste_threshold_pct}% · max rework {settings.max_rework_pct}%
      </p>

      {tab === "dashboard" && <YieldLossDashboard settings={settings} />}
      {tab === "yield" && <BatchYieldTab settings={settings} />}
      {tab === "waste" && <PackagingWasteTab settings={settings} />}
      {tab === "giveaway" && <GiveawayTab settings={settings} />}
      {tab === "rework" && <ReworkTab settings={settings} />}

      <YieldLossSettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} settings={settings} onSaved={load} />
    </div>
  );
}