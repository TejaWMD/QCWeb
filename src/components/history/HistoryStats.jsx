import React from "react";
import KpiCard from "@/components/factoryops/KpiCard";
import { Activity, Database, History, UserRound, Zap } from "lucide-react";

export default function HistoryStats({ stats, loading }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
      <KpiCard
        icon={History}
        title="Actions in view"
        value={loading ? "—" : stats.total.toLocaleString()}
        valueSub="Matching the filters above"
      />
      <KpiCard
        icon={Activity}
        title="Today"
        value={loading ? "—" : stats.today.toLocaleString()}
        valueSub="Logged since midnight"
      />
      <KpiCard
        icon={UserRound}
        title="User actions"
        value={loading ? "—" : (stats.total - stats.system).toLocaleString()}
        stats={[{ text: `${stats.users} user${stats.users === 1 ? "" : "s"} involved`, tone: "muted" }]}
      />
      <KpiCard
        icon={Zap}
        title="System actions"
        value={loading ? "—" : stats.system.toLocaleString()}
        stats={[{ text: `${stats.changes.toLocaleString()} data changes`, tone: "cyan" }]}
      />
    </div>
  );
}