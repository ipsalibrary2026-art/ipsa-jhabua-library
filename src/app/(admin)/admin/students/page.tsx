import Link from "next/link";
import { GraduationCap, Search, UserPlus, X } from "lucide-react";
import { and, asc, eq, ilike, isNull, or, sql, type SQL } from "drizzle-orm";

import { StudentActions } from "@/components/admin/student-actions";
import { StudentFormDialog } from "@/components/admin/student-form-dialog";
import { EmptyState } from "@/components/library/empty-state";
import { PageHeader } from "@/components/library/page-header";
import { PaginationBar } from "@/components/library/pagination-bar";
import { AccountStatusBadge } from "@/components/library/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { db } from "@/lib/db";
import { courses, issueRecords, students } from "@/lib/db/schema";

export const metadata = { title: "Student Management" };

const PAGE_SIZE = 12;

export default async function StudentsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; course?: string; status?: string; page?: string }>;
}) {
  const params = await searchParams;
  const q = params.q?.trim() ?? "";
  const courseFilter = params.course ?? "";
  const statusFilter = params.status === "active" || params.status === "inactive" ? params.status : "";
  const page = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1);

  const filters: SQL[] = [isNull(students.archivedAt)];
  if (q) {
    const term = `%${q}%`;
    const search = or(
      ilike(students.fullName, term),
      ilike(students.collegeCode, term),
      ilike(students.fatherName, term),
      ilike(students.email, term),
      ilike(students.mobile, term),
    );
    if (search) filters.push(search);
  }
  if (courseFilter) filters.push(eq(students.courseId, courseFilter));
  if (statusFilter) filters.push(eq(students.status, statusFilter));
  const where = and(...filters);

  const [courseList, countRows, rows] = await Promise.all([
    db.select().from(courses).orderBy(asc(courses.name)),
    db.select({ count: sql<number>`count(*)::int` }).from(students).where(where),
    db
      .select({
        id: students.id,
        collegeCode: students.collegeCode,
        fullName: students.fullName,
        fatherName: students.fatherName,
        email: students.email,
        mobile: students.mobile,
        courseId: students.courseId,
        semester: students.semester,
        status: students.status,
        courseName: courses.name,
        department: courses.department,
        activeIssues: sql<number>`(
          select count(*)::int from ${issueRecords}
          where ${issueRecords.studentId} = ${students.id} and ${issueRecords.status} = 'issued'
        )`,
      })
      .from(students)
      .innerJoin(courses, eq(students.courseId, courses.id))
      .where(where)
      .orderBy(asc(students.fullName))
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE),
  ]);

  const total = countRows[0]?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const start = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const end = Math.min(page * PAGE_SIZE, total);

  const courseOptions = courseList.map((course) => ({
    id: course.id,
    name: course.name,
    department: course.department,
    isActive: course.isActive,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Student management"
        description="Create library accounts, keep student details current and control access."
        actions={
          <StudentFormDialog
            courses={courseOptions}
            trigger={
              <Button>
                <UserPlus className="size-4" /> Add student
              </Button>
            }
          />
        }
      />

      <form
        method="get"
        className="grid gap-3 rounded-xl border border-slate-200 bg-white p-3 sm:grid-cols-[1fr_auto_auto_auto] sm:items-center sm:p-4"
      >
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <label htmlFor="student-search" className="sr-only">
            Search students
          </label>
          <Input
            id="student-search"
            name="q"
            defaultValue={q}
            placeholder="Search name, college code, email or mobile"
            className="h-10 pl-9"
          />
        </div>
        <div>
          <label htmlFor="course-filter" className="sr-only">
            Filter by course
          </label>
          <select
            id="course-filter"
            name="course"
            defaultValue={courseFilter}
            className="h-10 w-full rounded-md border border-input bg-white px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 sm:w-44"
          >
            <option value="">All courses</option>
            {courseList.map((course) => (
              <option key={course.id} value={course.id}>
                {course.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="status-filter" className="sr-only">
            Filter by account status
          </label>
          <select
            id="status-filter"
            name="status"
            defaultValue={statusFilter}
            className="h-10 w-full rounded-md border border-input bg-white px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 sm:w-36"
          >
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
        <div className="flex gap-2">
          <Button type="submit" className="h-10 flex-1 sm:flex-none">
            Apply
          </Button>
          {q || courseFilter || statusFilter ? (
            <Button variant="outline" size="icon" asChild className="h-10 w-10">
              <Link href="/admin/students" aria-label="Clear filters">
                <X className="size-4" />
              </Link>
            </Button>
          ) : null}
        </div>
      </form>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-4 py-3 sm:px-5">
          <p className="text-sm font-medium text-slate-900">
            {total} {total === 1 ? "student" : "students"}
          </p>
          <p className="text-xs text-slate-500">
            {total > 0 ? `Showing ${start}–${end}` : "No matching accounts"}
          </p>
        </div>

        {rows.length === 0 ? (
          <div className="p-4 sm:p-5">
            <EmptyState
              icon={GraduationCap}
              title="No students found"
              description={
                q || courseFilter || statusFilter
                  ? "Try a different search term or clear the filters."
                  : "Add the first student account to start issuing books."
              }
              action={
                q || courseFilter || statusFilter ? (
                  <Button variant="outline" asChild>
                    <Link href="/admin/students">Clear filters</Link>
                  </Button>
                ) : (
                  <StudentFormDialog
                    courses={courseOptions}
                    trigger={
                      <Button>
                        <UserPlus className="size-4" /> Add student
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
                    <th className="px-5 py-3 font-medium">Student</th>
                    <th className="px-3 py-3 font-medium">College code</th>
                    <th className="px-3 py-3 font-medium">Course</th>
                    <th className="px-3 py-3 font-medium">Semester</th>
                    <th className="px-3 py-3 font-medium">Active loans</th>
                    <th className="px-3 py-3 font-medium">Status</th>
                    <th className="px-5 py-3 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((student) => (
                    <tr key={student.id} className="hover:bg-slate-50/70">
                      <td className="px-5 py-3">
                        <Link
                          href={`/admin/students/${student.id}`}
                          className="font-medium text-slate-900 hover:text-blue-700 hover:underline"
                        >
                          {student.fullName}
                        </Link>
                        <p className="text-xs text-slate-500">{student.email}</p>
                      </td>
                      <td className="px-3 py-3 font-mono text-xs font-medium text-slate-700">
                        {student.collegeCode}
                      </td>
                      <td className="px-3 py-3">
                        <p className="text-slate-800">{student.courseName}</p>
                        <p className="text-xs text-slate-500">{student.department}</p>
                      </td>
                      <td className="px-3 py-3 text-slate-600">{student.semester}</td>
                      <td className="px-3 py-3 tabular-nums text-slate-800">{student.activeIssues}</td>
                      <td className="px-3 py-3">
                        <AccountStatusBadge status={student.status} />
                      </td>
                      <td className="px-5 py-3">
                        <StudentActions student={student} courses={courseOptions} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="divide-y divide-slate-100 md:hidden">
              {rows.map((student) => (
                <div key={student.id} className="space-y-3 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <Link
                        href={`/admin/students/${student.id}`}
                        className="block truncate font-medium text-slate-900"
                      >
                        {student.fullName}
                      </Link>
                      <p className="font-mono text-xs text-slate-500">{student.collegeCode}</p>
                    </div>
                    <AccountStatusBadge status={student.status} />
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <p className="text-slate-500">Course</p>
                      <p className="font-medium text-slate-800">{student.courseName}</p>
                    </div>
                    <div>
                      <p className="text-slate-500">Semester</p>
                      <p className="font-medium text-slate-800">{student.semester}</p>
                    </div>
                    <div>
                      <p className="text-slate-500">Mobile</p>
                      <p className="font-medium text-slate-800">{student.mobile}</p>
                    </div>
                    <div>
                      <p className="text-slate-500">Active loans</p>
                      <p className="font-medium text-slate-800">{student.activeIssues}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between border-t border-slate-100 pt-2">
                    <Button variant="ghost" size="sm" asChild className="px-2">
                      <Link href={`/admin/students/${student.id}`}>View profile</Link>
                    </Button>
                    <StudentActions student={student} courses={courseOptions} />
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        <PaginationBar
          basePath="/admin/students"
          page={page}
          totalPages={totalPages}
          params={{ q, course: courseFilter, status: statusFilter }}
        />
      </section>
    </div>
  );
}
