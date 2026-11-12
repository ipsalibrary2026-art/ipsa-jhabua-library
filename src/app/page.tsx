import { redirect } from "next/navigation";

import { getSession } from "@/lib/session";

export default async function HomePage() {
  const session = await getSession();
  if (session?.user.role === "admin") redirect("/admin");
  if (session?.user.role === "student") redirect("/dashboard");
  redirect("/login");
}
