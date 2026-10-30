import React, { useEffect } from "react";
import LabelPreview from "@/components/labels/LabelPreview";
import { printCss } from "@/lib/labels";

// Mounted only while a print job is running. The sheet sits off-screen on the
// monitor and becomes the only visible thing on the printed page: one label per
// page, at the layout's exact size with no margins.
export default function LabelPrintSheet({ job }) {
  const layout = job?.layout;
  const copies = Math.max(1, Math.round(job?.copies || 1));

  useEffect(() => {
    if (!job || !layout) return undefined;
    let cancelled = false;
    const images = Array.from(document.querySelectorAll("#label-print-root img"));
    const loaded = Promise.all(
      images.map((img) => (img.complete ? Promise.resolve() : new Promise((resolve) => {
        img.onload = resolve;
        img.onerror = resolve;
      })))
    );
    const fallback = new Promise((resolve) => setTimeout(resolve, 3000));
    Promise.race([loaded, fallback]).then(() => {
      if (cancelled) return;
      setTimeout(() => { if (!cancelled) window.print(); }, 150);
    });
    return () => { cancelled = true; };
  }, [job, layout]);

  if (!job || !layout) return null;

  return (
    <>
      <style>{printCss(layout)}</style>
      <div id="label-print-root" style={{ position: "fixed", left: "-10000px", top: 0 }}>
        {Array.from({ length: copies }).map((_, index) => (
          <div
            key={index}
            className="label-page"
            style={{ width: `${layout.width_mm}mm`, height: `${layout.height_mm}mm`, overflow: "hidden" }}
          >
            <LabelPreview layout={layout} data={job.data} />
          </div>
        ))}
      </div>
    </>
  );
}