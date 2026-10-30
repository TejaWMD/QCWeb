import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Plus, Pencil, Trash2, LayoutDashboard } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import BaselineCapacityModal from "@/components/baseline/BaselineCapacityModal";
import { pcsPerCarton } from "@/lib/packingConfig";
import { canAccess, canChangeRecord } from "@/lib/permissions";

function ComplexityBadge({ value }) {
  if (!value) return <span className="text-slate-400">—</span>;
  const map = {
    Low: "text-green-700 bg-green-50",
    Medium: "text-amber-700 bg-amber-50",
    High: "text-red-700 bg-red-50"
  };
  return (
    <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${map[value] || "text-slate-600 bg-slate-100"}`}>
      {value}
    </span>);

}

export default function BaselineCapacity() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [lineFilter, setLineFilter] = useState("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [editRec, setEditRec] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const { items } = await base44.entities.BaselineCapacity.filter({}, { sort: "product_name", limit: 500 });
      setRecords(items);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    base44.auth.me().then(setCurrentUser).catch(() => {});
  }, []);

  const handleSave = async (formData) => {
    if (editRec) {
      await base44.entities.BaselineCapacity.update(editRec.id, formData);
    } else {
      await base44.entities.BaselineCapacity.create(formData);
    }
    setModalOpen(false);
    setEditRec(null);
    load();
  };

  const handleDelete = async (id) => {
    await base44.entities.BaselineCapacity.delete(id);
    load();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" />
      </div>);

  }

  const isAdmin = currentUser?.role === "admin";
  const canEnter = canAccess(currentUser, "baseline_capacity");
  const q = search.trim().toLowerCase();
  const lineOptions = Array.from(new Set(records.map((r) => r.packing_line_code).filter(Boolean))).sort();
  const filtered = records.filter((r) => {
    const lineOk = lineFilter === "all" || r.packing_line_code === lineFilter;
    const qOk = !q || (r.product_name || "").toLowerCase().includes(q) || (r.packing_line_code || "").toLowerCase().includes(q);
    return lineOk && qOk;
  });
  const lines = lineOptions.length;
  const avgUPH = records.length ?
  Math.round(records.reduce((s, r) => s + (r.theoretical_uph || 0), 0) / records.length) :
  0;

  const groups = Object.entries(
    filtered.reduce((acc, r) => {
      const key = r.packing_line_code || "Unassigned";
      (acc[key] = acc[key] || []).push(r);
      return acc;
    }, {})
  ).sort((a, b) => a[0].localeCompare(b[0]));

  const or = (v) => v === null || v === undefined || v === "" ? "—" : v;

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold mb-1 [font-family:'Rubik_Mono_One',_system-ui] bg-[#064382] text-[#ead7d7]">Baseline Capacity Parameterization &amp; Rate Configuration Record</h2>
          <p className="text-slate-500 text-sm">Standard setting baseline: line setup, throughput rates, manpower and changeover complexity per product.</p>
        </div>
        <div className="flex items-center gap-2">
          {canEnter &&
          <Button onClick={() => {setEditRec(null);setModalOpen(true);}} className="bg-sky-600 hover:bg-sky-700 text-white">
              <Plus className="w-4 h-4 mr-1" /> Add Record
            </Button>
          }
          <Link to="/">
            <Button variant="outline" className="border-slate-300">
              <LayoutDashboard className="w-4 h-4 mr-1" /> Dashboard
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-slate-200 px-4 py-3">
          <p className="text-xs text-slate-500">Total Products</p>
          <p className="text-xl font-bold text-slate-800">{records.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 px-4 py-3">
          <p className="text-xs text-slate-500">Packing Lines</p>
          <p className="text-xl font-bold text-slate-800">{lines}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 px-4 py-3">
          <p className="text-xs text-slate-500">Avg Theoretical UPH</p>
          <p className="text-xl font-bold text-sky-600">{avgUPH}</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 px-4 py-3 flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search product or line..."
            className="pl-9" />
          
        </div>
        <div className="w-48">
          <Select value={lineFilter} onValueChange={setLineFilter}>
            <SelectTrigger><SelectValue placeholder="All lines" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All lines</SelectItem>
              {lineOptions.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <span className="text-xs text-slate-400">{filtered.length} records across {groups.length} line{groups.length !== 1 ? "s" : ""}</span>
      </div>

      <div className="space-y-4">
        {groups.map(([line, items]) =>
        <div key={line} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-4 py-3 bg-slate-100 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-slate-800">{line}</span>
                <span className="text-xs text-slate-500">{items.length} product{items.length !== 1 ? "s" : ""}</span>
              </div>
              <span className="text-xs text-slate-500">Avg Theo UPH: <span className="font-semibold text-sky-600">{Math.round(items.reduce((s, r) => s + (r.theoretical_uph || 0), 0) / items.length)}</span></span>
            </div>
            <div className="overflow-auto max-h-[440px]">
              <table className="w-full text-sm whitespace-nowrap">
                <thead className="border-b border-slate-200">
                  <tr className="text-slate-500 text-left">
                    <th className="px-3 py-3 font-medium sticky left-0 top-0 z-30 bg-slate-50 border-r border-slate-200">Product Name</th>
                    <th className="px-3 py-3 font-medium sticky top-0 z-20 bg-slate-50">Thermal</th>
                    <th className="px-3 py-3 font-medium sticky top-0 z-20 bg-slate-50">Line Setup</th>
                    <th className="px-3 py-3 font-medium sticky top-0 z-20 bg-slate-50">Config Type</th>
                    <th className="px-3 py-3 font-medium text-right sticky top-0 z-20 bg-[#fff7d6]">Pcs / Carton</th>
                    <th className="px-3 py-3 font-medium sticky top-0 z-20 bg-slate-50">Next Step</th>
                    <th className="px-3 py-3 font-medium text-right sticky top-0 z-20 bg-slate-50">Setup (min)</th>
                    <th className="px-3 py-3 font-medium text-right sticky top-0 z-20 bg-slate-50">Downtime (min)</th>
                    <th className="px-3 py-3 font-medium text-right sticky top-0 z-20 bg-slate-50">Manpower</th>
                    <th className="px-3 py-3 font-medium sticky top-0 z-20 bg-slate-50">UPC</th>
                    <th className="px-3 py-3 font-medium text-right sticky top-0 z-20 bg-slate-50">UPM</th>
                    <th className="px-3 py-3 font-medium text-right sticky top-0 z-20 bg-slate-50">Theo UPH</th>
                    <th className="px-3 py-3 font-medium text-right sticky top-0 z-20 bg-slate-50">Adj UPH</th>
                    <th className="px-3 py-3 font-medium sticky top-0 z-20 bg-slate-50">Complexity</th>
                    <th className="px-3 py-3 font-medium sticky top-0 z-20 bg-slate-50">Remarks</th>
                    <th className="px-3 py-3 sticky top-0 z-20 bg-slate-50"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items.map((r) =>
                <tr key={r.id} className="group hover:bg-slate-50">
                      <td className="px-3 py-3 text-slate-700 max-w-xs truncate sticky left-0 z-10 bg-white group-hover:bg-slate-50 border-r border-slate-200" title={r.product_name}>{r.product_name}</td>
                      <td className="px-3 py-3 text-slate-600">{r.thermal_state || "—"}</td>
                      <td className="px-3 py-3 text-slate-600">{r.line_setup || "—"}</td>
                      <td className="px-3 py-3 text-slate-600">{r.packaging_config_type || "—"}</td>
                      <td className="px-3 py-3 text-right font-semibold text-slate-700 bg-[#fff7d6]">{pcsPerCarton(r.product_name) || "—"}</td>
                      <td className="px-3 py-3 text-slate-600">{r.next_step || "—"}</td>
                      <td className="px-3 py-3 text-right text-slate-700">{or(r.machine_setup_time_min)}</td>
                      <td className="px-3 py-3 text-right text-slate-700">{or(r.acceptable_downtime_min)}</td>
                      <td className="px-3 py-3 text-right text-slate-700">{or(r.manpower_req)}</td>
                      <td className="px-3 py-3 text-slate-600">{r.unit_per_cycle || "—"}</td>
                      <td className="px-3 py-3 text-right text-slate-700">{or(r.unit_per_minute)}</td>
                      <td className="px-3 py-3 text-right text-slate-700">{or(r.theoretical_uph)}</td>
                      <td className="px-3 py-3 text-right text-slate-700">{or(r.adjusted_uph)}</td>
                      <td className="px-3 py-3"><ComplexityBadge value={r.changeover_complexity} /></td>
                      <td className="px-3 py-3 text-slate-500 max-w-[220px] truncate" title={[r.remarks_viscosity, r.remarks_thermal, r.remarks_packaging].filter(Boolean).join(" | ")}>
                        {[r.remarks_viscosity, r.remarks_thermal, r.remarks_packaging].filter(Boolean).join(" | ") || "—"}
                      </td>
                      <td className="px-3 py-3 text-right whitespace-nowrap">
                        {canChangeRecord(currentUser, r) &&
                    <Button variant="ghost" size="sm" onClick={() => {setEditRec(r);setModalOpen(true);}} className="text-slate-400 hover:text-sky-600 mr-1">
                            <Pencil className="w-4 h-4" />
                          </Button>
                    }
                        {isAdmin &&
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(r.id)} className="text-slate-400 hover:text-red-500">
                            <Trash2 className="w-4 h-4" />
                          </Button>
                    }
                      </td>
                    </tr>
                )}
                </tbody>
              </table>
            </div>
          </div>
        )}
        {groups.length === 0 &&
        <div className="bg-white rounded-xl border border-slate-200 px-4 py-10 text-center text-slate-400">No records found.</div>
        }
      </div>

      <BaselineCapacityModal
        open={modalOpen}
        onClose={() => {setModalOpen(false);setEditRec(null);}}
        onSave={handleSave}
        editData={editRec} />
      
    </div>);

}