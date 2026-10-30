import React from "react";

// Distinguishes historical records from entries recorded after the batch split.
export default function BatchBadge({ value }) {
  const isLegacy = value !== "current";
  return (
    <span
      className={`inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
        isLegacy
          ? "text-amber-700 bg-amber-50 border-amber-200"
          : "text-emerald-700 bg-emerald-50 border-emerald-200"
      }`}
    >
      {isLegacy ? "Legacy" : "New"}
    </span>
  );
}