import React from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ActivityLogTable from "@/components/activity/ActivityLogTable";
import ShiftLogEntriesTable from "@/components/activity/ShiftLogEntriesTable";

export default function ActivityLogs() {
  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-slate-800 mb-1">Activity Logs</h2>
        <p className="text-slate-500 text-sm">
          Every entry submitted, changed or removed across Shift Log, Operation Record, Overtime Record and Wastage
          Record — with the exact fields that changed.
        </p>
      </div>

      <Tabs defaultValue="activity">
        <TabsList>
          <TabsTrigger value="activity">Activity Log</TabsTrigger>
          <TabsTrigger value="shift-logs">Shift Log Entries</TabsTrigger>
        </TabsList>
        <TabsContent value="activity" className="mt-4">
          <ActivityLogTable />
        </TabsContent>
        <TabsContent value="shift-logs" className="mt-4">
          <ShiftLogEntriesTable />
        </TabsContent>
      </Tabs>
    </div>
  );
}