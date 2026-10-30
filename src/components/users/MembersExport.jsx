import React from "react";
import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import { Button } from "@/components/ui/button";
import { Download, FileText } from "lucide-react";

// Exports the current member list (members plus open invitations) as Excel or PDF.
export default function MembersExport({ rows }) {
  const columns = [
    { header: "Name", key: "name", width: 56 },
    { header: "Email", key: "email", width: 78 },
    { header: "Role", key: "role", width: 22 },
    { header: "Status", key: "status", width: 34 },
    { header: "Sign-in Date", key: "joined", width: 40 },
  ];

  const exportExcel = () => {
    const data = rows.map((r) => ({
      Name: r.name,
      Email: r.email,
      Role: r.role,
      Status: r.status,
      "Sign-in Date": r.joined,
    }));
    const ws = XLSX.utils.json_to_sheet(data.length ? data : [{}]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Members");
    XLSX.writeFile(wb, "user-management-members.xlsx");
  };

  const exportPdf = () => {
    const doc = new jsPDF();
    doc.setFontSize(14);
    doc.text("User Management - Members", 14, 18);
    doc.setFontSize(9);
    let y = 30;
    doc.setTextColor(120);
    let hx = 14;
    columns.forEach((col) => {
      doc.text(col.header, hx, y);
      hx += col.width;
    });
    y += 7;
    doc.setTextColor(40);
    rows.forEach((row) => {
      if (y > 285) {
        doc.addPage();
        y = 20;
      }
      let x = 14;
      columns.forEach((col) => {
        doc.text(String(row[col.key] || "-").slice(0, 45), x, y);
        x += col.width;
      });
      y += 7;
    });
    doc.save("user-management-members.pdf");
  };

  return (
    <div className="flex gap-2">
      <Button variant="outline" onClick={exportExcel}>
        <Download className="w-4 h-4 mr-1" /> Excel
      </Button>
      <Button variant="outline" onClick={exportPdf}>
        <FileText className="w-4 h-4 mr-1" /> PDF
      </Button>
    </div>
  );
}