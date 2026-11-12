import Link from "next/link";
import {
  AlertCircle,
  ArrowLeftRight,
  BookCheck,
  ClipboardList,
  Search,
  Undo2,
  UserRound,
} from "lucide-react";
import { and, asc, eq, isNull } from "drizzle-orm";

import { ReturnBookButton } from "@/components/admin/return-book-button";
import { EmptyState } from "@/components/library/empty-state";
import { PageHeader } from "@/components/library/page-header";
import { IssueStatusBadge } from "@/components/library/status-badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { db } from "@/lib/db";
import { books, courses, issueRecords, students } from "@/lib/db/schema";
import { formatDate, isOverdue, overdueDays } from "@/lib/dates";

export const metadata = { title: "Return Book" };

export default async function ReturnBookPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>;
}) {
  const params = await searchParams;
  const code = params.code?.trim().toUpperCase() ?? "";

  const studentRows = code
    ? await db
        .select({ student: students, course: courses })
        .from(students)
        .innerJoin(courses, eq(students.courseId, courses.id))
        .where(and(eq(students.collegeCode, code), isNull(students.archivedAt)))
        .limit(1)
    : [];

  const record = studentRows[0];

  const activeRows = record
    ? await db
        .select({
          id: issueRecords.id,
          recordCode: issueRecords.recordCode,
          issueDate: issueRecords.issueDate,
          dueDate: issueRecords.dueDate,
          status: issueRecords.status,
          bookTitle: books.title,
          bookCode: books.bookCode,
          author: books.author,
        })
        .from(issueRecords)
        .innerJoin(books, eq(issueRecords.bookId, books.id))
        .where(and(eq(issueRecords.studentId, record.student.id), eq(issueRecords.status, "issued")))
        .orderBy(asc(issueRecords.dueDate))
    : [];

  const overdueCount = activeRows.filter((item) => isOverdue(item)).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Return a book"
        description="Search the student, confirm the issued copy and mark it returned. Stock updates instantly."
        actions={
          <>
            <Button variant="outline" asChild>
              <Link href="/admin/issues/new">
                <ArrowLeftRight className="size-4" /> Issue book
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/admin/issues">
                <ClipboardList className="size-4" /> Issue records
              </Link>
            </Button>
          </>
        }
      />

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs sm:p-5">
        <form method="get" className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1 space-y-2">
            <label htmlFor="return-code-search" className="text-sm font-medium text-slate-900">
              Student college code
            </label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
              <Input
                id="return-code-search"
                name="code"
                defaultValue={code}
                placeholder="Enter college code, e.g. IPSA2024001"
                autoCapitalize="characters"
                spellCheck={false}
                required
                className="h-10 pl-9 uppercase placeholder:normal-case"
              />
            </div>
          </div>
          <Button type="submit" className="h-10 sm:w-auto">
            Find student
          </Button>
        </form>
      </section>

      {code && !record ? (
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertTitle>Student not found</AlertTitle>
          <AlertDescription>
            No active student matches <span className="font-mono">{code}</span>. Check the code or
            search in{" "}
            <Link href="/admin/students" className="font-medium underline">
              Student Management
            </Link>
            .
          </AlertDescription>
        </Alert>
      ) : null}

      {record ? (
        <>
          <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs sm:p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <span className="flex size-11 items-center justify-center rounded-full bg-blue-100 text-blue-700">
                  <UserRound className="size-5" aria-hidden="true" />
                </span>
                <div>
                  <p className="text-base font-semibold text-slate-900">{record.student.fullName}</p>
                  <p className="font-mono text-sm text-blue-700">{record.student.collegeCode}</p>
                  <p className="mt-1 text-sm text-slate-600">
                    {record.course.name} · {record.student.semester}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <div className="rounded-lg bg-slate-50 px-3 py-2 text-sm">
                  <p className="text-xs text-slate-500">Active loans</p>
                  <p className="font-semibold tabular-nums text-slate-900">{activeRows.length}</p>
                </div>
                <div className="rounded-lg bg-red-50 px-3 py-2 text-sm">
                  <p className="text-xs text-red-600">Overdue</p>
                  <p className="font-semibold tabular-nums text-red-800">{overdueCount}</p>
                </div>
                <Button variant="outline" size="sm" asChild className="self-center">
                  <Link href={`/admin/students/${record.student.id}`}>View profile</Link>
                </Button>
              </div>
            </div>
          </section>

          <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
            <div className="border-b border-slate-200 px-4 py-4 sm:px-5">
              <h2 className="text-sm font-semibold text-slate-900">Books currently issued</h2>
              <p className="text-xs text-slate-500">
                Choose the copy being returned at the desk.
              </p>
            </div>

            {activeRows.length === 0 ? (
              <div className="p-4 sm:p-5">
                <EmptyState
                  icon={BookCheck}
                  title="Nothing to return"
                  description={`${record.student.fullName} has no active loans right now.`}
                  action={
                    <Button size="sm" asChild>
                      <Link href={`/admin/issues/new?code=${record.student.collegeCode}`}>
                        Issue a book
                      </Link>
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
                        <th className="px-5 py-3 font-medium">Book</th>
                        <th className="px-3 py-3 font-medium">Record</th>
                        <th className="px-3 py-3 font-medium">Issued</th>
                        <th className="px-3 py-3 font-medium">Due</th>
                        <th className="px-3 py-3 font-medium">Status</th>
                        <th className="px-5 py-3 text-right font-medium">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {activeRows.map((item) => (
                        <tr key={item.id} className="hover:bg-slate-50/70">
                          <td className="px-5 py-3">
                            <p className="font-medium text-slate-900">{item.bookTitle}</p>
                            <p className="text-xs text-slate-500">
                              {item.author} · <span className="font-mono">{item.bookCode}</span>
                            </p>
                          </td>
                          <td className="px-3 py-3 font-mono text-xs text-slate-600">
                            {item.recordCode}
                          </td>
                          <td className="px-3 py-3 text-slate-700">{formatDate(item.issueDate)}</td>
                          <td className="px-3 py-3">
                            <p className="text-slate-700">{formatDate(item.dueDate)}</p>
                            {isOverdue(item) ? (
                              <p className="text-xs font-medium text-red-700">
                                {overdueDays(item.dueDate)} days overdue
                              </p>
                            ) : null}
                          </td>
                          <td className="px-3 py-3">
                            <IssueStatusBadge status={item.status} dueDate={item.dueDate} />
                          </td>
                          <td className="px-5 py-3 text-right">
                            <ReturnBookButton
                              recordId={item.id}
                              bookTitle={item.bookTitle}
                              bookCode={item.bookCode}
                              studentName={record.student.fullName}
                              dueDate={item.dueDate}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="divide-y divide-slate-100 md:hidden">
                  {activeRows.map((item) => (
                    <div key={item.id} className="space-y-3 p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-medium text-slate-900">{item.bookTitle}</p>
                          <p className="text-xs text-slate-500">
                            {item.author} · <span className="font-mono">{item.bookCode}</span>
                          </p>
                        </div>
                        <IssueStatusBadge status={item.status} dueDate={item.dueDate} />
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <p className="text-slate-500">Issued</p>
                          <p className="text-slate-800">{formatDate(item.issueDate)}</p>
                        </div>
                        <div>
                          <p className="text-slate-500">Due</p>
                          <p className="text-slate-800">{formatDate(item.dueDate)}</p>
                          {isOverdue(item) ? (
                            <p className="font-medium text-red-700">
                              {overdueDays(item.dueDate)} days overdue
                            </p>
                          ) : null}
                        </div>
                      </div>
                      <div className="flex justify-end border-t border-slate-100 pt-2">
                        <ReturnBookButton
                          recordId={item.id}
                          bookTitle={item.bookTitle}
                          bookCode={item.bookCode}
                          studentName={record.student.fullName}
                          dueDate={item.dueDate}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </section>
        </>
      ) : code ? null : (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center">
          <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-blue-50 text-blue-700">
            <Undo2 className="size-6" aria-hidden="true" />
          </span>
          <h2 className="mt-4 text-sm font-semibold text-slate-900">Find the student first</h2>
          <p className="mx-auto mt-1 max-w-sm text-sm leading-relaxed text-slate-600">
            Search with a college code to see all the books currently issued to that student.
          </p>
        </div>
      )}
    </div>
  );
}
