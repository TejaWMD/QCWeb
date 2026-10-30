import { base44 } from "@/api/base44Client";

// Any item past its due date automatically becomes "Overdue" so it shows up on
// the Attention Dashboard. Best-effort: entities the caller cannot read are skipped.
const SWEEP_ENTITIES = ["Task", "CAPA", "HACCPCheck", "ProductHold", "QualityDefect", "HalalVerification", "StaffingRecord"];

export const sweepOverdue = async () => {
  const today = new Date().toISOString().slice(0, 10);
  for (const name of SWEEP_ENTITIES) {
    try {
      const page = await base44.entities[name].filter(
        { status: { $in: ["Open", "In Progress"] }, due_date: { $lt: today } },
        { limit: 200 }
      );
      const ids = (page.items || []).map((r) => r.id);
      if (ids.length > 0) {
        await base44.entities[name].updateMany({ id: { $in: ids } }, { $set: { status: "Overdue" } });
      }
    } catch {
      // Skip an entity the caller cannot read.
    }
  }
};