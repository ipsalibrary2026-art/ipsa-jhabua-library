import { KeyRound, LibraryBig, Smartphone, UserCog } from "lucide-react";
import { asc } from "drizzle-orm";

import { AdminProfileForm } from "@/components/settings/admin-profile-form";
import { CourseManager } from "@/components/settings/course-manager";
import { InstallAppCard } from "@/components/settings/install-app-card";
import { PasswordSettingsForm } from "@/components/settings/password-settings-form";
import { PageHeader } from "@/components/library/page-header";
import { db } from "@/lib/db";
import { courses } from "@/lib/db/schema";
import { requireAdmin } from "@/lib/session";

export const metadata = { title: "Settings" };

export default async function AdminSettingsPage() {
  const { admin } = await requireAdmin();
  const courseRows = await db.select().from(courses).orderBy(asc(courses.name));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        description="Manage your librarian account, security and the courses available to students."
      />

      <div className="grid gap-4 xl:grid-cols-[1.15fr_1fr]">
        <div className="space-y-4">
          <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs sm:p-5">
            <div className="mb-4 flex items-start gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
                <UserCog className="size-4.5" aria-hidden="true" />
              </span>
              <div>
                <h2 className="text-sm font-semibold text-slate-900">Librarian profile</h2>
                <p className="text-xs text-slate-500">Your name appears on audit records.</p>
              </div>
            </div>
            <AdminProfileForm fullName={admin.fullName} email={admin.email} />
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs sm:p-5">
            <div className="mb-4 flex items-start gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
                <KeyRound className="size-4.5" aria-hidden="true" />
              </span>
              <div>
                <h2 className="text-sm font-semibold text-slate-900">Password</h2>
                <p className="text-xs text-slate-500">Change the password used for administrator login.</p>
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
                <h2 className="text-sm font-semibold text-slate-900">Progressive web app</h2>
                <p className="text-xs text-slate-500">Install the library system on this device.</p>
              </div>
            </div>
            <InstallAppCard />
          </section>
        </div>

        <div className="space-y-4">
          <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs sm:p-5">
            <div className="mb-4 flex items-start gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
                <LibraryBig className="size-4.5" aria-hidden="true" />
              </span>
              <div>
                <h2 className="text-sm font-semibold text-slate-900">Courses & departments</h2>
                <p className="text-xs text-slate-500">
                  Add new programmes without changing any code.
                </p>
              </div>
            </div>
            <CourseManager
              courses={courseRows.map((course) => ({
                id: course.id,
                name: course.name,
                department: course.department,
                isActive: course.isActive,
              }))}
            />
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-4 text-sm shadow-xs sm:p-5">
            <h2 className="text-sm font-semibold text-slate-900">Security notes</h2>
            <ul className="mt-3 space-y-2 text-slate-600">
              <li>Student accounts can only read their own profile and issue records.</li>
              <li>Deactivating or deleting a student immediately ends their active sessions.</li>
              <li>Every issue, return, date change and record removal is written to the audit log.</li>
              <li>Student passwords can be reset from Student Management at any time.</li>
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
