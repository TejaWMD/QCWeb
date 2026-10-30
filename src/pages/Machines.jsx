import React, { useEffect, useState } from "react";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { Plus, Pencil } from "lucide-react";
import MachineDialog from "@/components/planning/MachineDialog";
import { canEditMachines, loadMachines, num } from "@/lib/planning";
import { productionLines } from "@/lib/shiftLogConstants";
import { primaryButton, subtleButton, panelClass } from "@/components/planning/styles";

const STATUS_STYLES = {
  Active: "bg-[#00ff9d]/10 text-[#00ff9d] border-[#00ff9d]/30",
  "Under Maintenance": "bg-[#ff9f43]/15 text-[#ff9f43] border-[#ff9f43]/40",
};

export default function Machines() {
  const { user } = useAuth();
  const canEdit = canEditMachines(user);
  const [machines, setMachines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialog, setDialog] = useState({ open: false, machine: null });

  const load = async () => {
    setMachines(await loadMachines());
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const availableNames = productionLines.filter((name) => !machines.some((m) => m.name === name));
  const closeDialog = () => setDialog({ open: false, machine: null });

  return (
    <div className="min-h-screen bg-[#0a0e17] p-4 md:p-6 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-white text-lg font-semibold">Machines</h2>
          <p className="text-[#a0aec0] text-sm mt-1">Machine names match the production lines used by the stoppage page.</p>
        </div>
        {canEdit && (
          <Button onClick={() => setDialog({ open: true, machine: null })} className={primaryButton} disabled={availableNames.length === 0}>
            <Plus className="w-4 h-4 mr-1.5" /> Add Machine
          </Button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-[#1e2740] border-t-[#00e5ff] rounded-full animate-spin" />
        </div>
      ) : (
        <div className={`${panelClass} overflow-x-auto`}>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10px] uppercase tracking-widest text-[#5f6b7f] border-b border-[#1e2740]">
                <th className="text-left font-semibold px-3 py-2">Machine</th>
                <th className="text-left font-semibold px-3 py-2">Location</th>
                <th className="text-right font-semibold px-3 py-2">Capacity (ctn/hr)</th>
                <th className="text-left font-semibold px-3 py-2">Status</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {machines.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-8 text-center text-[#a0aec0]">No machines yet.</td>
                </tr>
              ) : (
                machines.map((m) => (
                  <tr key={m.id} className="border-b border-[#131926] hover:bg-white/5">
                    <td className="px-3 py-2 text-white">{m.name}</td>
                    <td className="px-3 py-2 text-[#a0aec0]">{m.location || "—"}</td>
                    <td className="px-3 py-2 text-right text-[#a0aec0]">{num(m.capacity_cph).toLocaleString("en-US") || "—"}</td>
                    <td className="px-3 py-2">
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${STATUS_STYLES[m.status] || STATUS_STYLES.Active}`}>
                        {m.status || "Active"}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right">
                      {canEdit && (
                        <Button variant="ghost" size="icon" onClick={() => setDialog({ open: true, machine: m })} className="text-[#5f6b7f] hover:text-[#00e5ff] hover:bg-[#00e5ff]/10">
                          <Pencil className="w-4 h-4" />
                        </Button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-[#5f6b7f]">
        {machines.length} of {productionLines.length} production line(s) set up.
        {availableNames.length > 0 && canEdit && ` Not yet added: ${availableNames.join(", ")}.`}
      </p>

      <MachineDialog
        open={dialog.open}
        onClose={closeDialog}
        machine={dialog.machine}
        availableNames={availableNames}
        onSaved={async () => { closeDialog(); await load(); }}
      />
    </div>
  );
}