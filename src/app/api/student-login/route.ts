import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { students } from "@/lib/db/schema";
import { user } from "@/lib/db/auth-schema";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const collegeCode =
    typeof body === "object" && body !== null && "collegeCode" in body
      ? String((body as { collegeCode: unknown }).collegeCode).trim().toUpperCase()
      : "";

  if (!collegeCode) {
    return NextResponse.json({ error: "Enter your college code." }, { status: 400 });
  }

  const rows = await db
    .select({
      email: user.email,
      role: user.role,
      banned: user.banned,
      status: students.status,
      archivedAt: students.archivedAt,
    })
    .from(students)
    .innerJoin(user, eq(students.authUserId, user.id))
    .where(eq(students.collegeCode, collegeCode))
    .limit(1);

  const row = rows[0];
  if (!row || row.role !== "student" || row.banned) {
    return NextResponse.json(
      { error: "No active student account matches that college code." },
      { status: 404 },
    );
  }

  if (row.status !== "active" || row.archivedAt) {
    return NextResponse.json(
      { error: "This account is deactivated. Please contact the library administrator." },
      { status: 403 },
    );
  }

  return NextResponse.json({ email: row.email });
}
