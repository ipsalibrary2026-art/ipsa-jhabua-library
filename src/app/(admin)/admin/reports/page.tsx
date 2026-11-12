import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle,
  BookCopy,
  BookOpenCheck,
  CalendarRange,
  CheckCircle2,
  ClipboardList,
  Users,
  X,
} from "lucide-react";
import { and, asc, eq, gte, lt, lte, sql, type SQL } from "drizzle-orm";

import { ReportExportButtons } from "@/components/admin/report-export-buttons";
import { EmptyState } from "@/components/library/empty-state";
import { PageHeader } from "@/components/library/page-header";
import { StatCard } from "@/components/library/stat-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { db } from "@/lib/db";
import { books, courses, issueRecords, students } from "@/lib/db/schema";
import { formatDate, monthLabel, overdueDays, todayISO } from "@/lib/dates";

export const metadata = { title: "Reports" };

type ReportType = "students" | "books" | "overdue" | "monthly";

const reportTabs: { key: ReportType; label: string; description: string }[] = [
  { key: "students", label: "Student-wise", description: "Borrowing activity per student" },
  { key: "books", label: "Book-wise", description: "Demand and availability per title" },
  { key: "overdue", label: "Overdue", description: "Outstanding loans past their due date" },
  { key: "monthly", label: "Monthly", description: "Issue and return volume by month" },
];

function monthsBetween(from: string, to: string) {
  const start = new Date(`${from}T00:00:00`);
  const end = new Date(`${to}T00:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return [];
  start.setDate(1);
  end.setDate(1);
  const result: string[] = [];
  const cursor = new Date(start);
  while (cursor <= end && result.length < 24) {
    result.push(`${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`);
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return result;
}

function defaultRange() {
  const end = new Date();
  const start = new Date(end.getFullYear(), end.getMonth() - 5, 1);
  const toISO = (date: Date) =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  return { from: toISO(start), to: toISO(end) };
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; from?: string; to?: string; course?: string }>;
}) {
  const params = await searchParams;
  const type: ReportType = (["students", "books", "overdue", "monthly"] as const).includes(
    params.type as ReportType,
  )
    ? (params.type as ReportType)
    : "students";
  const range = defaultRange();
  const from = params.from || range.from;
  const to = params.to || range.to;
  const courseFilter = params.course ?? "";
  const today = todayISO();

  const courseList = await db.select().from(courses).orderBy(asc(courses.name));

  const periodFilters: SQL[] = [gte(issueRecords.issueDate, from), lte(issueRecords.issueDate, to)];
  if (courseFilter) periodFilters.push(eq(students.courseId, courseFilter));

  const recordRows = await db
    .select({
      id: issueRecords.id,
      status: issueRecords.status,
      issueDate: issueRecords.issueDate,
      dueDate: issueRecords.dueDate,
      returnDate: issueRecords.returnDate,
      studentId: students.id,
      studentName: students.fullName,
      collegeCode: students.collegeCode,
      courseName: courses.name,
      bookId: books.id,
      bookTitle: books.title,
      bookCode: books.bookCode,
      author: books.author,
      category: books.category,
      totalCopies: books.totalCopies,
      availableCopies: books.availableCopies,
    })
    .from(issueRecords)
    .innerJoin(students, eq(issueRecords.studentId, students.id))
    .innerJoin(books, eq(issueRecords.bookId, books.id))
    .innerJoin(courses, eq(students.courseId, courses.id))
    .where(and(...periodFilters));

  const overdueFilters: SQL[] = [
    eq(issueRecords.status, "issued"),
    lt(issueRecords.dueDate, today),
  ];
  if (courseFilter) overdueFilters.push(eq(students.courseId, courseFilter));

  const overdueRows = await db
    .select({
      id: issueRecords.id,
      studentName: students.fullName,
      collegeCode: students.collegeCode,
      courseName: courses.name,
      bookTitle: books.title,
      bookCode: books.bookCode,
      dueDate: issueRecords.dueDate,
    })
    .from(issueRecords)
    .innerJoin(students, eq(issueRecords.studentId, students.id))
    .innerJoin(books, eq(issueRecords.bookId, books.id))
    .innerJoin(courses, eq(students.courseId, courses.id))
    .where(and(...overdueFilters))
    .orderBy(asc(issueRecords.dueDate));

  let title = "Student-wise issue report";
  let filename = `IPSA-student-issue-report-${from}-to-${to}`;
  let columns: string[] = [];
  let rows: (string | number)[][] = [];
  let summary: { label: string; value: string | number; icon: LucideIcon; tone: "blue" | "emerald" | "amber" | "red" | "slate" | "violet" }[] = [
    { label: "Total records", value: 0, icon: ClipboardList, tone: "blue" as const },
    { label: "Currently issued", value: 0, icon: BookOpenCheck, tone: "blue" as const },
    { label: "Returned", value: 0, icon: CheckCircle2, tone: "emerald" as const },
    { label: "Overdue in period", value: 0, icon: AlertTriangle, tone: "red" as const },
  ];

  if (type === "students") {
    const grouped = new Map<
      string,
      {
        studentName: string;
        collegeCode: string;
        courseName: string;
        total: number;
        active: number;
        returned: number;
        overdue: number;
        lastIssue: string;
      }
    >();

    for (const record of recordRows) {
      const entry =
        grouped.get(record.studentId) ??
        {
          studentName: record.studentName,
          collegeCode: record.collegeCode,
          courseName: record.courseName,
          total: 0,
          active: 0,
          returned: 0,
          overdue: 0,
          lastIssue: record.issueDate,
        };
      entry.total += 1;
      if (record.status === "issued") entry.active += 1;
      if (record.status === "returned") entry.returned += 1;
      if (record.status === "issued" && record.dueDate < today) entry.overdue += 1;
      if (record.issueDate > entry.lastIssue) entry.lastIssue = record.issueDate;
      grouped.set(record.studentId, entry);
    }

    const data = Array.from(grouped.values()).sort((a, b) => b.total - a.total);
    columns = ["Student", "College code", "Course", "Total issues", "Active", "Returned", "Overdue", "Last issue"];
    rows = data.map((item) => [
      item.studentName,
      item.collegeCode,
      item.courseName,
      item.total,
      item.active,
      item.returned,
      item.overdue,
      formatDate(item.lastIssue),
    ]);
    summary = [
      { label: "Students", value: data.length, icon: Users, tone: "violet" },
      {
        label: "Total issues",
        value: data.reduce((sum, item) => sum + item.total, 0),
        icon: ClipboardList,
        tone: "blue",
      },
      {
        label: "Active loans",
        value: data.reduce((sum, item) => sum + item.active, 0),
        icon: BookOpenCheck,
        tone: "blue",
      },
      {
        label: "Overdue",
        value: data.reduce((sum, item) => sum + item.overdue, 0),
        icon: AlertTriangle,
        tone: "red",
      },
    ];
  }

  if (type === "books") {
    const grouped = new Map<
      string,
      {
        title: string;
        bookCode: string;
        author: string;
        category: string;
        total: number;
        active: number;
        available: number;
        totalCopies: number;
      }
    >();

    for (const record of recordRows) {
      const entry =
        grouped.get(record.bookId) ??
        {
          title: record.bookTitle,
          bookCode: record.bookCode,
          author: record.author,
          category: record.category,
          total: 0,
          active: 0,
          available: record.availableCopies,
          totalCopies: record.totalCopies,
        };
      entry.total += 1;
      if (record.status === "issued") entry.active += 1;
      grouped.set(record.bookId, entry);
    }

    const data = Array.from(grouped.values()).sort((a, b) => b.total - a.total);
    title = "Book-wise issue report";
    filename = `IPSA-book-issue-report-${from}-to-${to}`;
    columns = ["Book", "Book ID", "Author", "Category", "Times issued", "Active", "Available / total"];
    rows = data.map((item) => [
      item.title,
      item.bookCode,
      item.author,
      item.category,
      item.total,
      item.active,
      `${item.available} / ${item.totalCopies}`,
    ]);
    summary = [
      { label: "Titles issued", value: data.length, icon: BookCopy, tone: "violet" },
      {
        label: "Total issues",
        value: data.reduce((sum, item) => sum + item.total, 0),
        icon: ClipboardList,
        tone: "blue",
      },
      {
        label: "Active loans",
        value: data.reduce((sum, item) => sum + item.active, 0),
        icon: BookOpenCheck,
        tone: "blue",
      },
      {
        label: "Copies on shelf",
        value: data.reduce((sum, item) => sum + item.available, 0),
        icon: CheckCircle2,
        tone: "emerald",
      },
    ];
  }

  if (type === "overdue") {
    title = "Overdue books report";
    filename = `IPSA-overdue-report-${today}`;
    columns = ["Student", "College code", "Course", "Book", "Book ID", "Due date", "Days overdue"];
    rows = overdueRows.map((item) => [
      item.studentName,
      item.collegeCode,
      item.courseName,
      item.bookTitle,
      item.bookCode,
      formatDate(item.dueDate),
      overdueDays(item.dueDate),
    ]);
    summary = [
      { label: "Overdue loans", value: overdueRows.length, icon: AlertTriangle, tone: "red" },
      {
        label: "Students affected",
        value: new Set(overdueRows.map((item) => item.collegeCode)).size,
        icon: Users,
        tone: "amber",
      },
      {
        label: "Books involved",
        value: new Set(overdueRows.map((item) => item.bookCode)).size,
        icon: BookCopy,
        tone: "violet",
      },
      {
        label: "Longest overdue",
        value: overdueRows.length > 0 ? `${overdueDays(overdueRows[0].dueDate)} days` : "—",
        icon: CalendarRange,
        tone: "slate",
      },
    ];
  }

  if (type === "monthly") {
    const months = monthsBetween(from, to);
    const grouped = new Map(
      months.map((key) => [key, { issued: 0, returned: 0, overdue: 0 }]),
    );

    for (const record of recordRows) {
      const issueKey = record.issueDate.slice(0, 7);
      if (grouped.has(issueKey)) grouped.get(issueKey)!.issued += 1;
      if (record.returnDate) {
        const returnKey = record.returnDate.slice(0, 7);
        if (grouped.has(returnKey)) grouped.get(returnKey)!.returned += 1;
      }
      if (record.status === "issued" && record.dueDate < today && grouped.has(issueKey)) {
        grouped.get(issueKey)!.overdue += 1;
      }
    }

    title = "Monthly library report";
    filename = `IPSA-monthly-report-${from}-to-${to}`;
    columns = ["Month", "Books issued", "Books returned", "Overdue from month"];
    rows = months.map((key) => {
      const item = grouped.get(key)!;
      return [monthLabel(key), item.issued, item.returned, item.overdue];
    });

    const totalIssued = rows.reduce((sum, row) => sum + Number(row[1]), 0);
    const totalReturned = rows.reduce((sum, row) => sum + Number(row[2]), 0);
    const totalOverdue = rows.reduce((sum, row) => sum + Number(row[3]), 0);
    summary = [
      { label: "Months covered", value: months.length, icon: CalendarRange, tone: "violet" },
      { label: "Books issued", value: totalIssued, icon: BookOpenCheck, tone: "blue" },
      { label: "Books returned", value: totalReturned, icon: CheckCircle2, tone: "emerald" },
      { label: "Overdue", value: totalOverdue, icon: AlertTriangle, tone: "red" },
    ];
  }

  function tabHref(key: ReportType) {
    const search = new URLSearchParams();
    search.set("type", key);
    if (from) search.set("from", from);
    if (to) search.set("to", to);
    if (courseFilter) search.set("course", courseFilter);
    return `/admin/reports?${search.toString()}`;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports & exports"
        description="Generate library reports for any period and download them as Excel or PDF."
        actions={
          <ReportExportButtons title={title} filename={filename} columns={columns} rows={rows} />
        }
      />

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {reportTabs.map((tab) => (
          <Button
            key={tab.key}
            variant={type === tab.key ? "default" : "outline"}
            asChild
            className="h-auto justify-start whitespace-normal py-2.5 text-left"
          >
            <Link href={tabHref(tab.key)}>
              <span>
                <span className="block text-sm font-medium">{tab.label}</span>
                <span
                  className={
                    type === tab.key
                      ? "block text-[11px] font-normal text-blue-100"
                      : "block text-[11px] font-normal text-slate-500"
                  }
                >
                  {tab.description}
                </span>
              </span>
            </Link>
          </Button>
        ))}
      </div>

      <form
        method="get"
        className="grid gap-3 rounded-xl border border-slate-200 bg-white p-3 sm:grid-cols-[auto_auto_auto_auto_auto] sm:items-end sm:p-4"
      >
        <input type="hidden" name="type" value={type} />
        <div className="space-y-1.5">
          <label htmlFor="report-from" className="text-xs font-medium text-slate-600">
            From date
          </label>
          <Input
            id="report-from"
            name="from"
            type="date"
            defaultValue={from}
            disabled={type === "overdue"}
            className="h-10 sm:w-40"
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="report-to" className="text-xs font-medium text-slate-600">
            To date
          </label>
          <Input
            id="report-to"
            name="to"
            type="date"
            defaultValue={to}
            disabled={type === "overdue"}
            className="h-10 sm:w-40"
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="report-course" className="text-xs font-medium text-slate-600">
            Course
          </label>
          <select
            id="report-course"
            name="course"
            defaultValue={courseFilter}
            className="h-10 w-full rounded-md border border-input bg-white px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 sm:w-48"
          >
            <option value="">All courses</option>
            {courseList.map((course) => (
              <option key={course.id} value={course.id}>
                {course.name}
              </option>
            ))}
          </select>
        </div>
        <Button type="submit" className="h-10">
          Generate
        </Button>
        <Button variant="outline" size="icon" asChild className="h-10 w-10">
          <Link href={`/admin/reports?type=${type}`} aria-label="Reset report filters">
            <X className="size-4" />
          </Link>
        </Button>
      </form>

      {type === "overdue" ? (
        <p className="text-xs text-slate-500">
          The overdue report always reflects the current date. The date range does not apply to it.
        </p>
      ) : null}

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {summary.map((item) => (
          <StatCard
            key={item.label}
            label={item.label}
            value={item.value}
            icon={item.icon}
            tone={item.tone}
          />
        ))}
      </div>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-4 py-3 sm:px-5">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
            <p className="text-xs text-slate-500">
              {type === "overdue"
                ? `${rows.length} outstanding loans`
                : `${formatDate(from)} – ${formatDate(to)}`}
              {courseFilter
                ? ` · ${courseList.find((course) => course.id === courseFilter)?.name ?? "Course"}`
                : " · All courses"}
            </p>
          </div>
          <p className="text-xs text-slate-500">{rows.length} rows</p>
        </div>

        {rows.length === 0 ? (
          <div className="p-4 sm:p-5">
            <EmptyState
              icon={ClipboardList}
              title="No data for this report"
              description="Adjust the date range or course filter, or issue books to create activity."
              action={
                <Button variant="outline" asChild>
                  <Link href={`/admin/reports?type=${type}`}>Reset filters</Link>
                </Button>
              }
            />
          </div>
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                    {columns.map((column) => (
                      <th key={column} className="px-4 py-3 font-medium">
                        {column}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((row, rowIndex) => (
                    <tr key={rowIndex} className="hover:bg-slate-50/70">
                      {row.map((cell, cellIndex) => (
                        <td
                          key={cellIndex}
                          className={
                            cellIndex === 0
                              ? "px-4 py-3 font-medium text-slate-900"
                              : "px-4 py-3 text-slate-700"
                          }
                        >
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="divide-y divide-slate-100 md:hidden">
              {rows.map((row, rowIndex) => (
                <div key={rowIndex} className="p-4">
                  <p className="text-sm font-medium text-slate-900">{row[0]}</p>
                  <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
                    {columns.slice(1).map((column, columnIndex) => (
                      <div key={column}>
                        <dt className="text-slate-500">{column}</dt>
                        <dd className="text-slate-800">{row[columnIndex + 1]}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              ))}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
