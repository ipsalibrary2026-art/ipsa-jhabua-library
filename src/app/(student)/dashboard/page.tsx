import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  BookOpenCheck,
  CalendarClock,
  CheckCircle2,
  Clock3,
  GraduationCap,
  LibraryBig,
  UserRound,
} from "lucide-react";
import { and, asc, desc, eq, lt, sql } from "drizzle-orm";

import { EmptyState } from "@/components/library/empty-state";
import { IssueStatusBadge } from "@/components/library/status-badge";
import { StatCard } from "@/components/library/stat-card";
import { Button } from "@/components/ui/button";
import { db } from "@/lib/db";
import { books, issueRecords } from "@/lib/db/schema";
import { formatDate, isOverdue, overdueDays, todayISO } from "@/lib/dates";
import { requireStudent } from "@/lib/session";

export const metadata = { title: "My Library" };

export default async function StudentDashboardPage() {
  const { student, course } = await requireStudent();
  const today = todayISO();

  const [activeRows, historyRows, statRows, overdueRows] = await Promise.all([
    db
      .select({
        id: issueRecords.id,
        recordCode: issueRecords.recordCode,
        issueDate: issueRecords.issueDate,
        dueDate: issueRecords.dueDate,
        status: issueRecords.status,
        bookTitle: books.title,
        bookCode: books.bookCode,
        author: books.author,
        shelfNumber: books.shelfNumber,
      })
      .from(issueRecords)
      .innerJoin(books, eq(issueRecords.bookId, books.id))
      .where(and(eq(issueRecords.studentId, student.id), eq(issueRecords.status, "issued")))
      .orderBy(asc(issueRecords.dueDate)),
    db
      .select({
        id: issueRecords.id,
        issueDate: issueRecords.issueDate,
        dueDate: issueRecords.dueDate,
        returnDate: issueRecords.returnDate,
        status: issueRecords.status,
        bookTitle: books.title,
        bookCode: books.bookCode,
      })
      .from(issueRecords)
      .innerJoin(books, eq(issueRecords.bookId, books.id))
      .where(and(eq(issueRecords.studentId, student.id), eq(issueRecords.status, "returned")))
      .orderBy(desc(issueRecords.returnDate))
      .limit(5),
    db
      .select({
        active: sql<number>`count(*) filter (where ${issueRecords.status} = 'issued')::int`,
        returned: sql<number>`count(*) filter (where ${issueRecords.status} = 'returned')::int`,
        total: sql<number>`count(*)::int`,
      })
      .from(issueRecords)
      .where(eq(issueRecords.studentId, student.id)),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(issueRecords)
      .where(
        and(
          eq(issueRecords.studentId, student.id),
          eq(issueRecords.status, "issued"),
          lt(issueRecords.dueDate, today),
        ),
      ),
  ]);

  const stats = statRows[0] ?? { active: 0, returned: 0, total: 0 };
  const overdue = overdueRows[0]?.count ?? 0;
  const firstName = student.fullName.split(" ")[0];

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-950 via-blue-800 to-blue-600 p-5 text-white shadow-sm sm:p-7">
        <div className="absolute -right-12 -top-16 size-56 rounded-full bg-white/10 blur-2xl" />
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-blue-200">
              Student library account
            </p>
            <h1 className="mt-1.5 text-2xl font-semibold tracking-tight sm:text-3xl">
              Welcome back, {firstName}
            </h1>
            <p className="mt-2 text-sm text-blue-100">
              <span className="font-mono">{student.collegeCode}</span> · {course.name} ·{" "}
              {student.semester}
            </p>
          </div>
          <div className="flex gap-2">
            <div className="rounded-xl bg-white/10 px-3.5 py-2.5 ring-1 ring-white/15">
              <p className="text-[11px] uppercase tracking-wide text-blue-200">Issued now</p>
              <p className="text-xl font-semibold tabular-nums">{stats.active}</p>
            </div>
            <div
              className={
                overdue > 0
                  ? "rounded-xl bg-red-500/25 px-3.5 py-2.5 ring-1 ring-red-200/40"
                  : "rounded-xl bg-white/10 px-3.5 py-2.5 ring-1 ring-white/15"
              }
            >
              <p className="text-[11px] uppercase tracking-wide text-blue-100">Overdue</p>
              <p className="text-xl font-semibold tabular-nums text-white">{overdue}</p>
            </div>
          </div>
        </div>
      </section>

      {overdue > 0 ? (
        <div className="flex flex-col gap-3 rounded-xl border border-red-200 bg-red-50 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="mt-0.5 size-5 shrink-0 text-red-600" aria-hidden="true" />
            <div>
              <p className="text-sm font-semibold text-red-900">
                {overdue} {overdue === 1 ? "book is" : "books are"} overdue
              </p>
              <p className="text-sm text-red-800">
                Please return {overdue === 1 ? "it" : "them"} to the library desk as soon as
                possible.
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" asChild className="border-red-200 text-red-800">
            <Link href="/dashboard/books">View my books</Link>
          </Button>
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard label="Books issued now" value={stats.active} icon={BookOpenCheck} tone="blue" />
        <StatCard label="Books returned" value={stats.returned} icon={CheckCircle2} tone="emerald" />
        <StatCard
          label="Overdue"
          value={overdue}
          hint={overdue > 0 ? "Action needed" : "All on time"}
          icon={AlertTriangle}
          tone={overdue > 0 ? "red" : "slate"}
        />
        <StatCard label="Lifetime records" value={stats.total} icon={LibraryBig} tone="violet" />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        <section className="rounded-xl border border-slate-200 bg-white shadow-xs">
          <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-4 sm:px-5">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Currently issued</h2>
              <p className="text-xs text-slate-500">Books in your possession right now</p>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/dashboard/books">
                All books <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>

          {activeRows.length === 0 ? (
            <div className="p-4 sm:p-5">
              <EmptyState
                icon={BookOpen}
                title="No books issued"
                description="When the librarian issues a book to your college code, it will appear here."
                action={
                  <Button variant="outline" size="sm" asChild>
                    <Link href="/dashboard/profile">View my profile</Link>
                  </Button>
                }
              />
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {activeRows.slice(0, 4).map((record) => (
                <div key={record.id} className="flex items-start gap-3 px-4 py-3.5 sm:px-5">
                  <span className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
                    <BookOpenCheck className="size-5" aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-900">{record.bookTitle}</p>
                    <p className="truncate text-xs text-slate-500">
                      {record.author} · <span className="font-mono">{record.bookCode}</span>
                    </p>
                    <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                      <span className="inline-flex items-center gap-1">
                        <CalendarClock className="size-3.5" /> Due {formatDate(record.dueDate)}
                      </span>
                      {isOverdue(record) ? (
                        <span className="font-medium text-red-700">
                          {overdueDays(record.dueDate)} days overdue
                        </span>
                      ) : null}
                    </p>
                  </div>
                  <IssueStatusBadge status={record.status} dueDate={record.dueDate} />
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-xl border border-slate-200 bg-white shadow-xs">
          <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-4 sm:px-5">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Recent returns</h2>
              <p className="text-xs text-slate-500">Your latest completed loans</p>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/dashboard/books?tab=history">History</Link>
            </Button>
          </div>

          {historyRows.length === 0 ? (
            <div className="flex h-52 flex-col items-center justify-center px-5 text-center">
              <span className="flex size-10 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                <Clock3 className="size-5" aria-hidden="true" />
              </span>
              <p className="mt-3 text-sm font-medium text-slate-900">No returns yet</p>
              <p className="mt-1 text-xs text-slate-500">Returned books will be shown here.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {historyRows.map((record) => (
                <div key={record.id} className="px-4 py-3 sm:px-5">
                  <p className="truncate text-sm font-medium text-slate-900">{record.bookTitle}</p>
                  <p className="text-xs text-slate-500">
                    <span className="font-mono">{record.bookCode}</span> · returned{" "}
                    {formatDate(record.returnDate)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <section className="grid gap-4 sm:grid-cols-3">
        <Link
          href="/dashboard/books"
          className="group flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-xs transition-colors hover:border-blue-200 hover:bg-blue-50/40"
        >
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
            <BookOpen className="size-5" aria-hidden="true" />
          </span>
          <span>
            <span className="block text-sm font-medium text-slate-900">My issued books</span>
            <span className="block text-xs leading-relaxed text-slate-500">
              Active loans and the complete return history.
            </span>
          </span>
        </Link>
        <Link
          href="/dashboard/profile"
          className="group flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-xs transition-colors hover:border-blue-200 hover:bg-blue-50/40"
        >
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
            <UserRound className="size-5" aria-hidden="true" />
          </span>
          <span>
            <span className="block text-sm font-medium text-slate-900">My profile</span>
            <span className="block text-xs leading-relaxed text-slate-500">
              {course.name} · {student.semester}
            </span>
          </span>
        </Link>
        <Link
          href="/dashboard/settings"
          className="group flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-xs transition-colors hover:border-blue-200 hover:bg-blue-50/40"
        >
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
            <GraduationCap className="size-5" aria-hidden="true" />
          </span>
          <span>
            <span className="block text-sm font-medium text-slate-900">Account settings</span>
            <span className="block text-xs leading-relaxed text-slate-500">
              Change your password and install the app.
            </span>
          </span>
        </Link>
      </section>
    </div>
  );
}
