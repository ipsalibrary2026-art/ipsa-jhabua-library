"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ArrowLeftRight,
  Bell,
  BookCopy,
  BookOpenCheck,
  ClipboardList,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Menu,
  ScrollText,
  Settings,
  Undo2,
} from "lucide-react";
import { toast } from "sonner";

import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";
import { initials } from "@/lib/dates";
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
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

const navItems = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/admin/students", label: "Students", icon: GraduationCap },
  { href: "/admin/books", label: "Books", icon: BookCopy },
  { href: "/admin/issues/new", label: "Issue Book", icon: ArrowLeftRight },
  { href: "/admin/issues/return", label: "Return Book", icon: Undo2 },
  { href: "/admin/issues", label: "Issue Records", icon: ClipboardList, exact: true },
  { href: "/admin/reports", label: "Reports", icon: BookOpenCheck },
  { href: "/admin/audit", label: "Audit Log", icon: ScrollText },
  { href: "/admin/settings", label: "Settings", icon: Settings },
];

function isActive(pathname: string, href: string, exact?: boolean) {
  if (exact) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

function AdminNav({
  pathname,
  onNavigate,
}: {
  pathname: string;
  onNavigate?: () => void;
}) {
  return (
    <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
      {navItems.map((item) => {
        const active = isActive(pathname, item.href, item.exact);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              "flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors",
              active
                ? "bg-blue-50 text-blue-800"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
            )}
            aria-current={active ? "page" : undefined}
          >
            <item.icon
              className={cn("size-4.5 shrink-0", active ? "text-blue-700" : "text-slate-500")}
              aria-hidden="true"
            />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

function AccountBlock({
  adminName,
  adminEmail,
  onNavigate,
}: {
  adminName: string;
  adminEmail: string;
  onNavigate?: () => void;
}) {
  return (
    <div className="border-t border-slate-200 p-3">
      <div className="flex items-center gap-3 rounded-lg bg-slate-50 p-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-blue-700 text-xs font-semibold text-white">
          {initials(adminName)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-slate-900">{adminName}</p>
          <p className="truncate text-xs text-slate-500">{adminEmail}</p>
        </div>
      </div>
      <Button variant="ghost" asChild className="mt-2 w-full justify-start text-slate-600">
        <Link href="/admin/settings" onClick={onNavigate}>
          <Settings className="size-4" /> Account settings
        </Link>
      </Button>
    </div>
  );
}

export function AdminShell({
  children,
  adminName,
  adminEmail,
  overdueCount,
}: {
  children: React.ReactNode;
  adminName: string;
  adminEmail: string;
  overdueCount: number;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await authClient.signOut();
      router.replace("/admin/login");
      router.refresh();
    } catch {
      toast.error("Could not sign out. Please try again.");
      setSigningOut(false);
    }
  }

  return (
    <div className="min-h-svh bg-slate-50">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-slate-200 bg-white lg:flex">
        <div className="flex h-16 items-center border-b border-slate-200 px-4">
          <Link href="/admin" aria-label="IPSA Library admin dashboard">
            <BrandLockup compact />
          </Link>
        </div>
        <AdminNav pathname={pathname} />
        <AccountBlock adminName={adminName} adminEmail={adminEmail} />
      </aside>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-3 border-b border-slate-200 bg-white/95 px-4 backdrop-blur sm:px-6">
          <div className="flex items-center gap-3">
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" size="icon" className="lg:hidden" aria-label="Open menu">
                  <Menu className="size-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="flex w-72 flex-col p-0">
                <SheetTitle className="sr-only">Administration menu</SheetTitle>
                <div className="flex h-16 items-center border-b border-slate-200 px-4">
                  <BrandLockup compact />
                </div>
                <AdminNav pathname={pathname} onNavigate={() => setOpen(false)} />
                <AccountBlock
                  adminName={adminName}
                  adminEmail={adminEmail}
                  onNavigate={() => setOpen(false)}
                />
              </SheetContent>
            </Sheet>
            <div className="lg:hidden">
              <BrandLockup compact />
            </div>
            <div className="hidden lg:block">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Library administration
              </p>
              <p className="text-sm font-semibold text-slate-900">Circulation & catalogue</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2">
            <Button variant="ghost" size="icon" asChild className="relative">
              <Link
                href="/admin/issues?status=overdue"
                aria-label={`Overdue books${overdueCount ? `: ${overdueCount}` : ""}`}
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
                    {initials(adminName)}
                  </span>
                  <span className="hidden max-w-32 truncate font-medium text-slate-700 sm:block">
                    {adminName}
                  </span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <span className="block truncate font-medium">{adminName}</span>
                  <span className="block truncate text-xs font-normal text-muted-foreground">
                    {adminEmail}
                  </span>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/admin/settings">
                    <Settings className="size-4" /> Settings
                  </Link>
                </DropdownMenuItem>
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
        </header>

        <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8">{children}</main>
      </div>
    </div>
  );
}
