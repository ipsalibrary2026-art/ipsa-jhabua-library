import { redirect } from "next/navigation";

import { AdminLoginForm } from "@/components/auth/admin-login-form";
import { AuthShell } from "@/components/auth/auth-shell";
import { getSession } from "@/lib/session";

export const metadata = {
  title: "Administrator Login",
};

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  const session = await getSession();
  if (session?.user.role === "admin") redirect("/admin");
  if (session?.user.role === "student") redirect("/dashboard");

  const initialError =
    params.error === "unauthorized"
      ? "That account does not have administrator access."
      : undefined;

  return (
    <AuthShell
      eyebrow="Library staff"
      title="Administrator sign in"
      subtitle="Manage students, the book catalogue, circulation and library reports."
    >
      <AdminLoginForm initialError={initialError} />
    </AuthShell>
  );
}
