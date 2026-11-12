import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeftRight,
  BookCopy,
  BookOpenCheck,
  CalendarClock,
  CheckCircle2,
  GraduationCap,
  LibraryBig,
  Undo2,
} from "lucide-react";
import { and, asc, desc, eq, gte, isNull, lt, sql } from "drizzle-orm";

import {
  CategoryPieChart,
  CourseIssueChart,
  MonthlyCirculationChart,
} from "@/components/admin/dashboard-charts";
import { EmptyState } from "@/components/library/empty-state";
import { PageHeader } from "@/components/library/page-header";
import { StatCard } from "@/components/library/stat-card";
import { IssueStatusBadge } from "@/components/library/status-badge";
import { Button } from "@/components/ui/button";
import { db } from "@/lib/db";
import { books, courses, issueRecords, students } from "@/lib/db/schema";
import {
  formatDate,
  lastNMonths,
  monthKey,
  monthLabel,
  overdueDays,
  todayISO,
} from "@/lib/dates";

export const metadata = { title: "Dashboard" };

export default async function AdminDashboardPage() {
  const today = todayISO();
  const months = lastNMonths(6);
  const periodStart = `${months[0]}-01`;

  const [
    studentCount,
    bookTotals,
    activeCount,
    returnedCount,
    overdueCount,
    recentRecords,
    overdueBooks,
    categoryRows,
    courseRows,
    circulationRows,
  ] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(students)
      .where(isNull(students.archivedAt)),
    db
      .select({
        titles: sql<number>`count(*)::int`,
        totalCopies: sql<number>`coalesce(sum(${books.totalCopies}), 0)::int`,
        availableCopies: sql<number>`coalesce(sum(${books.availableCopies}), 0)::int`,
      })
      .from(books)
      .where(isNull(books.archivedAt)),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(issueRecords)
      .where(eq(issueRecords.status, "issued")),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(issueRecords)
      .where(eq(issueRecords.status, "returned")),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(issueRecords)
      .where(and(eq(issueRecords.status, "issued"), lt(issueRecords.dueDate, today))),
    db
      .select({
        id: issueRecords.id,
        status: issueRecords.status,
        dueDate: issueRecords.dueDate,
        createdAt: issueRecords.createdAt,
        studentName: students.fullName,
        collegeCode: students.collegeCode,
        bookTitle: books.title,
        bookCode: books.bookCode,
      })
      .from(issueRecords)
      .innerJoin(students, eq(issueRecords.studentId, students.id))
      .innerJoin(books, eq(issueRecords.bookId, books.id))
      .orderBy(desc(issueRecords.createdAt))
      .limit(6),
    db
      .select({
        id: issueRecords.id,
        dueDate: issueRecords.dueDate,
        studentName: students.fullName,
        collegeCode: students.collegeCode,
        bookTitle: books.title,
      })
      .from(issueRecords)
      .innerJoin(students, eq(issueRecords.studentId, students.id))
      .innerJoin(books, eq(issueRecords.bookId, books.id))
      .where(and(eq(issueRecords.status, "issued"), lt(issueRecords.dueDate, today)))
      .orderBy(asc(issueRecords.dueDate))
      .limit(5),
    db
      .select({
        name: books.category,
        value: sql<number>`coalesce(sum(${books.totalCopies}), 0)::int`,
      })
      .from(books)
      .where(isNull(books.archivedAt))
      .groupBy(books.category)
      .orderBy(desc(sql`sum(${books.totalCopies})`)),
    db
      .select({ name: courses.name, issued: sql<number>`count(*)::int` })
      .from(issueRecords)
      .innerJoin(students, eq(issueRecords.studentId, students.id))
      .innerJoin(courses, eq(students.courseId, courses.id))
      .groupBy(courses.name)
      .orderBy(desc(sql`count(*)`)),
    db
      .select({
        issueDate: issueRecords.issueDate,
        returnDate: issueRecords.returnDate,
      })
      .from(issueRecords)
      .where(gte(issueRecords.issueDate, periodStart)),
  ]);

  const monthlyData = months.map((key) => ({
    month: monthLabel(key),
    issued: circulationRows.filter((row) => monthKey(row.issueDate) === key).length,
    returned: circulationRows.filter((row) => row.returnDate && monthKey(row.returnDate) === key)
      .length,
  }));

  const studentsTotal = studentCount[0]?.count ?? 0;
  const totals = bookTotals[0] ?? { titles: 0, totalCopies: 0, availableCopies: 0 };
  const active = activeCount[0]?.count ?? 0;
  const returned = returnedCount[0]?.count ?? 0;
  const overdue = overdueCount[0]?.count ?? 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Library overview"
        description="A live snapshot of circulation, students and the catalogue at IPSA College Library."
        actions={
          <>
            <Button variant="outline" asChild>
              <Link href="/admin/issues/return">
                <Undo2 className="size-4" /> Return book
              </Link>
            </Button>
            <Button asChild>
              <Link href="/admin/issues/new">
                <ArrowLeftRight className="size-4" /> Issue book
              </Link>
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard
          label="Total students"
          value={studentsTotal}
          hint="Active library accounts"
          icon={GraduationCap}
          tone="blue"
        />
        <StatCard
          label="Total books"
          value={totals.totalCopies}
          hint={`${totals.titles} titles`}
          icon={LibraryBig}
          tone="violet"
        />
        <StatCard
          label="Available books"
          value={totals.availableCopies}
          hint="Copies on the shelf"
          icon={BookCopy}
          tone="emerald"
        />
        <StatCard
          label="Currently issued"
          value={active}
          hint="Books with students"
          icon={BookOpenCheck}
          tone="blue"
        />
        <StatCard
          label="Returned books"
          value={returned}
          hint="Completed loans"
          icon={CheckCircle2}
          tone="slate"
        />
        <StatCard
          label="Overdue books"
          value={overdue}
          hint={overdue > 0 ? "Needs follow-up today" : "Nothing overdue"}
          icon={AlertTriangle}
          tone={overdue > 0 ? "red" : "emerald"}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs sm:p-5 xl:col-span-2">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Circulation trend</h2>
              <p className="text-xs text-slate-500">Issued and returned books over the last six months</p>
            </div>
            <span className="hidden rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600 sm:block">
              6 months
            </span>
          </div>
          <MonthlyCirculationChart data={monthlyData} />
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs sm:p-5">
          <div className="mb-4">
            <h2 className="text-sm font-semibold text-slate-900">Catalogue by category</h2>
            <p className="text-xs text-slate-500">Copies held per subject</p>
          </div>
          {categoryRows.length > 0 ? (
            <CategoryPieChart data={categoryRows} />
          ) : (
            <EmptyState
              icon={LibraryBig}
              title="No catalogue data"
              description="Add books to see how the collection is distributed."
            />
          )}
        </section>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs xl:col-span-2">
          <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-4 sm:px-5">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Recent circulation activity</h2>
              <p className="text-xs text-slate-500">Latest issue records across the library</p>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/admin/issues">View all</Link>
            </Button>
          </div>
          {recentRecords.length > 0 ? (
            <div className="divide-y divide-slate-100">
              {recentRecords.map((record) => (
                <div key={record.id} className="flex items-center gap-3 px-4 py-3 sm:px-5">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
                    <BookOpenCheck className="size-4" aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-900">{record.bookTitle}</p>
                    <p className="truncate text-xs text-slate-500">
                      {record.studentName} · <span className="font-mono">{record.collegeCode}</span>
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <IssueStatusBadge status={record.status} dueDate={record.dueDate} />
                    <p className="mt-1 hidden text-[11px] text-slate-500 sm:block">
                      Due {formatDate(record.dueDate)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-5">
              <EmptyState
                icon={ArrowLeftRight}
                title="No issues yet"
                description="Issue the first book from the circulation desk."
                action={
                  <Button size="sm" asChild>
                    <Link href="/admin/issues/new">Issue a book</Link>
                  </Button>
                }
              />
            </div>
          )}
        </section>

        <section className="rounded-xl border border-slate-200 bg-white shadow-xs">
          <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-4 sm:px-5">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Overdue follow-up</h2>
              <p className="text-xs text-slate-500">Oldest outstanding loans</p>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/admin/issues?status=overdue">View all</Link>
            </Button>
          </div>
          {overdueBooks.length > 0 ? (
            <div className="divide-y divide-slate-100">
              {overdueBooks.map((record) => (
                <div key={record.id} className="px-4 py-3 sm:px-5">
                  <p className="truncate text-sm font-medium text-slate-900">{record.bookTitle}</p>
                  <p className="truncate text-xs text-slate-500">
                    {record.studentName} · <span className="font-mono">{record.collegeCode}</span>
                  </p>
                  <p className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-red-700">
                    <CalendarClock className="size-3.5" aria-hidden="true" />
                    {overdueDays(record.dueDate)} days overdue
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex h-56 flex-col items-center justify-center px-5 text-center">
              <span className="flex size-10 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                <CheckCircle2 className="size-5" aria-hidden="true" />
              </span>
              <p className="mt-3 text-sm font-medium text-slate-900">No overdue books</p>
              <p className="mt-1 text-xs text-slate-500">Every active loan is within its due date.</p>
            </div>
          )}
        </section>
      </div>

      {courseRows.length > 0 ? (
        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs sm:p-5">
          <div className="mb-4">
            <h2 className="text-sm font-semibold text-slate-900">Loans by course</h2>
            <p className="text-xs text-slate-500">All-time issue records grouped by course</p>
          </div>
          <CourseIssueChart data={courseRows} />
        </section>
      ) : null}
    </div>
  );
}
