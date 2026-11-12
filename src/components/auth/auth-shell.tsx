import type { ReactNode } from "react";
import { BarChart3, BookCheck, ShieldCheck } from "lucide-react";

import { BrandLockup } from "@/components/brand";

const highlights = [
  {
    icon: BookCheck,
    title: "Track every loan",
    description: "Live issue and return records, with automatic overdue alerts.",
  },
  {
    icon: BarChart3,
    title: "Reports in a click",
    description: "Student-wise, book-wise and monthly reports ready to export.",
  },
  {
    icon: ShieldCheck,
    title: "Role-based access",
    description: "Students see only their own record. Librarians manage the rest.",
  },
];

export function AuthShell({
  children,
  eyebrow,
  title,
  subtitle,
}: {
  children: ReactNode;
  eyebrow: string;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="min-h-svh bg-slate-50 lg:grid lg:grid-cols-[1.05fr_1fr]">
      <div className="relative hidden overflow-hidden bg-gradient-to-br from-blue-950 via-blue-800 to-blue-600 p-10 text-white lg:flex lg:flex-col lg:justify-between xl:p-14">
        <div className="absolute -right-28 -top-28 size-96 rounded-full bg-white/10 blur-2xl" />
        <div className="absolute -bottom-32 -left-20 size-96 rounded-full bg-cyan-300/10 blur-2xl" />
        <div className="relative">
          <BrandLockup inverted />
        </div>
        <div className="relative max-w-lg space-y-8">
          <div className="space-y-4">
            <h2 className="text-4xl font-semibold leading-tight tracking-tight xl:text-5xl">
              The college library,
              <br />
              running on one system.
            </h2>
            <p className="max-w-md text-base leading-relaxed text-blue-100">
              IPSA College Library keeps the catalogue, circulation desk and student accounts in
              sync — on desktop, tablet and phone.
            </p>
          </div>
          <ul className="space-y-5">
            {highlights.map((item) => (
              <li key={item.title} className="flex gap-3">
                <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-white/10 ring-1 ring-white/15">
                  <item.icon className="size-4.5" aria-hidden="true" />
                </span>
                <div>
                  <p className="text-sm font-medium">{item.title}</p>
                  <p className="text-sm text-blue-100/85">{item.description}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-xs text-blue-200/70">
          IPSA College · Library Management System
        </p>
      </div>

      <div className="flex min-h-svh flex-col">
        <div className="bg-gradient-to-r from-blue-950 to-blue-700 px-5 py-4 text-white lg:hidden">
          <BrandLockup inverted />
        </div>
        <div className="flex flex-1 items-center justify-center px-4 py-10 sm:px-6">
          <div className="w-full max-w-md">
            <div className="mb-8 space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">
                {eyebrow}
              </p>
              <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
                {title}
              </h1>
              <p className="text-sm leading-relaxed text-slate-600">{subtitle}</p>
            </div>
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
