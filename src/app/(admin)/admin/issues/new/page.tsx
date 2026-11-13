import Link from "next/link";
import {
  AlertCircle,
  ArrowLeftRight,
  BookOpenCheck,
  ClipboardList,
  Search,
  Undo2,
  UserRound,
} from "lucide-react";
import { and, asc, eq, isNull, sql } from "drizzle-orm";

import { IssueBookForm } from "@/components/admin/issue-book-form";
import { PageHeader } from "@/components/library/page-header";
import { IssueStatusBadge } from "@/components/library/status-badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { db } from "@/lib/db";
import { bookCopies, books, courses, issueRecords, students } from "@/lib/db/schema";
import { formatDate } from "@/lib/dates";

export const metadata = { title: "Issue Book" };

export default async function IssueBookPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>;
}) {
  const params = await searchParams;
  const code = params.code?.trim().toUpperCase() ?? "";

  const [availableCopies, categories, studentRows] = await Promise.all([
    db
      .select({
        copyId: bookCopies.id,
        copyCode: bookCopies.copyCode,
        shelfNumber: bookCopies.shelfNumber,
        bookId: books.id,
        title: books.title,
        author: books.author,
        category: books.category,
      })
      .from(bookCopies)
      .innerJoin(books, eq(bookCopies.bookId, books.id))
      .where(
        and(
          eq(bookCopies.status, "available"),
          isNull(bookCopies.archivedAt),
          isNull(books.archivedAt),
        ),
      )
      .orderBy(asc(books.title), asc(bookCopies.copyCode)),
    db
      .selectDistinct({ category: books.category })
      .from(books)
      .where(isNull(books.archivedAt))
      .orderBy(asc(books.category)),
    code
      ? db
          .select({ student: students, course: courses })
          .from(students)
          .innerJoin(courses, eq(students.courseId, courses.id))
          .where(and(eq(students.collegeCode, code), isNull(students.archivedAt)))
          .limit(1)
      : Promise.resolve([]),
  ]);

  const record = studentRows[0];
  const activeRows = record
    ? await db
        .select({
          id: issueRecords.id,
          dueDate: issueRecords.dueDate,
          status: issueRecords.status,
          bookId: issueRecords.bookId,
          bookTitle: books.title,
          bookCode: sql<string>`coalesce(${bookCopies.copyCode}, ${books.bookCode})`,
        })
        .from(issueRecords)
        .innerJoin(books, eq(issueRecords.bookId, books.id))
        .leftJoin(bookCopies, eq(issueRecords.copyId, bookCopies.id))
        .where(
          and(eq(issueRecords.studentId, record.student.id), eq(issueRecords.status, "issued")),
        )
        .orderBy(asc(issueRecords.dueDate))
    : [];

  const activeBookIds = activeRows.map((item) => item.bookId);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Issue a book"
        description="Find the student by college code, then choose an available copy and set the loan dates."
        actions={
          <>
            <Button variant="outline" asChild>
              <Link href="/admin/issues/return">
                <Undo2 className="size-4" /> Return book
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
            <label htmlFor="student-code-search" className="text-sm font-medium text-slate-900">
              Student college code
            </label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
              <Input
                id="student-code-search"
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
            No active student matches <span className="font-mono">{code}</span>. Check the code or{" "}
            <Link href="/admin/students" className="font-medium underline">
              add the student
            </Link>
            .
          </AlertDescription>
        </Alert>
      ) : null}

      {record ? (
        <>
          {record.student.status !== "active" ? (
            <Alert variant="destructive">
              <AlertCircle className="size-4" />
              <AlertTitle>Account is inactive</AlertTitle>
              <AlertDescription>
                Reactivate this account in Student Management before issuing a book.
              </AlertDescription>
            </Alert>
          ) : null}

          <div className="grid gap-4 lg:grid-cols-[1fr_1.15fr]">
            <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs sm:p-5">
              <div className="flex items-start gap-3">
                <span className="flex size-11 items-center justify-center rounded-full bg-blue-100 text-blue-700">
                  <UserRound className="size-5" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-base font-semibold text-slate-900">
                    {record.student.fullName}
                  </p>
                  <p className="font-mono text-sm text-blue-700">{record.student.collegeCode}</p>
                  <p className="mt-1 text-sm text-slate-600">
                    {record.course.name} · {record.student.semester}
                  </p>
                </div>
              </div>

              <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-slate-100 pt-4 text-sm">
                <div>
                  <dt className="text-xs text-slate-500">Department</dt>
                  <dd className="mt-0.5 text-slate-800">{record.course.department}</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">Mobile</dt>
                  <dd className="mt-0.5 text-slate-800">{record.student.mobile}</dd>
                </div>
                <div className="col-span-2">
                  <dt className="text-xs text-slate-500">Email</dt>
                  <dd className="mt-0.5 break-all text-slate-800">{record.student.email}</dd>
                </div>
              </dl>

              <div className="mt-4 flex flex-wrap gap-2">
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/admin/students/${record.student.id}`}>
                    View full profile
                  </Link>
                </Button>
                <Button variant="ghost" size="sm" asChild>
                  <Link href={`/admin/issues/return?code=${record.student.collegeCode}`}>
                    Return a book
                  </Link>
                </Button>
              </div>
            </section>

            <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs sm:p-5">
              <div className="mb-4 flex items-center justify-between gap-2">
                <div>
                  <h2 className="text-sm font-semibold text-slate-900">New issue</h2>
                  <p className="text-xs text-slate-500">Select one available copy</p>
                </div>
                <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700">
                  <BookOpenCheck className="size-3.5" /> {record.student.fullName.split(" ")[0]}
                </span>
              </div>

              {record.student.status !== "active" ? (
                <p className="text-sm text-slate-600">
                  This account must be active before a book can be issued.
                </p>
              ) : (
                <IssueBookForm
                  student={{
                    fullName: record.student.fullName,
                    collegeCode: record.student.collegeCode,
                    courseName: record.course.name,
                    semester: record.student.semester,
                  }}
                  copies={availableCopies}
                  categories={categories.map((item) => item.category)}
                  activeBookIds={activeBookIds}
                />
              )}
            </section>
          </div>

          {activeRows.length > 0 ? (
            <section className="rounded-xl border border-slate-200 bg-white shadow-xs">
              <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-4 sm:px-5">
                <div>
                  <h2 className="text-sm font-semibold text-slate-900">Currently issued to this student</h2>
                  <p className="text-xs text-slate-500">
                    Duplicate active issues for the same book are blocked.
                  </p>
                </div>
                <Button variant="ghost" size="sm" asChild>
                  <Link href={`/admin/students/${record.student.id}`}>Full history</Link>
                </Button>
              </div>
              <div className="divide-y divide-slate-100">
                {activeRows.map((item) => (
                  <div key={item.id} className="flex items-center gap-3 px-4 py-3 sm:px-5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-900">{item.bookTitle}</p>
                      <p className="font-mono text-xs text-slate-500">{item.bookCode}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <IssueStatusBadge status={item.status} dueDate={item.dueDate} />
                      <p className="mt-1 text-[11px] text-slate-500">Due {formatDate(item.dueDate)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ) : null}
        </>
      ) : code ? null : (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center">
          <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-blue-50 text-blue-700">
            <ArrowLeftRight className="size-6" aria-hidden="true" />
          </span>
          <h2 className="mt-4 text-sm font-semibold text-slate-900">Start with a college code</h2>
          <p className="mx-auto mt-1 max-w-sm text-sm leading-relaxed text-slate-600">
            The student&apos;s profile and active loans will appear here before you choose a book.
          </p>
        </div>
      )}
    </div>
  );
}
