import Link from "next/link";
import { BookCopy, LibraryBig, Plus, Search, X } from "lucide-react";
import {
  and,
  asc,
  eq,
  gt,
  ilike,
  inArray,
  isNotNull,
  isNull,
  or,
  sql,
  type SQL,
} from "drizzle-orm";

import { BookActions } from "@/components/admin/book-actions";
import { BookFormDialog } from "@/components/admin/book-form-dialog";
import { EmptyState } from "@/components/library/empty-state";
import { PageHeader } from "@/components/library/page-header";
import { PaginationBar } from "@/components/library/pagination-bar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { db } from "@/lib/db";
import { bookCopies, books } from "@/lib/db/schema";

export const metadata = { title: "Book Management" };

const PAGE_SIZE = 12;

export default async function BooksPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string; availability?: string; page?: string }>;
}) {
  const params = await searchParams;
  const q = params.q?.trim() ?? "";
  const categoryFilter = params.category ?? "";
  const availability = ["available", "out", "archived"].includes(params.availability ?? "")
    ? (params.availability as "available" | "out" | "archived")
    : "";
  const page = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1);

  const filters: SQL[] = [];
  if (availability === "archived") filters.push(isNotNull(books.archivedAt));
  else {
    filters.push(isNull(books.archivedAt));
    if (availability === "available") filters.push(gt(books.availableCopies, 0));
    if (availability === "out") filters.push(eq(books.availableCopies, 0));
  }
  if (q) {
    const term = `%${q}%`;
    const search = or(
      ilike(books.title, term),
      ilike(books.author, term),
      ilike(books.bookCode, term),
      ilike(books.category, term),
      ilike(books.publisher, term),
    );
    if (search) filters.push(search);
  }
  if (categoryFilter) filters.push(eq(books.category, categoryFilter));
  const where = and(...filters);

  const [categoryRows, countRows, rows, totals] = await Promise.all([
    db
      .selectDistinct({ category: books.category })
      .from(books)
      .where(isNull(books.archivedAt))
      .orderBy(asc(books.category)),
    db.select({ count: sql<number>`count(*)::int` }).from(books).where(where),
    db
      .select()
      .from(books)
      .where(where)
      .orderBy(asc(books.title))
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE),
    db
      .select({
        titles: sql<number>`count(*)::int`,
        copies: sql<number>`coalesce(sum(${books.totalCopies}), 0)::int`,
        available: sql<number>`coalesce(sum(${books.availableCopies}), 0)::int`,
      })
      .from(books)
      .where(isNull(books.archivedAt)),
  ]);

  const copyRows =
    rows.length > 0
      ? await db
          .select({
            bookId: bookCopies.bookId,
            copyCode: bookCopies.copyCode,
            status: bookCopies.status,
          })
          .from(bookCopies)
          .where(inArray(bookCopies.bookId, rows.map((book) => book.id)))
          .orderBy(asc(bookCopies.copyCode))
      : [];

  const copiesByBook = new Map<string, { copyCode: string; status: string }[]>();
  for (const copy of copyRows) {
    const list = copiesByBook.get(copy.bookId) ?? [];
    list.push({ copyCode: copy.copyCode, status: copy.status });
    copiesByBook.set(copy.bookId, list);
  }

  const total = countRows[0]?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const start = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const end = Math.min(page * PAGE_SIZE, total);
  const categories = categoryRows.map((row) => row.category);
  const summary = totals[0] ?? { titles: 0, copies: 0, available: 0 };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Book management"
        description="Maintain the catalogue, track copies on the shelf and keep shelf locations accurate."
        actions={
          <BookFormDialog
            categories={categories}
            trigger={
              <Button>
                <Plus className="size-4" /> Add book
              </Button>
            }
          />
        }
      />

      <div className="grid grid-cols-3 gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-xs sm:gap-6 sm:p-5">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Book titles</p>
          <p className="mt-1 text-xl font-semibold tabular-nums text-slate-900 sm:text-2xl">
            {summary.titles}
          </p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Total copies</p>
          <p className="mt-1 text-xl font-semibold tabular-nums text-slate-900 sm:text-2xl">
            {summary.copies}
          </p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">On the shelf</p>
          <p className="mt-1 text-xl font-semibold tabular-nums text-emerald-700 sm:text-2xl">
            {summary.available}
          </p>
        </div>
      </div>

      <form
        method="get"
        className="grid gap-3 rounded-xl border border-slate-200 bg-white p-3 sm:grid-cols-[1fr_auto_auto_auto] sm:items-center sm:p-4"
      >
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <label htmlFor="book-search" className="sr-only">
            Search books
          </label>
          <Input
            id="book-search"
            name="q"
            defaultValue={q}
            placeholder="Search title, author, Book ID or publisher"
            className="h-10 pl-9"
          />
        </div>
        <div>
          <label htmlFor="category-filter" className="sr-only">
            Filter by category
          </label>
          <select
            id="category-filter"
            name="category"
            defaultValue={categoryFilter}
            className="h-10 w-full rounded-md border border-input bg-white px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 sm:w-44"
          >
            <option value="">All categories</option>
            {categories.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="availability-filter" className="sr-only">
            Filter by availability
          </label>
          <select
            id="availability-filter"
            name="availability"
            defaultValue={availability}
            className="h-10 w-full rounded-md border border-input bg-white px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 sm:w-40"
          >
            <option value="">All books</option>
            <option value="available">Available now</option>
            <option value="out">Fully issued</option>
            <option value="archived">Archived</option>
          </select>
        </div>
        <div className="flex gap-2">
          <Button type="submit" className="h-10 flex-1 sm:flex-none">
            Apply
          </Button>
          {q || categoryFilter || availability ? (
            <Button variant="outline" size="icon" asChild className="h-10 w-10">
              <Link href="/admin/books" aria-label="Clear filters">
                <X className="size-4" />
              </Link>
            </Button>
          ) : null}
        </div>
      </form>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-4 py-3 sm:px-5">
          <p className="text-sm font-medium text-slate-900">
            {total} {total === 1 ? "entry" : "entries"}
          </p>
          <p className="text-xs text-slate-500">
            {total > 0 ? `Showing ${start}–${end}` : "No matching books"}
          </p>
        </div>

        {rows.length === 0 ? (
          <div className="p-4 sm:p-5">
            <EmptyState
              icon={LibraryBig}
              title="No books found"
              description={
                q || categoryFilter || availability
                  ? "Try a different search term or clear the filters."
                  : "Add the first title to the catalogue."
              }
              action={
                q || categoryFilter || availability ? (
                  <Button variant="outline" asChild>
                    <Link href="/admin/books">Clear filters</Link>
                  </Button>
                ) : (
                  <BookFormDialog
                    categories={categories}
                    trigger={
                      <Button>
                        <Plus className="size-4" /> Add book
                      </Button>
                    }
                  />
                )
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
                    <th className="px-3 py-3 font-medium">Book ID</th>
                    <th className="px-3 py-3 font-medium">Category</th>
                    <th className="px-3 py-3 font-medium">Copies</th>
                    <th className="px-3 py-3 font-medium">Shelf</th>
                    <th className="px-5 py-3 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((book) => (
                    <tr key={book.id} className="hover:bg-slate-50/70">
                      <td className="px-5 py-3">
                        <p className="font-medium text-slate-900">{book.title}</p>
                        <p className="text-xs text-slate-500">
                          {book.author} · {book.edition} edition
                        </p>
                        {book.archivedAt ? (
                          <Badge variant="outline" className="mt-1 border-slate-200 bg-slate-100 text-slate-600">
                            Archived
                          </Badge>
                        ) : null}
                      </td>
                      <td className="px-3 py-3">
                        <p className="font-mono text-xs font-medium text-slate-700">
                          {book.bookCode}
                        </p>
                        {(copiesByBook.get(book.id)?.length ?? 0) > 1 ? (
                          <p className="mt-1 max-w-40 text-[11px] leading-relaxed text-slate-500">
                            {copiesByBook
                              .get(book.id)
                              ?.map((copy) => copy.copyCode)
                              .join(", ")}
                          </p>
                        ) : null}
                      </td>
                      <td className="px-3 py-3 text-slate-700">{book.category}</td>
                      <td className="px-3 py-3">
                        <div className="w-28">
                          <div className="flex items-baseline justify-between text-xs">
                            <span className="font-semibold tabular-nums text-slate-900">
                              {book.availableCopies}/{book.totalCopies}
                            </span>
                            <span className="text-slate-500">available</span>
                          </div>
                          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
                            <div
                              className={
                                book.availableCopies === 0
                                  ? "h-full rounded-full bg-red-400"
                                  : "h-full rounded-full bg-emerald-500"
                              }
                              style={{
                                width: `${Math.round((book.availableCopies / Math.max(book.totalCopies, 1)) * 100)}%`,
                              }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-slate-700">{book.shelfNumber}</td>
                      <td className="px-5 py-3">
                        <BookActions
                          book={{
                            id: book.id,
                            bookCode: book.bookCode,
                            title: book.title,
                            author: book.author,
                            publisher: book.publisher,
                            edition: book.edition,
                            category: book.category,
                            shelfNumber: book.shelfNumber,
                          }}
                          categories={categories}
                          archived={Boolean(book.archivedAt)}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="divide-y divide-slate-100 md:hidden">
              {rows.map((book) => (
                <div key={book.id} className="space-y-3 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium text-slate-900">{book.title}</p>
                      <p className="text-xs text-slate-500">
                        {book.author} · <span className="font-mono">{book.bookCode}</span>
                        {(copiesByBook.get(book.id)?.length ?? 0) > 1 ? (
                          <span className="block text-[11px] text-slate-400">
                            {copiesByBook
                              .get(book.id)
                              ?.map((copy) => copy.copyCode)
                              .join(", ")}
                          </span>
                        ) : null}
                      </p>
                    </div>
                    {book.archivedAt ? (
                      <Badge variant="outline" className="border-slate-200 bg-slate-100 text-slate-600">
                        Archived
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700">
                        {book.category}
                      </Badge>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <p className="text-slate-500">Available</p>
                      <p className="font-semibold text-slate-900">
                        {book.availableCopies}/{book.totalCopies}
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-500">Shelf</p>
                      <p className="font-medium text-slate-800">{book.shelfNumber}</p>
                    </div>
                    <div>
                      <p className="text-slate-500">Edition</p>
                      <p className="font-medium text-slate-800">{book.edition}</p>
                    </div>
                  </div>
                  <div className="flex justify-end border-t border-slate-100 pt-2">
                    <BookActions
                      book={{
                        id: book.id,
                        bookCode: book.bookCode,
                        title: book.title,
                        author: book.author,
                        publisher: book.publisher,
                        edition: book.edition,
                        category: book.category,
                        shelfNumber: book.shelfNumber,
                      }}
                      categories={categories}
                      archived={Boolean(book.archivedAt)}
                    />
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        <PaginationBar
          basePath="/admin/books"
          page={page}
          totalPages={totalPages}
          params={{ q, category: categoryFilter, availability }}
        />
      </section>

      {summary.titles === 0 ? (
        <p className="flex items-center gap-2 text-xs text-slate-500">
          <BookCopy className="size-3.5" /> Tip: add categories like Management, Computer Science,
          Biotechnology or Horticulture to keep reports grouped.
        </p>
      ) : null}
    </div>
  );
}
