import Link from "next/link";
import { ArrowLeft, KeyRound, Mail, UserRoundCheck } from "lucide-react";

import { AuthShell } from "@/components/auth/auth-shell";

export const metadata = {
  title: "Password Recovery",
};

export default function ForgotPasswordPage() {
  return (
    <AuthShell
      eyebrow="Account help"
      title="Password recovery"
      subtitle="Library accounts are managed by the librarian, so password recovery is handled securely at the circulation desk."
    >
      <div className="space-y-5">
        <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
              <UserRoundCheck className="size-4.5" aria-hidden="true" />
            </span>
            <div>
              <p className="text-sm font-medium text-slate-900">Students</p>
              <p className="mt-0.5 text-sm leading-relaxed text-slate-600">
                Visit the IPSA College Library with your college ID. The librarian will verify your
                identity and set a new password from Student Management.
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
              <KeyRound className="size-4.5" aria-hidden="true" />
            </span>
            <div>
              <p className="text-sm font-medium text-slate-900">Librarians</p>
              <p className="mt-0.5 text-sm leading-relaxed text-slate-600">
                Sign in with your administrator account and change the password from Settings. If
                you are locked out, contact the college IT administrator to restore access.
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
              <Mail className="size-4.5" aria-hidden="true" />
            </span>
            <div>
              <p className="text-sm font-medium text-slate-900">Library desk</p>
              <p className="mt-0.5 text-sm leading-relaxed text-slate-600">
                Monday to Saturday, 9:00 am – 5:00 pm · library@ipsa.edu
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
          <Link
            href="/login"
            className="inline-flex items-center gap-1.5 font-medium text-blue-700 hover:underline"
          >
            <ArrowLeft className="size-4" /> Student login
          </Link>
          <Link href="/admin/login" className="font-medium text-slate-600 hover:text-slate-900">
            Administrator login
          </Link>
        </div>
      </div>
    </AuthShell>
  );
}
