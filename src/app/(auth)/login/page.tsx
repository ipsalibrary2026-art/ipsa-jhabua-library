import { redirect } from "next/navigation";

import { AuthShell } from "@/components/auth/auth-shell";
import { StudentLoginForm } from "@/components/auth/student-login-form";
import { getSession } from "@/lib/session";

export const metadata = {
  title: "Student Login",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  const session = await getSession();
  if (session?.user.role === "admin") redirect("/admin");
  if (session?.user.role === "student") redirect("/dashboard");

  const initialError =
    params.error === "inactive"
      ? "Your account is deactivated. Please contact the library administrator."
      : undefined;

  return (
    <AuthShell
      eyebrow="Student portal"
      title="Welcome back"
      subtitle="Sign in with the college code and password issued by the IPSA College Library."
    >
      <StudentLoginForm initialError={initialError} />
    </AuthShell>
  );
}
