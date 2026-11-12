"use client";

import { useState } from "react";
import { Download, FileSpreadsheet, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

export function ReportExportButtons({
  title,
  filename,
  columns,
  rows,
}: {
  title: string;
  filename: string;
  columns: string[];
  rows: (string | number)[][];
}) {
  const [loading, setLoading] = useState<"excel" | "pdf" | null>(null);

  async function exportExcel() {
    setLoading("excel");
    try {
      const XLSX = await import("xlsx");
      const sheet = XLSX.utils.aoa_to_sheet([columns, ...rows]);
      sheet["!cols"] = columns.map((column) => ({ wch: Math.min(Math.max(column.length + 4, 12), 48) }));
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, sheet, "Report");
      XLSX.writeFile(workbook, `${filename}.xlsx`);
      toast.success("Excel report downloaded.");
    } catch {
      toast.error("Could not create the Excel file. Please try again.");
    } finally {
      setLoading(null);
    }
  }

  async function exportPdf() {
    setLoading("pdf");
    try {
      const [{ jsPDF }, autoTableModule] = await Promise.all([
        import("jspdf"),
        import("jspdf-autotable"),
      ]);
      const doc = new jsPDF({ orientation: columns.length > 6 ? "landscape" : "portrait" });
      doc.setFontSize(14);
      doc.setTextColor(15, 23, 42);
      doc.text(title, 14, 16);
      doc.setFontSize(9);
      doc.setTextColor(100, 116, 139);
      doc.text("IPSA College Library · Generated " + new Date().toLocaleString("en-IN"), 14, 22);

      autoTableModule.default(doc, {
        head: [columns],
        body: rows.map((row) => row.map((cell) => String(cell))),
        startY: 28,
        styles: { fontSize: 8, cellPadding: 2.5, overflow: "linebreak" },
        headStyles: { fillColor: [29, 78, 216], textColor: 255, fontStyle: "bold" },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        margin: { left: 14, right: 14 },
      });

      doc.save(`${filename}.pdf`);
      toast.success("PDF report downloaded.");
    } catch {
      toast.error("Could not create the PDF file. Please try again.");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" onClick={exportExcel} disabled={loading !== null || rows.length === 0}>
        {loading === "excel" ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <FileSpreadsheet className="size-4" />
        )}
        Export Excel
      </Button>
      <Button variant="outline" onClick={exportPdf} disabled={loading !== null || rows.length === 0}>
        {loading === "pdf" ? <Loader2 className="size-4 animate-spin" /> : <FileText className="size-4" />}
        Export PDF
      </Button>
      <span className="sr-only">
        <Download className="size-4" />
      </span>
    </div>
  );
}
