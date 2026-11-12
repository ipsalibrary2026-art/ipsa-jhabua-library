"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { and, eq, gt, sql } from "drizzle-orm";
import { z } from "zod";

import type { ActionResult, BookInput, IssueInput, StudentInput } from "@/lib/action-types";
import { writeAuditLog } from "@/lib/audit";
import { todayISO } from "@/lib/dates";
import { auth } from "@/lib/db/auth";
import { db } from "@/lib/db";
import { session as authSession, user } from "@/lib/db/auth-schema";
import {
  admins,
  books,
  courses,
  issueRecords,
  students,
} from "@/lib/db/schema";
import { assertAdmin } from "@/lib/session";

const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a valid date.");

const studentSchema = z.object({
  collegeCode: z
    .string()
    .trim()
    .min(3, "College code must be at least 3 characters.")
    .max(30, "College code is too long.")
    .regex(/^[A-Za-z0-9-]+$/, "Use letters, numbers and hyphens only."),
  fullName: z.string().trim().min(2, "Enter the student's full name.").max(120),
  fatherName: z.string().trim().min(2, "Enter the father's name.").max(120),
  email: z.string().trim().email("Enter a valid email address.").max(160),
  mobile: z
    .string()
    .trim()
    .regex(/^[0-9+\-\s]{7,16}$/, "Enter a valid mobile number."),
  courseId: z.string().uuid("Select a course."),
  semester: z.string().trim().min(1, "Select a semester.").max(40),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters.")
    .max(72, "Password is too long.")
    .optional(),
  status: z.enum(["active", "inactive"]),
});

const bookSchema = z.object({
  bookCode: z
    .string()
    .trim()
    .min(2, "Book ID is required.")
    .max(30)
    .regex(/^[A-Za-z0-9-]+$/, "Use letters, numbers and hyphens only."),
  title: z.string().trim().min(2, "Enter the book name.").max(200),
  author: z.string().trim().min(2, "Enter the author name.").max(160),
  publisher: z.string().trim().min(2, "Enter the publisher.").max(160),
  edition: z.string().trim().min(1, "Enter the edition.").max(40),
  category: z.string().trim().min(1, "Enter a category.").max(80),
  totalCopies: z.coerce.number().int().min(1, "Add at least one copy.").max(999),
  shelfNumber: z.string().trim().min(1, "Enter the shelf or rack number.").max(40),
});

const issueSchema = z.object({
  collegeCode: z.string().trim().min(1, "Enter the student's college code.").max(30),
  bookId: z.string().uuid("Select a book."),
  issueDate: dateSchema,
  dueDate: dateSchema,
  notes: z.string().trim().max(500).optional(),
});

function fail(error: string): ActionResult {
  return { ok: false, error };
}

function firstError(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Check the details and try again.";
}

function revalidateLibrary() {
  for (const path of [
    "/admin",
    "/admin/students",
    "/admin/books",
    "/admin/issues",
    "/admin/issues/new",
    "/admin/issues/return",
    "/admin/reports",
    "/admin/audit",
    "/dashboard",
    "/dashboard/books",
    "/dashboard/profile",
  ]) {
    revalidatePath(path);
  }
}

async function resetPasswordFor(userId: string, password: string) {
  await auth.api.setUserPassword({
    body: { userId, newPassword: password },
    headers: await headers(),
  });
}

export async function createStudent(input: StudentInput): Promise<ActionResult> {
  try {
    const { admin } = await assertAdmin();
    const parsed = studentSchema.safeParse(input);
    if (!parsed.success) return fail(firstError(parsed.error));
    const data = parsed.data;
    const collegeCode = data.collegeCode.toUpperCase();
    const password = data.password || "Student@123";

    const course = await db
      .select()
      .from(courses)
      .where(eq(courses.id, data.courseId))
      .limit(1);
    if (!course[0]) return fail("Select a valid course.");

    const existing = await db
      .select({ id: students.id })
      .from(students)
      .where(eq(students.collegeCode, collegeCode))
      .limit(1);
    if (existing[0]) return fail("That college code is already in use.");

    const loginEmail = `${collegeCode.toLowerCase()}@students.ipsa.local`;
    let authUserId: string;
    try {
      const created = await auth.api.signUpEmail({
        body: { email: loginEmail, password, name: data.fullName },
      });
      authUserId = created.user.id;
    } catch {
      return fail("Could not create the login account. The college code may already be registered.");
    }

    try {
      await db
        .update(user)
        .set({ role: "student", name: data.fullName, emailVerified: true, banned: false })
        .where(eq(user.id, authUserId));

      const inserted = await db
        .insert(students)
        .values({
          collegeCode,
          fullName: data.fullName,
          fatherName: data.fatherName,
          email: data.email,
          mobile: data.mobile,
          courseId: data.courseId,
          semester: data.semester,
          status: data.status,
          authUserId,
        })
        .returning({ id: students.id });

      if (data.status === "inactive") {
        await db.update(user).set({ banned: true }).where(eq(user.id, authUserId));
        await db.delete(authSession).where(eq(authSession.userId, authUserId));
      }

      await writeAuditLog({
        actorUserId: admin.userId,
        actorName: admin.fullName,
        action: "student.create",
        entityType: "student",
        entityId: inserted[0]?.id,
        details: { collegeCode, fullName: data.fullName, course: course[0].name },
      });

      revalidateLibrary();
      return {
        ok: true,
        message: `${data.fullName} was added. Login code: ${collegeCode}`,
        id: inserted[0]?.id,
      };
    } catch (error) {
      await db.delete(user).where(eq(user.id, authUserId));
      throw error;
    }
  } catch (error) {
    return fail(
      error instanceof Error ? error.message : "Could not add the student. Please try again.",
    );
  }
}

export async function updateStudent(id: string, input: StudentInput): Promise<ActionResult> {
  try {
    const { admin } = await assertAdmin();
    const parsed = studentSchema.safeParse(input);
    if (!parsed.success) return fail(firstError(parsed.error));
    const data = parsed.data;
    const collegeCode = data.collegeCode.toUpperCase();

    const existing = await db.select().from(students).where(eq(students.id, id)).limit(1);
    const student = existing[0];
    if (!student) return fail("Student not found.");

    const course = await db
      .select()
      .from(courses)
      .where(eq(courses.id, data.courseId))
      .limit(1);
    if (!course[0]) return fail("Select a valid course.");

    if (collegeCode !== student.collegeCode) {
      const duplicate = await db
        .select({ id: students.id })
        .from(students)
        .where(eq(students.collegeCode, collegeCode))
        .limit(1);
      if (duplicate[0] && duplicate[0].id !== id) {
        return fail("That college code is already assigned to another student.");
      }
    }

    if (data.password) {
      await resetPasswordFor(student.authUserId, data.password);
    }

    const loginEmail = `${collegeCode.toLowerCase()}@students.ipsa.local`;

    await db.transaction(async (tx) => {
      await tx
        .update(user)
        .set({
          name: data.fullName,
          email: loginEmail,
          banned: data.status === "inactive",
        })
        .where(eq(user.id, student.authUserId));

      await tx
        .update(students)
        .set({
          collegeCode,
          fullName: data.fullName,
          fatherName: data.fatherName,
          email: data.email,
          mobile: data.mobile,
          courseId: data.courseId,
          semester: data.semester,
          status: data.status,
          archivedAt: data.status === "active" ? null : student.archivedAt,
          updatedAt: new Date(),
        })
        .where(eq(students.id, id));

      if (data.status === "inactive") {
        await tx.delete(authSession).where(eq(authSession.userId, student.authUserId));
      }
    });

    await writeAuditLog({
      actorUserId: admin.userId,
      actorName: admin.fullName,
      action: "student.update",
      entityType: "student",
      entityId: id,
      details: {
        before: {
          collegeCode: student.collegeCode,
          fullName: student.fullName,
          status: student.status,
        },
        after: {
          collegeCode,
          fullName: data.fullName,
          status: data.status,
        },
        passwordChanged: Boolean(data.password),
      },
    });

    revalidateLibrary();
    revalidatePath(`/admin/students/${id}`);
    return { ok: true, message: "Student details updated." };
  } catch (error) {
    return fail(
      error instanceof Error ? error.message : "Could not update the student. Please try again.",
    );
  }
}

export async function archiveStudent(id: string): Promise<ActionResult> {
  try {
    const { admin } = await assertAdmin();
    const existing = await db.select().from(students).where(eq(students.id, id)).limit(1);
    const student = existing[0];
    if (!student) return fail("Student not found.");

    await db.transaction(async (tx) => {
      await tx
        .update(students)
        .set({ status: "inactive", archivedAt: new Date(), updatedAt: new Date() })
        .where(eq(students.id, id));
      await tx.update(user).set({ banned: true }).where(eq(user.id, student.authUserId));
      await tx.delete(authSession).where(eq(authSession.userId, student.authUserId));
    });

    await writeAuditLog({
      actorUserId: admin.userId,
      actorName: admin.fullName,
      action: "student.archive",
      entityType: "student",
      entityId: id,
      details: { collegeCode: student.collegeCode, fullName: student.fullName },
    });

    revalidateLibrary();
    return {
      ok: true,
      message: `${student.fullName} was deleted from the active student list. Their issue history is preserved.`,
    };
  } catch (error) {
    return fail(
      error instanceof Error ? error.message : "Could not delete the student. Please try again.",
    );
  }
}

export async function setStudentStatus(
  id: string,
  status: "active" | "inactive",
): Promise<ActionResult> {
  try {
    const { admin } = await assertAdmin();
    const existing = await db.select().from(students).where(eq(students.id, id)).limit(1);
    const student = existing[0];
    if (!student) return fail("Student not found.");

    await db.transaction(async (tx) => {
      await tx
        .update(students)
        .set({
          status,
          archivedAt: status === "active" ? null : student.archivedAt,
          updatedAt: new Date(),
        })
        .where(eq(students.id, id));
      await tx
        .update(user)
        .set({ banned: status === "inactive" })
        .where(eq(user.id, student.authUserId));
      if (status === "inactive") {
        await tx.delete(authSession).where(eq(authSession.userId, student.authUserId));
      }
    });

    await writeAuditLog({
      actorUserId: admin.userId,
      actorName: admin.fullName,
      action: status === "active" ? "student.activate" : "student.deactivate",
      entityType: "student",
      entityId: id,
      details: { collegeCode: student.collegeCode },
    });

    revalidateLibrary();
    return {
      ok: true,
      message: status === "active" ? "Student account activated." : "Student account deactivated.",
    };
  } catch (error) {
    return fail(
      error instanceof Error ? error.message : "Could not update the account. Please try again.",
    );
  }
}

export async function changeStudentPassword(
  id: string,
  newPassword: string,
): Promise<ActionResult> {
  try {
    const { admin } = await assertAdmin();
    const parsed = z
      .string()
      .min(8, "Password must be at least 8 characters.")
      .max(72, "Password is too long.")
      .safeParse(newPassword);
    if (!parsed.success) return fail(firstError(parsed.error));

    const existing = await db.select().from(students).where(eq(students.id, id)).limit(1);
    const student = existing[0];
    if (!student) return fail("Student not found.");

    await resetPasswordFor(student.authUserId, parsed.data);
    await writeAuditLog({
      actorUserId: admin.userId,
      actorName: admin.fullName,
      action: "student.password_reset",
      entityType: "student",
      entityId: id,
      details: { collegeCode: student.collegeCode },
    });

    return { ok: true, message: `Password updated for ${student.collegeCode}.` };
  } catch (error) {
    return fail(
      error instanceof Error
        ? error.message
        : "Could not change the password. Please try again.",
    );
  }
}

export async function createCourse(name: string, department: string): Promise<ActionResult> {
  try {
    const { admin } = await assertAdmin();
    const parsed = z
      .object({
        name: z.string().trim().min(2, "Enter a course name.").max(120),
        department: z.string().trim().min(2, "Enter a department.").max(120),
      })
      .safeParse({ name, department });
    if (!parsed.success) return fail(firstError(parsed.error));

    const existing = await db
      .select({ id: courses.id })
      .from(courses)
      .where(eq(courses.name, parsed.data.name))
      .limit(1);
    if (existing[0]) return fail("A course with that name already exists.");

    const inserted = await db
      .insert(courses)
      .values({ name: parsed.data.name, department: parsed.data.department })
      .returning({ id: courses.id });

    await writeAuditLog({
      actorUserId: admin.userId,
      actorName: admin.fullName,
      action: "course.create",
      entityType: "course",
      entityId: inserted[0]?.id,
      details: parsed.data,
    });

    revalidatePath("/admin/settings");
    revalidatePath("/admin/students");
    return { ok: true, message: `${parsed.data.name} added to the course list.` };
  } catch (error) {
    return fail(
      error instanceof Error ? error.message : "Could not add the course. Please try again.",
    );
  }
}

export async function setCourseActive(id: string, isActive: boolean): Promise<ActionResult> {
  try {
    const { admin } = await assertAdmin();
    const existing = await db.select().from(courses).where(eq(courses.id, id)).limit(1);
    if (!existing[0]) return fail("Course not found.");

    await db.update(courses).set({ isActive }).where(eq(courses.id, id));
    await writeAuditLog({
      actorUserId: admin.userId,
      actorName: admin.fullName,
      action: isActive ? "course.activate" : "course.deactivate",
      entityType: "course",
      entityId: id,
      details: { name: existing[0].name },
    });

    revalidatePath("/admin/settings");
    return {
      ok: true,
      message: isActive ? "Course enabled for new students." : "Course disabled for new students.",
    };
  } catch (error) {
    return fail(
      error instanceof Error ? error.message : "Could not update the course. Please try again.",
    );
  }
}

export async function updateAdminName(fullName: string): Promise<ActionResult> {
  try {
    const { admin } = await assertAdmin();
    const parsed = z.string().trim().min(2, "Enter your name.").max(120).safeParse(fullName);
    if (!parsed.success) return fail(firstError(parsed.error));

    await db.transaction(async (tx) => {
      await tx.update(user).set({ name: parsed.data }).where(eq(user.id, admin.userId));
      await tx.update(admins).set({ fullName: parsed.data }).where(eq(admins.userId, admin.userId));
    });

    await writeAuditLog({
      actorUserId: admin.userId,
      actorName: parsed.data,
      action: "admin.profile_update",
      entityType: "admin",
      entityId: admin.id,
      details: { fullName: parsed.data },
    });

    revalidatePath("/admin");
    revalidatePath("/admin/settings");
    return { ok: true, message: "Your name has been updated." };
  } catch (error) {
    return fail(
      error instanceof Error ? error.message : "Could not update your profile. Please try again.",
    );
  }
}

export async function createBook(input: BookInput): Promise<ActionResult> {
  try {
    const { admin } = await assertAdmin();
    const parsed = bookSchema.safeParse(input);
    if (!parsed.success) return fail(firstError(parsed.error));
    const data = parsed.data;
    const bookCode = data.bookCode.toUpperCase();

    const existing = await db
      .select({ id: books.id })
      .from(books)
      .where(eq(books.bookCode, bookCode))
      .limit(1);
    if (existing[0]) return fail("That Book ID is already in use.");

    const inserted = await db
      .insert(books)
      .values({
        ...data,
        bookCode,
        availableCopies: data.totalCopies,
      })
      .returning({ id: books.id });

    await writeAuditLog({
      actorUserId: admin.userId,
      actorName: admin.fullName,
      action: "book.create",
      entityType: "book",
      entityId: inserted[0]?.id,
      details: { bookCode, title: data.title, totalCopies: data.totalCopies },
    });

    revalidateLibrary();
    return { ok: true, message: `"${data.title}" added to the catalogue.` };
  } catch (error) {
    return fail(
      error instanceof Error ? error.message : "Could not add the book. Please try again.",
    );
  }
}

export async function updateBook(id: string, input: BookInput): Promise<ActionResult> {
  try {
    const { admin } = await assertAdmin();
    const parsed = bookSchema.safeParse(input);
    if (!parsed.success) return fail(firstError(parsed.error));
    const data = parsed.data;
    const bookCode = data.bookCode.toUpperCase();

    const existing = await db.select().from(books).where(eq(books.id, id)).limit(1);
    const book = existing[0];
    if (!book) return fail("Book not found.");

    if (bookCode !== book.bookCode) {
      const duplicate = await db
        .select({ id: books.id })
        .from(books)
        .where(eq(books.bookCode, bookCode))
        .limit(1);
      if (duplicate[0] && duplicate[0].id !== id) return fail("That Book ID is already in use.");
    }

    const issuedCopies = book.totalCopies - book.availableCopies;
    if (data.totalCopies < issuedCopies) {
      return fail(
        `${issuedCopies} ${issuedCopies === 1 ? "copy is" : "copies are"} currently issued. Total copies cannot be lower than that.`,
      );
    }

    await db
      .update(books)
      .set({
        ...data,
        bookCode,
        availableCopies: data.totalCopies - issuedCopies,
        updatedAt: new Date(),
      })
      .where(eq(books.id, id));

    await writeAuditLog({
      actorUserId: admin.userId,
      actorName: admin.fullName,
      action: "book.update",
      entityType: "book",
      entityId: id,
      details: {
        before: { bookCode: book.bookCode, title: book.title, totalCopies: book.totalCopies },
        after: { bookCode, title: data.title, totalCopies: data.totalCopies },
      },
    });

    revalidateLibrary();
    return { ok: true, message: "Book details updated." };
  } catch (error) {
    return fail(
      error instanceof Error ? error.message : "Could not update the book. Please try again.",
    );
  }
}

export async function deleteBook(id: string): Promise<ActionResult> {
  try {
    const { admin } = await assertAdmin();
    const existing = await db.select().from(books).where(eq(books.id, id)).limit(1);
    const book = existing[0];
    if (!book) return fail("Book not found.");

    const history = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(issueRecords)
      .where(eq(issueRecords.bookId, id));

    if ((history[0]?.count ?? 0) > 0) {
      await db
        .update(books)
        .set({ archivedAt: new Date(), updatedAt: new Date() })
        .where(eq(books.id, id));
    } else {
      await db.delete(books).where(eq(books.id, id));
    }

    await writeAuditLog({
      actorUserId: admin.userId,
      actorName: admin.fullName,
      action: "book.delete",
      entityType: "book",
      entityId: id,
      details: {
        bookCode: book.bookCode,
        title: book.title,
        preservedHistory: (history[0]?.count ?? 0) > 0,
      },
    });

    revalidateLibrary();
    return { ok: true, message: `"${book.title}" removed from the catalogue.` };
  } catch (error) {
    return fail(
      error instanceof Error ? error.message : "Could not delete the book. Please try again.",
    );
  }
}

export async function issueBook(input: IssueInput): Promise<ActionResult> {
  try {
    const { admin } = await assertAdmin();
    const parsed = issueSchema.safeParse(input);
    if (!parsed.success) return fail(firstError(parsed.error));
    const data = parsed.data;
    if (data.dueDate < data.issueDate) return fail("The due date must be on or after the issue date.");

    const result = await db.transaction(async (tx) => {
      const collegeCode = data.collegeCode.toUpperCase();
      const studentRows = await tx
        .select()
        .from(students)
        .where(eq(students.collegeCode, collegeCode))
        .limit(1);
      const student = studentRows[0];
      if (!student || student.archivedAt || student.status !== "active") {
        throw new Error("No active student was found with that college code.");
      }

      const bookRows = await tx.select().from(books).where(eq(books.id, data.bookId)).limit(1);
      const book = bookRows[0];
      if (!book || book.archivedAt) throw new Error("That book is no longer in the catalogue.");
      if (book.availableCopies < 1) throw new Error("No copies of this book are available.");

      const duplicate = await tx
        .select({ id: issueRecords.id })
        .from(issueRecords)
        .where(
          and(
            eq(issueRecords.studentId, student.id),
            eq(issueRecords.bookId, data.bookId),
            eq(issueRecords.status, "issued"),
          ),
        )
        .limit(1);
      if (duplicate[0]) {
        throw new Error("This student already has an active issue record for this book.");
      }

      const updated = await tx
        .update(books)
        .set({ availableCopies: sql`${books.availableCopies} - 1`, updatedAt: new Date() })
        .where(and(eq(books.id, data.bookId), gt(books.availableCopies, 0)))
        .returning({ availableCopies: books.availableCopies });
      if (!updated[0]) throw new Error("No copies of this book are available.");

      const recordCode = `REC-${new Date().getFullYear()}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;
      const inserted = await tx
        .insert(issueRecords)
        .values({
          recordCode,
          studentId: student.id,
          bookId: book.id,
          issueDate: data.issueDate,
          dueDate: data.dueDate,
          status: "issued",
          issuedBy: admin.userId,
          notes: data.notes || null,
        })
        .returning({ id: issueRecords.id, recordCode: issueRecords.recordCode });

      return {
        record: inserted[0],
        studentName: student.fullName,
        collegeCode: student.collegeCode,
        bookTitle: book.title,
      };
    });

    await writeAuditLog({
      actorUserId: admin.userId,
      actorName: admin.fullName,
      action: "issue.create",
      entityType: "issue_record",
      entityId: result.record?.id,
      details: {
        recordCode: result.record?.recordCode,
        collegeCode: result.collegeCode,
        student: result.studentName,
        book: result.bookTitle,
        issueDate: data.issueDate,
        dueDate: data.dueDate,
      },
    });

    revalidateLibrary();
    return {
      ok: true,
      message: `"${result.bookTitle}" issued to ${result.studentName} (${result.collegeCode}).`,
      id: result.record?.id,
    };
  } catch (error) {
    return fail(
      error instanceof Error ? error.message : "Could not issue the book. Please try again.",
    );
  }
}

export async function markReturned(recordId: string, returnDate?: string): Promise<ActionResult> {
  try {
    const { admin } = await assertAdmin();
    const parsedDate = returnDate ? dateSchema.safeParse(returnDate) : null;
    if (parsedDate && !parsedDate.success) return fail("Choose a valid return date.");
    const finalReturnDate = parsedDate?.success ? parsedDate.data : todayISO();

    const result = await db.transaction(async (tx) => {
      const rows = await tx.select().from(issueRecords).where(eq(issueRecords.id, recordId)).limit(1);
      const record = rows[0];
      if (!record) throw new Error("Issue record not found.");
      if (record.status !== "issued") throw new Error("This record is not currently issued.");
      if (finalReturnDate < record.issueDate) {
        throw new Error("The return date cannot be before the issue date.");
      }

      await tx
        .update(issueRecords)
        .set({
          status: "returned",
          returnDate: finalReturnDate,
          returnedBy: admin.userId,
          updatedAt: new Date(),
        })
        .where(eq(issueRecords.id, recordId));

      await tx
        .update(books)
        .set({
          availableCopies: sql`least(${books.availableCopies} + 1, ${books.totalCopies})`,
          updatedAt: new Date(),
        })
        .where(eq(books.id, record.bookId));

      return { record };
    });

    await writeAuditLog({
      actorUserId: admin.userId,
      actorName: admin.fullName,
      action: "issue.return",
      entityType: "issue_record",
      entityId: recordId,
      details: {
        recordCode: result.record.recordCode,
        returnDate: finalReturnDate,
        previousDueDate: result.record.dueDate,
      },
    });

    revalidateLibrary();
    return {
      ok: true,
      message: `Book marked as returned on ${finalReturnDate}.`,
    };
  } catch (error) {
    return fail(
      error instanceof Error ? error.message : "Could not return the book. Please try again.",
    );
  }
}

export async function updateIssueDates(
  recordId: string,
  issueDate: string,
  dueDate: string,
): Promise<ActionResult> {
  try {
    const { admin } = await assertAdmin();
    const parsed = z
      .object({ issueDate: dateSchema, dueDate: dateSchema })
      .safeParse({ issueDate, dueDate });
    if (!parsed.success) return fail(firstError(parsed.error));
    if (parsed.data.dueDate < parsed.data.issueDate) {
      return fail("The due date must be on or after the issue date.");
    }

    const existing = await db
      .select()
      .from(issueRecords)
      .where(eq(issueRecords.id, recordId))
      .limit(1);
    const record = existing[0];
    if (!record) return fail("Issue record not found.");

    await db
      .update(issueRecords)
      .set({ issueDate: parsed.data.issueDate, dueDate: parsed.data.dueDate, updatedAt: new Date() })
      .where(eq(issueRecords.id, recordId));

    await writeAuditLog({
      actorUserId: admin.userId,
      actorName: admin.fullName,
      action: "issue.dates_update",
      entityType: "issue_record",
      entityId: recordId,
      details: {
        recordCode: record.recordCode,
        before: { issueDate: record.issueDate, dueDate: record.dueDate },
        after: parsed.data,
      },
    });

    revalidateLibrary();
    return { ok: true, message: "Issue and due dates updated." };
  } catch (error) {
    return fail(
      error instanceof Error ? error.message : "Could not update the dates. Please try again.",
    );
  }
}

export async function removeIssueRecord(recordId: string, reason: string): Promise<ActionResult> {
  try {
    const { admin } = await assertAdmin();
    const parsedReason = z
      .string()
      .trim()
      .min(3, "Give a short reason for removing the record.")
      .max(300)
      .safeParse(reason);
    if (!parsedReason.success) return fail(firstError(parsedReason.error));

    const result = await db.transaction(async (tx) => {
      const rows = await tx.select().from(issueRecords).where(eq(issueRecords.id, recordId)).limit(1);
      const record = rows[0];
      if (!record) throw new Error("Issue record not found.");
      if (record.status === "removed") throw new Error("This record has already been removed.");

      await tx
        .update(issueRecords)
        .set({
          status: "removed",
          returnedBy: admin.userId,
          updatedAt: new Date(),
          notes: record.notes
            ? `${record.notes} · Removed by librarian: ${parsedReason.data}`
            : `Removed by librarian: ${parsedReason.data}`,
        })
        .where(eq(issueRecords.id, recordId));

      if (record.status === "issued") {
        await tx
          .update(books)
          .set({
            availableCopies: sql`least(${books.availableCopies} + 1, ${books.totalCopies})`,
            updatedAt: new Date(),
          })
          .where(eq(books.id, record.bookId));
      }

      return { record };
    });

    await writeAuditLog({
      actorUserId: admin.userId,
      actorName: admin.fullName,
      action: "issue.remove",
      entityType: "issue_record",
      entityId: recordId,
      details: {
        recordCode: result.record.recordCode,
        previousStatus: result.record.status,
        reason: parsedReason.data,
      },
    });

    revalidateLibrary();
    return { ok: true, message: "Record removed from circulation. History was preserved." };
  } catch (error) {
    return fail(
      error instanceof Error ? error.message : "Could not remove the record. Please try again.",
    );
  }
}

export async function restoreArchivedBook(id: string): Promise<ActionResult> {
  try {
    const { admin } = await assertAdmin();
    const existing = await db.select().from(books).where(eq(books.id, id)).limit(1);
    const book = existing[0];
    if (!book) return fail("Book not found.");

    await db.update(books).set({ archivedAt: null, updatedAt: new Date() }).where(eq(books.id, id));
    await writeAuditLog({
      actorUserId: admin.userId,
      actorName: admin.fullName,
      action: "book.restore",
      entityType: "book",
      entityId: id,
      details: { bookCode: book.bookCode, title: book.title },
    });

    revalidateLibrary();
    return { ok: true, message: "Book restored to the active catalogue." };
  } catch (error) {
    return fail(
      error instanceof Error ? error.message : "Could not restore the book. Please try again.",
    );
  }
}
