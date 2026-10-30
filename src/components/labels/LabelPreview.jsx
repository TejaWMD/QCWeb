import React from "react";
import { barcodeImageUrl, fmtDay, qrImageUrl, traceUrlFor } from "@/lib/labels";

// The label drawn at its exact physical size. Everything is sized in millimetres
// so the browser print output matches the selected layout.
export default function LabelPreview({ layout, data }) {
  const width = layout.width_mm;
  const height = layout.height_mm;
  const fontSize = layout.font_size;
  const qr = Math.min(layout.qr_mm, height - 3, width * 0.62);
  const portrait = height > width;
  const batch = (data.batchNumber || "").trim().toUpperCase() || "BATCH-NO";
  const qrSize = Math.max(6, qr);

  return (
    <div
      style={{
        width: `${width}mm`,
        height: `${height}mm`,
        boxSizing: "border-box",
        padding: "1.2mm",
        background: "#ffffff",
        color: "#000000",
        fontFamily: "Arial, Helvetica, sans-serif",
        fontSize: `${fontSize}pt`,
        lineHeight: 1.15,
        display: "flex",
        flexDirection: portrait ? "column" : "row",
        gap: "1.2mm",
        overflow: "hidden",
      }}
    >
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: "0.4mm" }}>
        <div style={{ fontWeight: 700, fontSize: `${fontSize * 1.18}pt`, lineHeight: 1.1 }}>
          {data.productName || "Product name"}
        </div>
        <div>Code: <strong>{data.productCode || "—"}</strong></div>
        <div style={{ fontWeight: 700, wordBreak: "break-all" }}>Batch: {batch}</div>
        <div>Prod: {fmtDay(data.productionDate)}</div>
        <div>Exp: {fmtDay(data.expiryDate)}</div>
        <div style={{ marginTop: "auto", paddingTop: "0.6mm" }}>
          <img
            src={barcodeImageUrl(batch)}
            alt={`Barcode ${batch}`}
            style={{ display: "block", width: "100%", height: portrait ? "8mm" : "6mm" }}
          />
        </div>
      </div>
      <div
        style={{
          flexShrink: 0,
          width: portrait ? "100%" : `${qrSize}mm`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <img
          src={qrImageUrl(traceUrlFor(batch), layout.qr_ecc)}
          alt={`QR ${batch}`}
          style={{ display: "block", width: `${qrSize}mm`, height: `${qrSize}mm` }}
        />
      </div>
    </div>
  );
}