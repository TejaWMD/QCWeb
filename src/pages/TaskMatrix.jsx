import React, { useEffect, useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { actingUserName } from "@/lib/permissions";
import { productionLines } from "@/lib/shiftLogConstants";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Plus } from "lucide-react";
import AddRecordDialog from "@/components/factoryops/AddRecordDialog";
import StatusBadge from "@/components/factoryops/StatusBadge";
import TaskCellDialog from "@/components/factoryops/TaskCellDialog";

const STATUS_ORDER = ["Open", "In Progress", "Overdue", "Completed", "Verified"];

const addFields = [
  { key: "title", label: "Task", type: "text", required: true },
  { key: "module", label: "Module", type: "select", options: ["Task Matrix", "Production", "QA & HACCP", "Downtime", "Staffing"], default: "Task Matrix" },
  { key: "production_line", label: "Production Line", type: "select", options: productionLines },
  { key: "owner", label: "Supervisor (Owner)", type: "text" },
  { key: "shift_date", label: "Shift Date", type: "date", required: true },
  { key: "due_date", label: "Due Date", type: "date" },
  { key: "priority", label: "Priority", type: "select", options: ["Low", "Medium", "High"], default: "Medium" },
  { key: "notes", label: "Notes", type: "textarea" },
];

const eventStamp = () => {
  const d = new Date();
  return `${d.toISOString().slice(0, 10)} ${d.toTimeString().slice(0, 8)}`;
};

// Supervisor Task Matrix: supervisors as rows, tasks as columns, color-coded by
// status. A cell opens the task detail dialog where evidence is required to
// close and a manager marks it Verified.
export default function TaskMatrix() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [statusFilter, setStatusFilter] = useState(() => {
    const fromUrl = new URLSearchParams(window.location.search).get("status");
    return STATUS_ORDER.includes(fromUrl) ? fromUrl : "all";
  });

  const load = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const data = await base44.entities.Task.list("-created_date", 200);
      setTasks(data);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    const unsubscribe = base44.entities.Task.subscribe(() => load(true));
    return () => { if (typeof unsubscribe === "function") unsubscribe(); };
  }, []);

  const visibleTasks = statusFilter === "all" ? tasks : tasks.filter((t) => t.status === statusFilter);

  const { owners, titles, matrix } = useMemo(() => {
    const ownersList = [];
    const titlesList = [];
    const map = new Map();
    visibleTasks.forEach((t) => {
      const owner = t.owner || "Unassigned";
      if (!ownersList.includes(owner)) ownersList.push(owner);
      if (!titlesList.includes(t.title)) titlesList.push(t.title);
      const key = `${owner}||${t.title}`;
      const prev = map.get(key);
      const rank = (s) => (STATUS_ORDER.includes(s) ? STATUS_ORDER.indexOf(s) : 9);
      if (!prev || rank(t.status) < rank(prev.status)) map.set(key, t);
    });
    return { owners: ownersList, titles: titlesList, matrix: map };
  }, [visibleTasks]);

  const handleAdd = async (values) => {
    const created = await base44.entities.Task.create(values);
    try {
      await base44.entities.AuditLog.create({
        event_time: new Date().toISOString(),
        event_stamp: eventStamp(),
        user_name: actingUserName(user),
        module: "Supervisor Task Matrix",
        action: "Created",
        record_id: created?.id || "",
        details: `Task "${values.title}" created`,
        old_value: "",
        new_value: "Open",
      });
    } catch {
      // An audit write must never block the operation itself.
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0e17] p-4 md:p-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-white text-lg font-semibold">Supervisor Task Matrix</h2>
          <p className="text-[#a0aec0] text-sm mt-1">Supervisors as rows, tasks as columns, color-coded by status. Click a cell to update.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-9 w-[140px] bg-[#0e131d] border-[#1e2740] text-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {STATUS_ORDER.map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={() => setAddOpen(true)} className="bg-[#00e5ff] hover:bg-[#00c3d7] text-[#0a0e17]">
            <Plus className="w-4 h-4 mr-1" /> Add Task
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 text-xs">
        <span className="text-[#a0aec0]">Legend:</span>
        {STATUS_ORDER.map((s) => (
          <StatusBadge key={s} status={s} />
        ))}
      </div>

      <div className="bg-[#131926] rounded-xl border border-[#1e2740] overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="border-[#1e2740] hover:bg-transparent">
              <TableHead className="text-[#a0aec0] min-w-[160px] sticky left-0 bg-[#131926]">Supervisor</TableHead>
              {titles.map((t) => (
                <TableHead key={t} className="text-[#a0aec0] min-w-[140px]">{t}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && (
              <TableRow className="border-[#1e2740]">
                <TableCell colSpan={titles.length + 1} className="text-center py-8">
                  <span className="inline-block w-5 h-5 border-2 border-[#1e2740] border-t-[#00e5ff] rounded-full animate-spin" />
                </TableCell>
              </TableRow>
            )}
            {!loading && tasks.length === 0 && (
              <TableRow className="border-[#1e2740]">
                <TableCell colSpan={titles.length + 1} className="text-center text-[#a0aec0] py-8">
                  {statusFilter === "all" ? "No tasks yet. Use Add Task to create the first one." : "No tasks match this status filter."}
                </TableCell>
              </TableRow>
            )}
            {!loading && owners.map((owner) => (
              <TableRow key={owner} className="border-[#1e2740]">
                <TableCell className="text-sm text-white font-medium sticky left-0 bg-[#131926]">{owner}</TableCell>
                {titles.map((t) => {
                  const task = matrix.get(`${owner}||${t}`);
                  return (
                    <TableCell key={t} className="p-1.5">
                      {task ? (
                        <button type="button" onClick={() => setSelected(task)} className="w-full text-left">
                          <StatusBadge status={task.status} />
                        </button>
                      ) : (
                        <span className="text-[#a0aec0]">—</span>
                      )}
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <AddRecordDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        title="Add Task"
        fields={addFields}
        onSubmit={handleAdd}
      />
      <TaskCellDialog
        task={selected}
        onOpenChange={(open) => { if (!open) setSelected(null); }}
        onUpdated={() => load(true)}
      />
    </div>
  );
}