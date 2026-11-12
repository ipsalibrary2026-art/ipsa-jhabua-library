import Link from "next/link";
import { KeyRound, ShieldCheck, Smartphone, UserRound } from "lucide-react";

import { InstallAppCard } from "@/components/settings/install-app-card";
import { PasswordSettingsForm } from "@/components/settings/password-settings-form";
import { PageHeader } from "@/components/library/page-header";
import { AccountStatusBadge } from "@/components/library/status-badge";
import { Button } from "@/components/ui/button";
import { requireStudent } from "@/lib/session";

export const metadata = { title: "Settings" };

export default async function StudentSettingsPage() {
  const { student, course } = await requireStudent();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        description="Manage your library password and install the student app on your phone."
      />

      <div className="grid gap-4 lg:grid-cols-[1.15fr_1fr]">
        <div className="space-y-4">
          <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs sm:p-5">
            <div className="mb-4 flex items-start gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
                <KeyRound className="size-4.5" aria-hidden="true" />
              </span>
              <div>
                <h2 className="text-sm font-semibold text-slate-900">Change password</h2>
                <p className="text-xs text-slate-500">
                  Use at least 8 characters. You will stay signed in on this device.
                </p>
              </div>
            </div>
            <PasswordSettingsForm />
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs sm:p-5">
            <div className="mb-4 flex items-start gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
                <Smartphone className="size-4.5" aria-hidden="true" />
              </span>
              <div>
                <h2 className="text-sm font-semibold text-slate-900">Install on your phone</h2>
                <p className="text-xs text-slate-500">Add the student portal to your home screen.</p>
              </div>
            </div>
            <InstallAppCard />
          </section>
        </div>

        <div className="space-y-4">
          <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs sm:p-5">
            <div className="mb-4 flex items-start gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
                <UserRound className="size-4.5" aria-hidden="true" />
              </span>
              <div>
                <h2 className="text-sm font-semibold text-slate-900">Account summary</h2>
                <p className="text-xs text-slate-500">Managed by the college library</p>
              </div>
            </div>
            <dl className="space-y-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <dt className="text-slate-500">Student</dt>
                <dd className="truncate font-medium text-slate-900">{student.fullName}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-slate-500">College code</dt>
                <dd className="font-mono text-xs font-semibold text-slate-900">{student.collegeCode}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-slate-500">Course</dt>
                <dd className="text-right text-slate-900">{course.name}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-slate-500">Semester</dt>
                <dd className="text-slate-900">{student.semester}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-slate-500">Status</dt>
                <dd>
                  <AccountStatusBadge status={student.status} />
                </dd>
              </div>
            </dl>
            <Button variant="outline" size="sm" asChild className="mt-4 w-full">
              <Link href="/dashboard/profile">View full profile</Link>
            </Button>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs sm:p-5">
            <div className="flex items-start gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
                <ShieldCheck className="size-4.5" aria-hidden="true" />
              </span>
              <div>
                <h2 className="text-sm font-semibold text-slate-900">Locked out?</h2>
                <p className="mt-1 text-sm leading-relaxed text-slate-600">
                  Visit the IPSA College Library with your college ID. The librarian can verify your
                  identity and set a new password from Student Management.
                </p>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
