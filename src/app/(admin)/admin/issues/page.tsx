import Link from "next/link";
import {
  ArrowLeftRight,
  ClipboardList,
  Search,
  Undo2,
  X,
} from "lucide-react";
import {
  and,
  asc,
  desc,
  eq,
  gte,
  ilike,
  lte,
  lt,
  or,
  sql,
  type SQL,
} from "drizzle-orm";

import { IssueRecordActions } from "@/components/admin/issue-record-actions";
import { EmptyState } from "@/components/library/empty-state";
import { PageHeader } from "@/components/library/page-header";
import { PaginationBar } from "@/components/library/pagination-bar";
import { IssueStatusBadge } from "@/components/library/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { db } from "@/lib/db";
import { books, courses, issueRecords, students } from "@/lib/db/schema";
import { formatDate, overdueDays, todayISO } from "@/lib/dates";

export const metadata = { title: "Issue Records" };

const PAGE_SIZE = 15;
const statuses = ["issued", "returned", "overdue", "removed"] as const;

export default async function IssueRecordsPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    status?: string;
    course?: string;
    from?: string;
    to?: string;
    page?: string;
  }>;
}) {
  const params = await searchParams;
  const q = params.q?.trim() ?? "";
  const status = statuses.includes(params.status as (typeof statuses)[number])
    ? (params.status as (typeof statuses)[number])
    : "";
  const courseFilter = params.course ?? "";
  const from = params.from ?? "";
  const to = params.to ?? "";
  const page = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1);
  const today = todayISO();

  const filters: SQL[] = [];
  if (status === "issued") filters.push(eq(issueRecords.status, "issued"));
  if (status === "returned") filters.push(eq(issueRecords.status, "returned"));
  if (status === "removed") filters.push(eq(issueRecords.status, "removed"));
  if (status === "overdue") {
    const overdue = and(eq(issueRecords.status, "issued"), lt(issueRecords.dueDate, today));
    if (overdue) filters.push(overdue);
  }
  if (q) {
    const term = `%${q}%`;
    const search = or(
      ilike(students.fullName, term),
      ilike(students.collegeCode, term),
      ilike(books.title, term),
      ilike(books.bookCode, term),
      ilike(issueRecords.recordCode, term),
    );
    if (search) filters.push(search);
  }
  if (courseFilter) filters.push(eq(students.courseId, courseFilter));
  if (from) filters.push(gte(issueRecords.issueDate, from));
  if (to) filters.push(lte(issueRecords.issueDate, to));
  const where = filters.length > 0 ? and(...filters) : undefined;

  const [courseList, countRows, rows] = await Promise.all([
    db.select().from(courses).orderBy(asc(courses.name)),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(issueRecords)
      .innerJoin(students, eq(issueRecords.studentId, students.id))
      .innerJoin(books, eq(issueRecords.bookId, books.id))
      .where(where),
    db
      .select({
        id: issueRecords.id,
        recordCode: issueRecords.recordCode,
        issueDate: issueRecords.issueDate,
        dueDate: issueRecords.dueDate,
        returnDate: issueRecords.returnDate,
        status: issueRecords.status,
        studentId: students.id,
        studentName: students.fullName,
        collegeCode: students.collegeCode,
        courseName: courses.name,
        bookTitle: books.title,
        bookCode: books.bookCode,
        author: books.author,
      })
      .from(issueRecords)
      .innerJoin(students, eq(issueRecords.studentId, students.id))
      .innerJoin(books, eq(issueRecords.bookId, books.id))
      .innerJoin(courses, eq(students.courseId, courses.id))
      .where(where)
      .orderBy(desc(issueRecords.createdAt))
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE),
  ]);

  const total = countRows[0]?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const start = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const end = Math.min(page * PAGE_SIZE, total);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Issue records"
        description="The complete circulation ledger. Return, amend or remove records without erasing history."
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

      <form
        method="get"
        className="grid gap-3 rounded-xl border border-slate-200 bg-white p-3 sm:p-4 lg:grid-cols-[1.5fr_auto_auto_auto_auto_auto] lg:items-end"
      >
        <div className="space-y-1.5">
          <label htmlFor="record-search" className="text-xs font-medium text-slate-600">
            Search
          </label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <Input
              id="record-search"
              name="q"
              defaultValue={q}
              placeholder="Student, college code, book or record"
              className="h-10 pl-9"
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <label htmlFor="record-status" className="text-xs font-medium text-slate-600">
            Status
          </label>
          <select
            id="record-status"
            name="status"
            defaultValue={status}
            className="h-10 w-full rounded-md border border-input bg-white px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 lg:w-36"
          >
            <option value="">All</option>
            <option value="issued">Issued</option>
            <option value="returned">Returned</option>
            <option value="overdue">Overdue</option>
            <option value="removed">Removed</option>
          </select>
        </div>
        <div className="space-y-1.5">
          <label htmlFor="record-course" className="text-xs font-medium text-slate-600">
            Course
          </label>
          <select
            id="record-course"
            name="course"
            defaultValue={courseFilter}
            className="h-10 w-full rounded-md border border-input bg-white px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 lg:w-40"
          >
            <option value="">All courses</option>
            {courseList.map((course) => (
              <option key={course.id} value={course.id}>
                {course.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <label htmlFor="record-from" className="text-xs font-medium text-slate-600">
            Issue from
          </label>
          <Input id="record-from" name="from" type="date" defaultValue={from} className="h-10 lg:w-40" />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="record-to" className="text-xs font-medium text-slate-600">
            Issue to
          </label>
          <Input id="record-to" name="to" type="date" defaultValue={to} className="h-10 lg:w-40" />
        </div>
        <div className="flex gap-2">
          <Button type="submit" className="h-10 flex-1 lg:flex-none">
            Apply
          </Button>
          {q || status || courseFilter || from || to ? (
            <Button variant="outline" size="icon" asChild className="h-10 w-10">
              <Link href="/admin/issues" aria-label="Clear filters">
                <X className="size-4" />
              </Link>
            </Button>
          ) : null}
        </div>
      </form>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-4 py-3 sm:px-5">
          <p className="text-sm font-medium text-slate-900">
            {total} {total === 1 ? "record" : "records"}
          </p>
          <p className="text-xs text-slate-500">
            {total > 0 ? `Showing ${start}–${end}` : "No matching transactions"}
          </p>
        </div>

        {rows.length === 0 ? (
          <div className="p-4 sm:p-5">
            <EmptyState
              icon={ClipboardList}
              title="No issue records found"
              description={
                q || status || courseFilter || from || to
                  ? "Try a different search or clear the filters."
                  : "Records appear here as soon as a book is issued."
              }
              action={
                q || status || courseFilter || from || to ? (
                  <Button variant="outline" asChild>
                    <Link href="/admin/issues">Clear filters</Link>
                  </Button>
                ) : (
                  <Button asChild>
                    <Link href="/admin/issues/new">Issue the first book</Link>
                  </Button>
                )
              }
            />
          </div>
        ) : (
          <>
            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                    <th className="px-5 py-3 font-medium">Student</th>
                    <th className="px-3 py-3 font-medium">Book</th>
                    <th className="px-3 py-3 font-medium">Issued</th>
                    <th className="px-3 py-3 font-medium">Due</th>
                    <th className="px-3 py-3 font-medium">Returned</th>
                    <th className="px-3 py-3 font-medium">Status</th>
                    <th className="px-5 py-3 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((record) => (
                    <tr key={record.id} className="hover:bg-slate-50/70">
                      <td className="px-5 py-3">
                        <Link
                          href={`/admin/students/${record.studentId}`}
                          className="font-medium text-slate-900 hover:text-blue-700 hover:underline"
                        >
                          {record.studentName}
                        </Link>
                        <p className="text-xs text-slate-500">
                          <span className="font-mono">{record.collegeCode}</span> · {record.courseName}
                        </p>
                      </td>
                      <td className="px-3 py-3">
                        <p className="max-w-56 truncate font-medium text-slate-800">{record.bookTitle}</p>
                        <p className="text-xs text-slate-500">
                          <span className="font-mono">{record.bookCode}</span> ·{" "}
                          <span className="font-mono">{record.recordCode}</span>
                        </p>
                      </td>
                      <td className="px-3 py-3 text-slate-700">{formatDate(record.issueDate)}</td>
                      <td className="px-3 py-3">
                        <p className="text-slate-700">{formatDate(record.dueDate)}</p>
                        {record.status === "issued" && record.dueDate < today ? (
                          <p className="text-xs font-medium text-red-700">
                            {overdueDays(record.dueDate)} days overdue
                          </p>
                        ) : null}
                      </td>
                      <td className="px-3 py-3 text-slate-700">{formatDate(record.returnDate)}</td>
                      <td className="px-3 py-3">
                        <IssueStatusBadge status={record.status} dueDate={record.dueDate} />
                      </td>
                      <td className="px-5 py-3">
                        <IssueRecordActions
                          record={{
                            id: record.id,
                            recordCode: record.recordCode,
                            studentId: record.studentId,
                            studentName: record.studentName,
                            bookTitle: record.bookTitle,
                            bookCode: record.bookCode,
                            issueDate: record.issueDate,
                            dueDate: record.dueDate,
                            status: record.status,
                          }}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="divide-y divide-slate-100 lg:hidden">
              {rows.map((record) => (
                <div key={record.id} className="space-y-3 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <Link
                        href={`/admin/students/${record.studentId}`}
                        className="block truncate font-medium text-slate-900"
                      >
                        {record.studentName}
                      </Link>
                      <p className="font-mono text-xs text-slate-500">{record.collegeCode}</p>
                    </div>
                    <IssueStatusBadge status={record.status} dueDate={record.dueDate} />
                  </div>
                  <div className="rounded-lg bg-slate-50 p-2.5">
                    <p className="text-sm font-medium text-slate-900">{record.bookTitle}</p>
                    <p className="text-xs text-slate-500">
                      {record.bookCode} · {record.recordCode}
                    </p>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <p className="text-slate-500">Issued</p>
                      <p className="text-slate-800">{formatDate(record.issueDate)}</p>
                    </div>
                    <div>
                      <p className="text-slate-500">Due</p>
                      <p className="text-slate-800">{formatDate(record.dueDate)}</p>
                      {record.status === "issued" && record.dueDate < today ? (
                        <p className="font-medium text-red-700">{overdueDays(record.dueDate)}d late</p>
                      ) : null}
                    </div>
                    <div>
                      <p className="text-slate-500">Returned</p>
                      <p className="text-slate-800">{formatDate(record.returnDate)}</p>
                    </div>
                  </div>
                  <div className="flex justify-end border-t border-slate-100 pt-2">
                    <IssueRecordActions
                      record={{
                        id: record.id,
                        recordCode: record.recordCode,
                        studentId: record.studentId,
                        studentName: record.studentName,
                        bookTitle: record.bookTitle,
                        bookCode: record.bookCode,
                        issueDate: record.issueDate,
                        dueDate: record.dueDate,
                        status: record.status,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        <PaginationBar
          basePath="/admin/issues"
          page={page}
          totalPages={totalPages}
          params={{ q, status, course: courseFilter, from, to }}
        />
      </section>
    </div>
  );
}
