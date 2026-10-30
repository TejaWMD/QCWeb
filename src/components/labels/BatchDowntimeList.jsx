import React from "react";
import { Link } from "react-router-dom";
import { Clock } from "lucide-react";
import { fmtDay } from "@/lib/labels";
import { fmtDuration } from "@/lib/production";
import { panelClass, labelClass } from "@/components/planning/styles";

// Downtime events logged on this machine while the batch was running.
export default function BatchDowntimeList({ events = [] }) {
  return (
    <div className={`${panelClass} p-4`}>
      <p className={`${labelClass} flex items-center gap-1 mb-2`}>
        <Clock className="w-3 h-3" /> Machine downtime in this batch window
      </p>
      {events.length === 0 ? (
        <p className="text-xs text-[#5f6b7f]">No downtime was logged on this machine during the production window.</p>
      ) : (
        <ul className="space-y-1.5">
          {events.map((event) => (
            <li key={event.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs border-b border-[#131926] last:border-0 pb-1.5 last:pb-0">
              <span className="text-white font-semibold whitespace-nowrap">
                {event.start_time || "—"}–{event.end_time || "open"}
              </span>
              <span className="text-[#a0aec0]">{fmtDay(event.shift_date)}</span>
              <span className="text-[#ff9f43]">{event.category || "Downtime"}</span>
              <span className="text-[#5f6b7f]">{event.duration_min ? fmtDuration(event.duration_min) : ""}</span>
              <span className="text-[#a0aec0] flex-1 min-w-[160px] truncate">{event.reason || "—"}</span>
              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full border ${
                event.status === "Resolved"
                  ? "text-[#00ff9d] border-[#00ff9d]/30 bg-[#00ff9d]/10"
                  : "text-[#ff4d4d] border-[#ff4d4d]/40 bg-[#ff4d4d]/10"
              }`}>
                {event.status || "Open"}
              </span>
            </li>
          ))}
        </ul>
      )}
      {events.length > 0 && (
        <Link to="/downtime" className="inline-block mt-2 text-[11px] text-[#00e5ff] hover:underline">
          Open Requests &amp; Stoppages
        </Link>
      )}
    </div>
  );
}