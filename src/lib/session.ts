import "server-only";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";

import { auth } from "./db/auth";
import { db } from "./db";
import { admins, courses, students } from "./db/schema";

export type AuthSession = NonNullable<Awaited<ReturnType<typeof auth.api.getSession>>>;

export async function getSession() {
  return auth.api.getSession({ headers: await headers() });
}

export async function getStudentContext() {
  const session = await getSession();
  if (!session || session.user.role !== "student") return null;

  const rows = await db
    .select({ student: students, course: courses })
    .from(students)
    .innerJoin(courses, eq(students.courseId, courses.id))
    .where(eq(students.authUserId, session.user.id))
    .limit(1);

  const row = rows[0];
  if (!row) return null;
  return { session, student: row.student, course: row.course };
}

export async function getAdminContext() {
  const session = await getSession();
  if (!session || session.user.role !== "admin") return null;

  const adminRows = await db
    .select()
    .from(admins)
    .where(eq(admins.userId, session.user.id))
    .limit(1);

  return {
    session,
    admin: adminRows[0] ?? {
      id: session.user.id,
      userId: session.user.id,
      fullName: session.user.name,
      email: session.user.email,
      createdAt: new Date(),
    },
  };
}

export async function requireStudent() {
  const session = await getSession();
  if (!session) redirect("/login");

  if (session.user.role === "admin") redirect("/admin");

  const context = await getStudentContext();
  if (!context || context.student.status !== "active" || context.student.archivedAt) {
    redirect("/login?error=inactive");
  }

  return context;
}

export async function requireAdmin() {
  const session = await getSession();
  if (!session) redirect("/admin/login");
  if (session.user.role !== "admin") redirect("/dashboard");

  const context = await getAdminContext();
  if (!context) redirect("/admin/login?error=unauthorized");
  return context;
}

export async function assertAdmin() {
  const context = await getAdminContext();
  if (!context) {
    throw new Error("Your session has expired or you do not have administrator access.");
  }
  return context;
}

export async function assertStudent() {
  const context = await getStudentContext();
  if (!context || context.student.status !== "active" || context.student.archivedAt) {
    throw new Error("Your student account is not active. Please contact the library administrator.");
  }
  return context;
}
