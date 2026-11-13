import Link from "next/link";
import { AlertTriangle, BookOpen, Clock3, History, Search, X } from "lucide-react";
import { and, asc, desc, eq, ilike, inArray, lt, or, sql, type SQL } from "drizzle-orm";

import { EmptyState } from "@/components/library/empty-state";
import { PageHeader } from "@/components/library/page-header";
import { PaginationBar } from "@/components/library/pagination-bar";
import { IssueStatusBadge } from "@/components/library/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { db } from "@/lib/db";
import { bookCopies, books, issueRecords } from "@/lib/db/schema";
import { formatDate, isOverdue, overdueDays, todayISO } from "@/lib/dates";
import { requireStudent } from "@/lib/session";

export const metadata = { title: "My Books" };

const PAGE_SIZE = 12;

export default async function StudentBooksPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; q?: string; page?: string }>;
}) {
  const { student } = await requireStudent();
  const params = await searchParams;
  const tab = params.tab === "history" ? "history" : "active";
  const q = params.q?.trim() ?? "";
  const page = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1);
  const today = todayISO();

  const filters: SQL[] = [eq(issueRecords.studentId, student.id)];
  if (tab === "active") filters.push(eq(issueRecords.status, "issued"));
  else filters.push(inArray(issueRecords.status, ["returned", "removed"]));
  if (q) {
    const term = `%${q}%`;
    const search = or(
      ilike(books.title, term),
      ilike(books.bookCode, term),
      ilike(bookCopies.copyCode, term),
      ilike(books.author, term),
    );
    if (search) filters.push(search);
  }
  const where = and(...filters);

  const [countRows, statusCounts, rows] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(issueRecords)
      .innerJoin(books, eq(issueRecords.bookId, books.id))
      .leftJoin(bookCopies, eq(issueRecords.copyId, bookCopies.id))
      .where(where),
    db
      .select({
        active: sql<number>`count(*) filter (where ${issueRecords.status} = 'issued')::int`,
        returned: sql<number>`count(*) filter (where ${issueRecords.status} = 'returned')::int`,
        overdue: sql<number>`count(*) filter (where ${issueRecords.status} = 'issued' and ${issueRecords.dueDate} < ${today})::int`,
      })
      .from(issueRecords)
      .where(eq(issueRecords.studentId, student.id)),
    db
      .select({
        id: issueRecords.id,
        recordCode: issueRecords.recordCode,
        issueDate: issueRecords.issueDate,
        dueDate: issueRecords.dueDate,
        returnDate: issueRecords.returnDate,
        status: issueRecords.status,
        bookTitle: books.title,
        bookCode: sql<string>`coalesce(${bookCopies.copyCode}, ${books.bookCode})`,
        author: books.author,
        shelfNumber: books.shelfNumber,
      })
      .from(issueRecords)
      .innerJoin(books, eq(issueRecords.bookId, books.id))
      .leftJoin(bookCopies, eq(issueRecords.copyId, bookCopies.id))
      .where(where)
      .orderBy(
        tab === "active" ? asc(issueRecords.dueDate) : desc(issueRecords.returnDate),
        desc(issueRecords.createdAt),
      )
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE),
  ]);

  const total = countRows[0]?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const counts = statusCounts[0] ?? { active: 0, returned: 0, overdue: 0 };
  const activeCount = counts.active;
  const historyCount = counts.returned;

  return (
    <div className="space-y-6">
      <PageHeader
        title="My books"
        description="Every book issued to your college code, with due dates and the full return history."
      />

      {counts.overdue > 0 ? (
        <div className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 p-4">
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-red-600" aria-hidden="true" />
          <div>
            <p className="text-sm font-semibold text-red-900">
              {counts.overdue} overdue {counts.overdue === 1 ? "book" : "books"}
            </p>
            <p className="text-sm text-red-800">
              Return overdue books at the library desk to keep your account in good standing.
            </p>
          </div>
        </div>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="inline-flex rounded-lg border border-slate-200 bg-white p-1">
          <Link
            href="/dashboard/books?tab=active"
            className={
              tab === "active"
                ? "flex items-center gap-2 rounded-md bg-blue-700 px-3 py-2 text-sm font-medium text-white"
                : "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
            }
          >
            <BookOpen className="size-4" /> Active
            <span
              className={
                tab === "active"
                  ? "rounded-full bg-white/20 px-1.5 text-xs tabular-nums"
                  : "rounded-full bg-slate-100 px-1.5 text-xs tabular-nums text-slate-600"
              }
            >
              {activeCount}
            </span>
          </Link>
          <Link
            href="/dashboard/books?tab=history"
            className={
              tab === "history"
                ? "flex items-center gap-2 rounded-md bg-blue-700 px-3 py-2 text-sm font-medium text-white"
                : "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
            }
          >
            <History className="size-4" /> History
            <span
              className={
                tab === "history"
                  ? "rounded-full bg-white/20 px-1.5 text-xs tabular-nums"
                  : "rounded-full bg-slate-100 px-1.5 text-xs tabular-nums text-slate-600"
              }
            >
              {historyCount}
            </span>
          </Link>
        </div>

        <form method="get" className="flex gap-2 sm:w-80">
          <input type="hidden" name="tab" value={tab} />
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <label htmlFor="my-books-search" className="sr-only">
              Search my books
            </label>
            <Input
              id="my-books-search"
              name="q"
              defaultValue={q}
              placeholder="Search book or author"
              className="h-10 pl-9"
            />
          </div>
          <Button type="submit" variant="outline" className="h-10">
            Search
          </Button>
          {q ? (
            <Button variant="ghost" size="icon" asChild className="h-10 w-10">
              <Link href={`/dashboard/books?tab=${tab}`} aria-label="Clear search">
                <X className="size-4" />
              </Link>
            </Button>
          ) : null}
        </form>
      </div>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
        {rows.length === 0 ? (
          <div className="p-4 sm:p-5">
            <EmptyState
              icon={tab === "active" ? BookOpen : Clock3}
              title={
                q
                  ? "No matching books"
                  : tab === "active"
                    ? "No active loans"
                    : "No previous records"
              }
              description={
                q
                  ? "Try a different title, author or Book ID."
                  : tab === "active"
                    ? "Books issued by the library will appear here with their due dates."
                    : "Returned books will be kept here as your borrowing history."
              }
              action={
                q ? (
                  <Button variant="outline" asChild>
                    <Link href={`/dashboard/books?tab=${tab}`}>Clear search</Link>
                  </Button>
                ) : null
              }
            />
          </div>
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                    <th className="px-5 py-3 font-medium">Book name</th>
                    <th className="px-3 py-3 font-medium">Book ID</th>
                    <th className="px-3 py-3 font-medium">Author</th>
                    <th className="px-3 py-3 font-medium">Issue date</th>
                    <th className="px-3 py-3 font-medium">Due date</th>
                    <th className="px-3 py-3 font-medium">Return date</th>
                    <th className="px-5 py-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((record) => (
                    <tr key={record.id} className="hover:bg-slate-50/70">
                      <td className="px-5 py-3">
                        <p className="font-medium text-slate-900">{record.bookTitle}</p>
                        <p className="text-xs text-slate-500">Shelf {record.shelfNumber}</p>
                      </td>
                      <td className="px-3 py-3 font-mono text-xs text-slate-700">{record.bookCode}</td>
                      <td className="px-3 py-3 text-slate-700">{record.author}</td>
                      <td className="px-3 py-3 text-slate-700">{formatDate(record.issueDate)}</td>
                      <td className="px-3 py-3">
                        <p className="text-slate-700">{formatDate(record.dueDate)}</p>
                        {isOverdue(record) ? (
                          <p className="text-xs font-medium text-red-700">
                            {overdueDays(record.dueDate)} days overdue
                          </p>
                        ) : null}
                      </td>
                      <td className="px-3 py-3 text-slate-700">{formatDate(record.returnDate)}</td>
                      <td className="px-5 py-3">
                        <IssueStatusBadge status={record.status} dueDate={record.dueDate} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="divide-y divide-slate-100 md:hidden">
              {rows.map((record) => (
                <div key={record.id} className="space-y-3 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium text-slate-900">{record.bookTitle}</p>
                      <p className="text-xs text-slate-500">
                        {record.author} · <span className="font-mono">{record.bookCode}</span>
                      </p>
                    </div>
                    <IssueStatusBadge status={record.status} dueDate={record.dueDate} />
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <p className="text-slate-500">Issued</p>
                      <p className="text-slate-800">{formatDate(record.issueDate)}</p>
                    </div>
                    <div>
                      <p className="text-slate-500">Due</p>
                      <p className="text-slate-800">{formatDate(record.dueDate)}</p>
                      {isOverdue(record) ? (
                        <p className="font-medium text-red-700">{overdueDays(record.dueDate)}d late</p>
                      ) : null}
                    </div>
                    <div>
                      <p className="text-slate-500">Returned</p>
                      <p className="text-slate-800">{formatDate(record.returnDate)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        <PaginationBar
          basePath="/dashboard/books"
          page={page}
          totalPages={totalPages}
          params={{ tab, q }}
        />
      </section>

      <p className="text-xs leading-relaxed text-slate-500">
        Issued and returned by the library only. If something looks wrong, contact the IPSA College
        Library desk with your college code.
      </p>
    </div>
  );
}
