import React, { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Home from "@/pages/Home";
import OperationLogs from "@/pages/OperationLogs";
import OvertimeRecord from "@/pages/OvertimeRecord";
import WastageLogs from "@/pages/WastageLogs";
import BaselineCapacity from "@/pages/BaselineCapacity";
import ActivityLogs from "@/pages/ActivityLogs";

// The former Packaging Ops pages, now one "Production Line Logs" hub. Each tab
// renders the original page component unchanged, so every form, table, chart
// and filter behaves exactly as it did on its own page.
const TABS = [
  { value: "overview", label: "Overview", Component: Home },
  { value: "operation_record", label: "Operation Record", Component: OperationLogs },
  { value: "overtime_record", label: "Overtime Record", Component: OvertimeRecord },
  { value: "wastage_records", label: "Wastage Record", Component: WastageLogs },
  { value: "baseline_capacity", label: "Baseline Capacity", Component: BaselineCapacity },
  { value: "activity_logs", label: "Activity Logs", Component: ActivityLogs },
];

const STORAGE_KEY = "production_line_logs_active_tab";

export default function ProductionLineLogs() {
  const [tab, setTab] = useState(() => {
    // Remember the last tab the user opened.
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (TABS.some((t) => t.value === saved)) return saved;
    } catch { /* ignore unavailable storage */ }
    return "overview";
  });

  const onTabChange = (value) => {
    setTab(value);
    try {
      localStorage.setItem(STORAGE_KEY, value);
    } catch { /* ignore unavailable storage */ }
  };

  return (
    <div className="min-h-screen bg-[#0a0e17]">
      <Tabs value={tab} onValueChange={onTabChange} className="w-full">
        <div className="sticky top-0 z-20 bg-[#0a0e17]/95 backdrop-blur border-b border-[#1e2740] px-4 md:px-6 py-3">
          <TabsList className="bg-[#131926] border border-[#1e2740] h-auto p-1 flex gap-1 w-max max-w-full overflow-x-auto">
            {TABS.map((t) => (
              <TabsTrigger
                key={t.value}
                value={t.value}
                className="flex-none rounded-full px-4 py-1.5 text-sm whitespace-nowrap text-[#a0aec0] hover:text-white data-[state=active]:bg-[#00e5ff] data-[state=active]:text-[#0a0e17] data-[state=active]:shadow-[0_0_12px_rgba(0,229,255,0.35)] data-[state=active]:hover:text-[#0a0e17]"
              >
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
        {TABS.map((t) => (
          <TabsContent key={t.value} value={t.value} className="mt-0 focus-visible:outline-none">
            <t.Component />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}