import Link from "next/link";
import { BookOpenCheck, GraduationCap, Lock, Mail, Phone, Settings, ShieldCheck } from "lucide-react";

import { PageHeader } from "@/components/library/page-header";
import { AccountStatusBadge } from "@/components/library/status-badge";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/dates";
import { requireStudent } from "@/lib/session";

export const metadata = { title: "My Profile" };

export default async function StudentProfilePage() {
  const { student, course } = await requireStudent();

  return (
    <div className="space-y-6">
      <PageHeader
        title="My profile"
        description="Your library account details. Contact the library desk if any information needs to change."
        actions={
          <Button variant="outline" asChild>
            <Link href="/dashboard/settings">
              <Settings className="size-4" /> Account settings
            </Link>
          </Button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
          <div className="flex items-center gap-4 border-b border-slate-200 bg-gradient-to-r from-blue-50 to-white px-4 py-5 sm:px-5">
            <span className="flex size-14 shrink-0 items-center justify-center rounded-full bg-blue-700 text-lg font-semibold text-white">
              {student.fullName
                .split(" ")
                .filter(Boolean)
                .slice(0, 2)
                .map((part) => part[0])
                .join("")}
            </span>
            <div className="min-w-0">
              <h2 className="truncate text-lg font-semibold text-slate-900">{student.fullName}</h2>
              <p className="font-mono text-sm text-blue-700">{student.collegeCode}</p>
              <p className="mt-1 text-sm text-slate-600">
                {course.name} · {student.semester}
              </p>
            </div>
            <div className="ml-auto hidden sm:block">
              <AccountStatusBadge status={student.status} />
            </div>
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
              <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Mobile number</dt>
              <dd className="mt-1 flex items-center gap-1.5 text-sm text-slate-800">
                <Phone className="size-3.5 text-slate-400" /> {student.mobile}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Email address</dt>
              <dd className="mt-1 flex items-center gap-1.5 break-all text-sm text-slate-800">
                <Mail className="size-3.5 shrink-0 text-slate-400" /> {student.email}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Member since</dt>
              <dd className="mt-1 text-sm text-slate-800">
                {formatDate(student.createdAt.toISOString().slice(0, 10))}
              </dd>
            </div>
            <div className="sm:hidden">
              <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Account status</dt>
              <dd className="mt-1">
                <AccountStatusBadge status={student.status} />
              </dd>
            </div>
          </dl>
        </section>

        <div className="space-y-4">
          <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs sm:p-5">
            <div className="flex items-start gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
                <Lock className="size-4.5" aria-hidden="true" />
              </span>
              <div>
                <h2 className="text-sm font-semibold text-slate-900">Read-only account</h2>
                <p className="mt-1 text-sm leading-relaxed text-slate-600">
                  Students cannot edit profile details, add books or change issue records. Contact
                  the library desk for any correction.
                </p>
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs sm:p-5">
            <div className="flex items-start gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
                <ShieldCheck className="size-4.5" aria-hidden="true" />
              </span>
              <div>
                <h2 className="text-sm font-semibold text-slate-900">Your privacy</h2>
                <p className="mt-1 text-sm leading-relaxed text-slate-600">
                  Your account can only see your own profile and issue records. Other students&apos;
                  information is never visible to you.
                </p>
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs sm:p-5">
            <div className="flex items-start gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-violet-50 text-violet-700">
                <GraduationCap className="size-4.5" aria-hidden="true" />
              </span>
              <div>
                <h2 className="text-sm font-semibold text-slate-900">Library desk</h2>
                <p className="mt-1 text-sm leading-relaxed text-slate-600">
                  Monday to Saturday, 9:00 am – 5:00 pm
                  <br />
                  library@ipsa.edu
                </p>
              </div>
            </div>
          </section>

          <Button variant="outline" asChild className="w-full">
            <Link href="/dashboard/books">
              <BookOpenCheck className="size-4" /> View my issued books
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
