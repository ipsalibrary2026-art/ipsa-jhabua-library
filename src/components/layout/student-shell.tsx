"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Bell, BookOpen, Home, LogOut, Settings, UserRound } from "lucide-react";
import { toast } from "sonner";

import { authClient } from "@/lib/auth-client";
import { initials } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { BrandLockup } from "@/components/brand";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const navItems = [
  { href: "/dashboard", label: "Overview", icon: Home, exact: true },
  { href: "/dashboard/books", label: "My Books", icon: BookOpen },
  { href: "/dashboard/profile", label: "Profile", icon: UserRound },
];

const mobileItems = [
  ...navItems,
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
];

export function StudentShell({
  children,
  studentName,
  collegeCode,
  overdueCount,
}: {
  children: React.ReactNode;
  studentName: string;
  collegeCode: string;
  overdueCount: number;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await authClient.signOut();
      router.replace("/login");
      router.refresh();
    } catch {
      toast.error("Could not sign out. Please try again.");
      setSigningOut(false);
    }
  }

  function active(href: string, exact?: boolean) {
    return exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
  }

  return (
    <div className="min-h-svh bg-slate-50">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
          <Link href="/dashboard" aria-label="IPSA Library student dashboard">
            <BrandLockup compact />
          </Link>

          <nav className="hidden items-center gap-1 md:flex" aria-label="Student navigation">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  active(item.href, item.exact)
                    ? "bg-blue-50 text-blue-800"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
                )}
                aria-current={active(item.href, item.exact) ? "page" : undefined}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-1.5">
            <Button variant="ghost" size="icon" asChild className="relative">
              <Link
                href="/dashboard/books"
                aria-label={`My books${overdueCount ? `, ${overdueCount} overdue` : ""}`}
              >
                <Bell className="size-5" />
                {overdueCount > 0 ? (
                  <span className="absolute right-1.5 top-1.5 flex min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-semibold leading-4 text-white">
                    {overdueCount > 99 ? "99+" : overdueCount}
                  </span>
                ) : null}
              </Link>
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="flex items-center gap-2 rounded-full border border-slate-200 bg-white py-1 pl-1 pr-2.5 text-sm hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                  aria-label="Account menu"
                >
                  <span className="flex size-7 items-center justify-center rounded-full bg-blue-700 text-[11px] font-semibold text-white">
                    {initials(studentName)}
                  </span>
                  <span className="hidden max-w-28 truncate font-medium text-slate-700 sm:block">
                    {studentName.split(" ")[0]}
                  </span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-60">
                <DropdownMenuLabel>
                  <span className="block truncate font-medium">{studentName}</span>
                  <span className="block truncate font-mono text-xs font-normal text-muted-foreground">
                    {collegeCode}
                  </span>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/dashboard/profile">
                    <UserRound className="size-4" /> My profile
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/dashboard/settings">
                    <Settings className="size-4" /> Settings
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={handleSignOut}
                  disabled={signingOut}
                  className="text-red-600 focus:text-red-700"
                >
                  <LogOut className="size-4" /> {signingOut ? "Signing out…" : "Sign out"}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 pb-24 pt-6 sm:px-6 sm:pt-8 md:pb-10">
        {children}
      </main>

      <nav
        className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
        aria-label="Mobile navigation"
      >
        <div className="grid grid-cols-4">
          {mobileItems.map((item) => {
            const isCurrent = active(item.href, item.exact);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex min-h-14 flex-col items-center justify-center gap-1 text-[11px] font-medium",
                  isCurrent ? "text-blue-700" : "text-slate-500",
                )}
                aria-current={isCurrent ? "page" : undefined}
              >
                <item.icon className="size-5" aria-hidden="true" />
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
