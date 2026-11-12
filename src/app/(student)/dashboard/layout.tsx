import { and, eq, lt, sql } from "drizzle-orm";

import { StudentShell } from "@/components/layout/student-shell";
import { db } from "@/lib/db";
import { issueRecords } from "@/lib/db/schema";
import { todayISO } from "@/lib/dates";
import { requireStudent } from "@/lib/session";

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const { student } = await requireStudent();

  const overdue = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(issueRecords)
    .where(
      and(
        eq(issueRecords.studentId, student.id),
        eq(issueRecords.status, "issued"),
        lt(issueRecords.dueDate, todayISO()),
      ),
    );

  return (
    <StudentShell
      studentName={student.fullName}
      collegeCode={student.collegeCode}
      overdueCount={overdue[0]?.count ?? 0}
    >
      {children}
    </StudentShell>
  );
}
