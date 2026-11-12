import { and, eq, lt, sql } from "drizzle-orm";

import { AdminShell } from "@/components/layout/admin-shell";
import { db } from "@/lib/db";
import { issueRecords } from "@/lib/db/schema";
import { todayISO } from "@/lib/dates";
import { requireAdmin } from "@/lib/session";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { admin } = await requireAdmin();

  const overdue = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(issueRecords)
    .where(and(eq(issueRecords.status, "issued"), lt(issueRecords.dueDate, todayISO())));

  return (
    <AdminShell
      adminName={admin.fullName}
      adminEmail={admin.email}
      overdueCount={overdue[0]?.count ?? 0}
    >
      {children}
    </AdminShell>
  );
}
