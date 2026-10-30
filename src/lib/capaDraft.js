import { base44 } from "@/api/base44Client";
import { logSystemAction } from "@/lib/historyLog";

// Auto-creates a CAPA draft for a failed HACCP critical limit or an active
// product hold. Skips creation when a draft already exists for the same
// source record, so raising it repeatedly never duplicates.
export const createCapaDraft = async (user, { title, source_module, production_line, shift_date, description, source_record_id }) => {
  try {
    const existing = await base44.entities.CAPA.filter({ source_record_id }, { limit: 1 });
    if (existing.items?.length) return existing.items[0];
    const today = new Date().toISOString().slice(0, 10);
    const created = await base44.entities.CAPA.create({
      title,
      source_module,
      source_record_id,
      production_line: production_line || "",
      shift_date: shift_date || today,
      description: description || "",
      status: "Open",
    });
    // The app raised this draft on its own, so it is recorded as a system action.
    await logSystemAction({
      module: "Unified CAPA Tracker",
      action: "Created",
      entity: "CAPA",
      recordId: created?.id || "",
      details: `CAPA draft auto-created from ${source_module || "a quality record"}: ${title}`,
      newValue: "Open",
      changes: [`Status: — → Open`, `Raised by: System`, `Source: ${source_module || "quality record"}`],
    });
    return created;
  } catch {
    return null;
  }
};