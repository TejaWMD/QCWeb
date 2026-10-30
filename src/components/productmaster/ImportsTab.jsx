import React, { useState } from "react";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { undoImport } from "@/lib/productImportFlow";
import { Undo2 } from "lucide-react";
import { subtleButton, panelClass } from "@/components/planning/styles";

const when = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
};

// Every import is kept with its counts and can be undone once.
export default function ImportsTab({ imports = [], user, onReload }) {
  const { toast } = useToast();
  const [pending, setPending] = useState("");
  const [busy, setBusy] = useState("");

  const undo = async (record) => {
    if (pending !== record.id) { setPending(record.id); return; }
    setBusy(record.id);
    try {
      await undoImport({ record, user });
      toast({ title: "Import undone", description: `${record.file_name} has been reversed.` });
      setPending("");
      await onReload?.();
    } catch (e) {
      toast({ title: "Could not undo", description: e?.message || "Please try again.", variant: "destructive" });
    } finally {
      setBusy("");
    }
  };

  return (
    <div className={`${panelClass} overflow-x-auto`}>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-[10px] uppercase tracking-widest text-[#5f6b7f] border-b border-[#1e2740]">
            <th className="text-left font-semibold px-3 py-2">File</th>
            <th className="text-left font-semibold px-3 py-2">Imported</th>
            <th className="text-left font-semibold px-3 py-2">By</th>
            <th className="text-right font-semibold px-3 py-2">Created</th>
            <th className="text-right font-semibold px-3 py-2">Updated</th>
            <th className="text-right font-semibold px-3 py-2">Warnings</th>
            <th className="text-right font-semibold px-3 py-2">Errors</th>
            <th className="text-left font-semibold px-3 py-2">Recipes created</th>
            <th className="px-3 py-2" />
          </tr>
        </thead>
        <tbody>
          {imports.length === 0 ? (
            <tr><td colSpan={9} className="px-3 py-8 text-center text-[#a0aec0]">No imports yet.</td></tr>
          ) : imports.map((record) => (
            <tr key={record.id} className="border-b border-[#131926]">
              <td className="px-3 py-2 text-white max-w-[240px] truncate" title={record.file_name}>{record.file_name}</td>
              <td className="px-3 py-2 text-[#a0aec0] whitespace-nowrap">{when(record.imported_at)}</td>
              <td className="px-3 py-2 text-[#a0aec0] whitespace-nowrap">{record.imported_by || "—"}</td>
              <td className="px-3 py-2 text-right text-[#00ff9d]">{record.created_count || 0}</td>
              <td className="px-3 py-2 text-right text-[#00e5ff]">{record.updated_count || 0}</td>
              <td className="px-3 py-2 text-right text-[#ff9f43]">{record.warnings_count || 0}</td>
              <td className="px-3 py-2 text-right text-[#ff4d4d]">{record.errors_count ?? record.skipped_count ?? 0}</td>
              <td className="px-3 py-2 text-[#a0aec0] max-w-[200px] truncate">{(record.recipes_created || []).join(", ") || "—"}</td>
              <td className="px-3 py-2 text-right">
                {record.undone ? (
                  <span className="text-[10px] text-[#5f6b7f]">undone</span>
                ) : (
                  <Button variant="outline" onClick={() => undo(record)} disabled={busy === record.id} className={subtleButton}>
                    <Undo2 className="w-3.5 h-3.5 mr-1.5" />
                    {pending === record.id ? "Confirm undo" : "Undo"}
                  </Button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}