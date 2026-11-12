import Link from "next/link";
import { ScrollText, Search, X } from "lucide-react";
import { desc, ilike, or, sql, type SQL, and } from "drizzle-orm";

import { EmptyState } from "@/components/library/empty-state";
import { PageHeader } from "@/components/library/page-header";
import { PaginationBar } from "@/components/library/pagination-bar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { db } from "@/lib/db";
import { auditLogs } from "@/lib/db/schema";
import { formatDateTime } from "@/lib/dates";

export const metadata = { title: "Audit Log" };

const PAGE_SIZE = 20;

function actionTone(action: string) {
  if (action.includes("delete") || action.includes("remove") || action.includes("archive")) {
    return "border-red-200 bg-red-50 text-red-700";
  }
  if (action.includes("return")) return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (action.includes("issue")) return "border-blue-200 bg-blue-50 text-blue-700";
  if (action.includes("update") || action.includes("password")) {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }
  return "border-slate-200 bg-slate-100 text-slate-600";
}

export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const params = await searchParams;
  const q = params.q?.trim() ?? "";
  const page = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1);

  const filters: SQL[] = [];
  if (q) {
    const term = `%${q}%`;
    const search = or(
      ilike(auditLogs.actorName, term),
      ilike(auditLogs.action, term),
      ilike(auditLogs.entityType, term),
      ilike(auditLogs.entityId, term),
    );
    if (search) filters.push(search);
  }
  const where = filters.length > 0 ? and(...filters) : undefined;

  const [countRows, rows] = await Promise.all([
    db.select({ count: sql<number>`count(*)::int` }).from(auditLogs).where(where),
    db
      .select()
      .from(auditLogs)
      .where(where)
      .orderBy(desc(auditLogs.createdAt))
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE),
  ]);

  const total = countRows[0]?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Audit log"
        description="A permanent trail of administrative changes: issues, returns, edits, removals and account actions."
      />

      <form method="get" className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-3 sm:flex-row sm:items-center sm:p-4">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <label htmlFor="audit-search" className="sr-only">
            Search audit log
          </label>
          <Input
            id="audit-search"
            name="q"
            defaultValue={q}
            placeholder="Search by librarian, action or entity"
            className="h-10 pl-9"
          />
        </div>
        <Button type="submit" className="h-10">
          Search
        </Button>
        {q ? (
          <Button variant="outline" size="icon" asChild className="h-10 w-10">
            <Link href="/admin/audit" aria-label="Clear search">
              <X className="size-4" />
            </Link>
          </Button>
        ) : null}
      </form>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
        <div className="border-b border-slate-200 px-4 py-3 sm:px-5">
          <p className="text-sm font-medium text-slate-900">
            {total} {total === 1 ? "entry" : "entries"}
          </p>
        </div>

        {rows.length === 0 ? (
          <div className="p-4 sm:p-5">
            <EmptyState
              icon={ScrollText}
              title="No audit entries found"
              description={q ? "Try a different search term." : "Administrative changes will appear here."}
            />
          </div>
        ) : (
          <ol className="divide-y divide-slate-100">
            {rows.map((entry) => (
              <li key={entry.id} className="px-4 py-4 sm:px-5">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                      <ScrollText className="size-4" aria-hidden="true" />
                    </span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className={actionTone(entry.action)}>
                          {entry.action}
                        </Badge>
                        <span className="text-xs text-slate-500">
                          {entry.entityType}
                          {entry.entityId ? ` · ${entry.entityId.slice(0, 8)}` : ""}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-slate-800">
                        <span className="font-medium">{entry.actorName}</span> ·{" "}
                        {entry.actorRole === "admin" ? "Librarian" : entry.actorRole}
                      </p>
                      {entry.details && Object.keys(entry.details).length > 0 ? (
                        <pre className="mt-2 max-w-full overflow-x-auto rounded-md bg-slate-50 px-2.5 py-2 text-[11px] leading-relaxed text-slate-600">
                          {JSON.stringify(entry.details, null, 2)}
                        </pre>
                      ) : null}
                    </div>
                  </div>
                  <p className="shrink-0 text-xs text-slate-500">{formatDateTime(entry.createdAt)}</p>
                </div>
              </li>
            ))}
          </ol>
        )}

        <PaginationBar basePath="/admin/audit" page={page} totalPages={totalPages} params={{ q }} />
      </section>
    </div>
  );
}
