import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  ArrowLeftRight,
  BookOpenCheck,
  CalendarDays,
  CheckCircle2,
  GraduationCap,
  Mail,
  Phone,
  Undo2,
  UserRound,
} from "lucide-react";
import { and, asc, eq, lt, sql } from "drizzle-orm";

import { StudentActions } from "@/components/admin/student-actions";
import { EmptyState } from "@/components/library/empty-state";
import { PageHeader } from "@/components/library/page-header";
import { StatCard } from "@/components/library/stat-card";
import { AccountStatusBadge, IssueStatusBadge } from "@/components/library/status-badge";
import { Button } from "@/components/ui/button";
import { db } from "@/lib/db";
import { books, courses, issueRecords, students } from "@/lib/db/schema";
import { formatDate, isOverdue, todayISO } from "@/lib/dates";

export const metadata = { title: "Student Profile" };

export default async function StudentProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const rows = await db
    .select({ student: students, course: courses })
    .from(students)
    .innerJoin(courses, eq(students.courseId, courses.id))
    .where(eq(students.id, id))
    .limit(1);

  const record = rows[0];
  if (!record) notFound();

  const { student, course } = record;
  const today = todayISO();

  const [courseList, records, statsRows] = await Promise.all([
    db.select().from(courses).orderBy(asc(courses.name)),
    db
      .select({
        id: issueRecords.id,
        recordCode: issueRecords.recordCode,
        issueDate: issueRecords.issueDate,
        dueDate: issueRecords.dueDate,
        returnDate: issueRecords.returnDate,
        status: issueRecords.status,
        bookTitle: books.title,
        bookCode: books.bookCode,
        author: books.author,
      })
      .from(issueRecords)
      .innerJoin(books, eq(issueRecords.bookId, books.id))
      .where(eq(issueRecords.studentId, student.id))
      .orderBy(sql`case when ${issueRecords.status} = 'issued' then 0 else 1 end`, sql`${issueRecords.issueDate} desc`),
    db
      .select({
        active: sql<number>`count(*) filter (where ${issueRecords.status} = 'issued')::int`,
        returned: sql<number>`count(*) filter (where ${issueRecords.status} = 'returned')::int`,
        total: sql<number>`count(*)::int`,
      })
      .from(issueRecords)
      .where(eq(issueRecords.studentId, student.id)),
  ]);

  const overdueRows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(issueRecords)
    .where(
      and(
        eq(issueRecords.studentId, student.id),
        eq(issueRecords.status, "issued"),
        lt(issueRecords.dueDate, today),
      ),
    );

  const stats = statsRows[0] ?? { active: 0, returned: 0, total: 0 };
  const overdue = overdueRows[0]?.count ?? 0;
  const activeRecords = records.filter((item) => item.status === "issued");

  const courseOptions = courseList.map((item) => ({
    id: item.id,
    name: item.name,
    department: item.department,
    isActive: item.isActive,
  }));

  return (
    <div className="space-y-6">
      <div>
        <Button variant="ghost" size="sm" asChild className="-ml-2 mb-2 text-slate-600">
          <Link href="/admin/students">
            <ArrowLeft className="size-4" /> Students
          </Link>
        </Button>
        <PageHeader
          title={student.fullName}
          description={`${student.collegeCode} · ${course.name} · ${student.semester}`}
          actions={
            <>
              <Button variant="outline" asChild>
                <Link href={`/admin/issues/return?code=${student.collegeCode}`}>
                  <Undo2 className="size-4" /> Return book
                </Link>
              </Button>
              <Button asChild>
                <Link href={`/admin/issues/new?code=${student.collegeCode}`}>
                  <ArrowLeftRight className="size-4" /> Issue book
                </Link>
              </Button>
              <StudentActions
                student={student}
                courses={courseOptions}
                redirectAfterDelete
              />
            </>
          }
        />
      </div>

      {overdue > 0 ? (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <CalendarDays className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <p>
            This student has <strong>{overdue}</strong> overdue{" "}
            {overdue === 1 ? "book" : "books"}. Follow up at the earliest.
          </p>
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard label="Currently issued" value={stats.active} icon={BookOpenCheck} tone="blue" />
        <StatCard label="Total returned" value={stats.returned} icon={CheckCircle2} tone="emerald" />
        <StatCard
          label="Overdue"
          value={overdue}
          icon={CalendarDays}
          tone={overdue > 0 ? "red" : "slate"}
        />
        <StatCard label="Lifetime records" value={stats.total} icon={GraduationCap} tone="violet" />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <section className="rounded-xl border border-slate-200 bg-white shadow-xs">
          <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-4 sm:px-5">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Student information</h2>
              <p className="text-xs text-slate-500">Account and contact details</p>
            </div>
            <AccountStatusBadge status={student.status} />
          </div>
          <dl className="grid gap-x-6 gap-y-4 p-4 sm:grid-cols-2 sm:p-5">
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Student ID</dt>
              <dd className="mt-1 break-all font-mono text-xs text-slate-800">{student.id}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">College code</dt>
              <dd className="mt-1 font-mono text-sm font-semibold text-slate-900">{student.collegeCode}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Father&apos;s name</dt>
              <dd className="mt-1 text-sm text-slate-800">{student.fatherName}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Course</dt>
              <dd className="mt-1 text-sm text-slate-800">{course.name}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Department</dt>
              <dd className="mt-1 text-sm text-slate-800">{course.department}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Semester / year</dt>
              <dd className="mt-1 text-sm text-slate-800">{student.semester}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Mobile</dt>
              <dd className="mt-1 flex items-center gap-1.5 text-sm text-slate-800">
                <Phone className="size-3.5 text-slate-400" /> {student.mobile}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Email</dt>
              <dd className="mt-1 flex items-center gap-1.5 break-all text-sm text-slate-800">
                <Mail className="size-3.5 shrink-0 text-slate-400" /> {student.email}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Member since</dt>
              <dd className="mt-1 text-sm text-slate-800">{formatDate(student.createdAt.toISOString().slice(0, 10))}</dd>
            </div>
          </dl>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white shadow-xs">
          <div className="border-b border-slate-200 px-4 py-4 sm:px-5">
            <h2 className="text-sm font-semibold text-slate-900">Currently issued</h2>
            <p className="text-xs text-slate-500">Books with this student right now</p>
          </div>
          {activeRecords.length === 0 ? (
            <div className="p-4 sm:p-5">
              <EmptyState
                icon={BookOpenCheck}
                title="No active loans"
                description="This student has returned every issued book."
                action={
                  <Button size="sm" asChild>
                    <Link href={`/admin/issues/new?code=${student.collegeCode}`}>Issue a book</Link>
                  </Button>
                }
              />
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {activeRecords.map((item) => (
                <div key={item.id} className="px-4 py-3 sm:px-5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-900">{item.bookTitle}</p>
                      <p className="text-xs text-slate-500">
                        {item.author} · <span className="font-mono">{item.bookCode}</span>
                      </p>
                    </div>
                    <IssueStatusBadge status={item.status} dueDate={item.dueDate} />
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    Due {formatDate(item.dueDate)}
                    {isOverdue(item) ? (
                      <span className="ml-1 font-medium text-red-700">· Overdue</span>
                    ) : null}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-4 sm:px-5">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Complete issue history</h2>
            <p className="text-xs text-slate-500">Every transaction, including returned and removed records</p>
          </div>
        </div>

        {records.length === 0 ? (
          <div className="p-4 sm:p-5">
            <EmptyState
              icon={UserRound}
              title="No library transactions yet"
              description="Issue a book to begin this student's borrowing history."
              action={
                <Button size="sm" asChild>
                  <Link href={`/admin/issues/new?code=${student.collegeCode}`}>Issue a book</Link>
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
                    <th className="px-3 py-3 font-medium">Book ID</th>
                    <th className="px-3 py-3 font-medium">Issued</th>
                    <th className="px-3 py-3 font-medium">Due</th>
                    <th className="px-3 py-3 font-medium">Returned</th>
                    <th className="px-5 py-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {records.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/70">
                      <td className="px-5 py-3">
                        <p className="font-medium text-slate-900">{item.bookTitle}</p>
                        <p className="text-xs text-slate-500">{item.author}</p>
                      </td>
                      <td className="px-3 py-3 font-mono text-xs text-slate-700">{item.bookCode}</td>
                      <td className="px-3 py-3 text-slate-700">{formatDate(item.issueDate)}</td>
                      <td className="px-3 py-3 text-slate-700">{formatDate(item.dueDate)}</td>
                      <td className="px-3 py-3 text-slate-700">{formatDate(item.returnDate)}</td>
                      <td className="px-5 py-3">
                        <IssueStatusBadge status={item.status} dueDate={item.dueDate} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="divide-y divide-slate-100 md:hidden">
              {records.map((item) => (
                <div key={item.id} className="space-y-2 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-900">{item.bookTitle}</p>
                      <p className="font-mono text-xs text-slate-500">{item.bookCode}</p>
                    </div>
                    <IssueStatusBadge status={item.status} dueDate={item.dueDate} />
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <p className="text-slate-500">Issued</p>
                      <p className="text-slate-800">{formatDate(item.issueDate)}</p>
                    </div>
                    <div>
                      <p className="text-slate-500">Due</p>
                      <p className="text-slate-800">{formatDate(item.dueDate)}</p>
                    </div>
                    <div>
                      <p className="text-slate-500">Returned</p>
                      <p className="text-slate-800">{formatDate(item.returnDate)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
