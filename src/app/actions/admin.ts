"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { and, asc, eq, gt, isNull, sql } from "drizzle-orm";
import { z } from "zod";

import type {
  ActionResult,
  BookInput,
  IssueInput,
  NewBookIssueInput,
  StudentInput,
} from "@/lib/action-types";
import { writeAuditLog } from "@/lib/audit";
import { todayISO } from "@/lib/dates";
import { auth } from "@/lib/db/auth";
import { db } from "@/lib/db";
import { session as authSession, user } from "@/lib/db/auth-schema";
import {
  admins,
  bookCopies,
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
  shelfNumber: z.string().trim().min(1, "Enter the shelf or rack number.").max(40),
});

const issueSchema = z.object({
  collegeCode: z.string().trim().min(1, "Enter the student's college code.").max(30),
  copyId: z.string().uuid("Select an available book copy."),
  issueDate: dateSchema,
  dueDate: dateSchema,
  notes: z.string().trim().max(500).optional(),
});

const newBookIssueSchema = bookSchema.extend({
  collegeCode: z.string().trim().min(1, "Enter the student's college code.").max(30),
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

    const result = await db.transaction(async (tx) => {
      const duplicate = await tx
        .select({ id: bookCopies.id })
        .from(bookCopies)
        .where(eq(bookCopies.copyCode, bookCode))
        .limit(1);
      if (duplicate[0]) throw new Error("That Book ID is already in use.");

      const matching = await tx
        .select()
        .from(books)
        .where(
          and(
            isNull(books.archivedAt),
            sql`lower(${books.title}) = lower(${data.title})`,
            sql`lower(${books.author}) = lower(${data.author})`,
            sql`lower(${books.edition}) = lower(${data.edition})`,
          ),
        )
        .limit(1);

      let bookId: string;
      let title: string;
      let reusedCatalogue = false;

      if (matching[0]) {
        reusedCatalogue = true;
        bookId = matching[0].id;
        title = matching[0].title;
        await tx
          .update(books)
          .set({
            totalCopies: sql`${books.totalCopies} + 1`,
            availableCopies: sql`${books.availableCopies} + 1`,
            updatedAt: new Date(),
          })
          .where(eq(books.id, bookId));
      } else {
        const inserted = await tx
          .insert(books)
          .values({
            bookCode,
            title: data.title,
            author: data.author,
            publisher: data.publisher,
            edition: data.edition,
            category: data.category,
            totalCopies: 1,
            availableCopies: 1,
            shelfNumber: data.shelfNumber,
          })
          .returning({ id: books.id, title: books.title });
        bookId = inserted[0].id;
        title = inserted[0].title;
      }

      await tx.insert(bookCopies).values({
        copyCode: bookCode,
        bookId,
        shelfNumber: data.shelfNumber,
        status: "available",
      });

      return { bookId, title, reusedCatalogue };
    });

    await writeAuditLog({
      actorUserId: admin.userId,
      actorName: admin.fullName,
      action: "book.create",
      entityType: "book",
      entityId: result.bookId,
      details: {
        bookCode,
        title: result.title,
        reusedCatalogue: result.reusedCatalogue,
      },
    });

    revalidateLibrary();
    return {
      ok: true,
      message: result.reusedCatalogue
        ? `Copy ${bookCode} registered under "${result.title}".`
        : `"${result.title}" added to the catalogue.`,
      id: result.bookId,
    };
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

    const copyRows = await db
      .select()
      .from(bookCopies)
      .where(eq(bookCopies.bookId, id))
      .orderBy(asc(bookCopies.createdAt));
    const primary = copyRows.find((copy) => copy.copyCode === book.bookCode) ?? copyRows[0];

    if (bookCode !== book.bookCode || primary) {
      const duplicate = await db
        .select({ id: bookCopies.id })
        .from(bookCopies)
        .where(eq(bookCopies.copyCode, bookCode))
        .limit(1);
      if (duplicate[0] && duplicate[0].id !== primary?.id) {
        return fail("That Book ID is already in use.");
      }
    }

    await db.transaction(async (tx) => {
      await tx
        .update(books)
        .set({
          bookCode,
          title: data.title,
          author: data.author,
          publisher: data.publisher,
          edition: data.edition,
          category: data.category,
          shelfNumber: data.shelfNumber,
          updatedAt: new Date(),
        })
        .where(eq(books.id, id));

      if (primary) {
        await tx
          .update(bookCopies)
          .set({
            copyCode: bookCode,
            shelfNumber: data.shelfNumber,
            updatedAt: new Date(),
          })
          .where(eq(bookCopies.id, primary.id));
      }
    });

    await writeAuditLog({
      actorUserId: admin.userId,
      actorName: admin.fullName,
      action: "book.update",
      entityType: "book",
      entityId: id,
      details: {
        before: { bookCode: book.bookCode, title: book.title },
        after: { bookCode, title: data.title },
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
      await db.transaction(async (tx) => {
        await tx
          .update(books)
          .set({ archivedAt: new Date(), updatedAt: new Date() })
          .where(eq(books.id, id));
        await tx
          .update(bookCopies)
          .set({ archivedAt: new Date(), updatedAt: new Date() })
          .where(eq(bookCopies.bookId, id));
      });
    } else {
      await db.transaction(async (tx) => {
        await tx.delete(bookCopies).where(eq(bookCopies.bookId, id));
        await tx.delete(books).where(eq(books.id, id));
      });
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

function newRecordCode() {
  return `REC-${new Date().getFullYear()}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;
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

      const copyRows = await tx
        .select({ copy: bookCopies, book: books })
        .from(bookCopies)
        .innerJoin(books, eq(bookCopies.bookId, books.id))
        .where(eq(bookCopies.id, data.copyId))
        .limit(1);
      const copy = copyRows[0]?.copy;
      const book = copyRows[0]?.book;
      if (!copy || copy.archivedAt || !book || book.archivedAt) {
        throw new Error("That physical copy is no longer in the catalogue.");
      }
      if (copy.status !== "available") {
        throw new Error(`Book ID ${copy.copyCode} is already issued. Choose another copy.`);
      }

      const duplicate = await tx
        .select({ id: issueRecords.id })
        .from(issueRecords)
        .where(
          and(
            eq(issueRecords.studentId, student.id),
            eq(issueRecords.bookId, book.id),
            eq(issueRecords.status, "issued"),
          ),
        )
        .limit(1);
      if (duplicate[0]) {
        throw new Error("This student already has an active issue record for this book.");
      }

      const claimed = await tx
        .update(bookCopies)
        .set({ status: "issued", updatedAt: new Date() })
        .where(and(eq(bookCopies.id, copy.id), eq(bookCopies.status, "available")))
        .returning({ id: bookCopies.id });
      if (!claimed[0]) throw new Error("That physical copy was just issued. Choose another copy.");

      const updated = await tx
        .update(books)
        .set({ availableCopies: sql`${books.availableCopies} - 1`, updatedAt: new Date() })
        .where(and(eq(books.id, book.id), gt(books.availableCopies, 0)))
        .returning({ availableCopies: books.availableCopies });
      if (!updated[0]) throw new Error("No copies of this book are available.");

      const inserted = await tx
        .insert(issueRecords)
        .values({
          recordCode: newRecordCode(),
          studentId: student.id,
          bookId: book.id,
          copyId: copy.id,
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
        copyCode: copy.copyCode,
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
        copyCode: result.copyCode,
        issueDate: data.issueDate,
        dueDate: data.dueDate,
      },
    });

    revalidateLibrary();
    return {
      ok: true,
      message: `"${result.bookTitle}" (${result.copyCode}) issued to ${result.studentName} (${result.collegeCode}).`,
      id: result.record?.id,
    };
  } catch (error) {
    return fail(
      error instanceof Error ? error.message : "Could not issue the book. Please try again.",
    );
  }
}

export async function issueNewBook(input: NewBookIssueInput): Promise<ActionResult> {
  try {
    const { admin } = await assertAdmin();
    const parsed = newBookIssueSchema.safeParse(input);
    if (!parsed.success) return fail(firstError(parsed.error));
    const data = parsed.data;
    if (data.dueDate < data.issueDate) return fail("The due date must be on or after the issue date.");
    const bookCode = data.bookCode.toUpperCase();

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

      const duplicate = await tx
        .select({ id: bookCopies.id })
        .from(bookCopies)
        .where(eq(bookCopies.copyCode, bookCode))
        .limit(1);
      if (duplicate[0]) {
        throw new Error(`Book ID ${bookCode} already exists. Every physical copy needs a unique ID.`);
      }

      const matching = await tx
        .select()
        .from(books)
        .where(
          and(
            isNull(books.archivedAt),
            sql`lower(${books.title}) = lower(${data.title})`,
            sql`lower(${books.author}) = lower(${data.author})`,
            sql`lower(${books.edition}) = lower(${data.edition})`,
          ),
        )
        .limit(1);

      let bookId: string;
      let bookTitle: string;
      let catalogueReused = false;

      if (matching[0]) {
        catalogueReused = true;
        bookId = matching[0].id;
        bookTitle = matching[0].title;
        await tx
          .update(books)
          .set({ totalCopies: sql`${books.totalCopies} + 1`, updatedAt: new Date() })
          .where(eq(books.id, bookId));
      } else {
        const inserted = await tx
          .insert(books)
          .values({
            bookCode,
            title: data.title,
            author: data.author,
            publisher: data.publisher,
            edition: data.edition,
            category: data.category,
            totalCopies: 1,
            availableCopies: 0,
            shelfNumber: data.shelfNumber,
          })
          .returning({ id: books.id, title: books.title });
        bookId = inserted[0].id;
        bookTitle = inserted[0].title;
      }

      const copyInserted = await tx
        .insert(bookCopies)
        .values({
          copyCode: bookCode,
          bookId,
          shelfNumber: data.shelfNumber,
          status: "issued",
        })
        .returning({ id: bookCopies.id, copyCode: bookCopies.copyCode });

      const copy = copyInserted[0];
      if (!copy) throw new Error("Could not register the physical copy. Please try again.");

      const recordInserted = await tx
        .insert(issueRecords)
        .values({
          recordCode: newRecordCode(),
          studentId: student.id,
          bookId,
          copyId: copy.id,
          issueDate: data.issueDate,
          dueDate: data.dueDate,
          status: "issued",
          issuedBy: admin.userId,
          notes: data.notes || null,
        })
        .returning({ id: issueRecords.id, recordCode: issueRecords.recordCode });

      return {
        record: recordInserted[0],
        bookId,
        bookTitle,
        bookCode,
        catalogueReused,
        studentName: student.fullName,
        collegeCode: student.collegeCode,
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
        copyCode: result.bookCode,
        newBookRegisteredDuringIssue: true,
        catalogueReused: result.catalogueReused,
        issueDate: data.issueDate,
        dueDate: data.dueDate,
      },
    });

    if (!result.catalogueReused) {
      await writeAuditLog({
        actorUserId: admin.userId,
        actorName: admin.fullName,
        action: "book.create",
        entityType: "book",
        entityId: result.bookId,
        details: { bookCode: result.bookCode, title: result.bookTitle, source: "issue_desk" },
      });
    }

    revalidateLibrary();
    return {
      ok: true,
      message: `Book ID ${result.bookCode} registered and "${result.bookTitle}" issued to ${result.studentName} (${result.collegeCode}).`,
      id: result.record?.id,
    };
  } catch (error) {
    return fail(
      error instanceof Error ? error.message : "Could not add and issue the book. Please try again.",
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

      if (record.copyId) {
        await tx
          .update(bookCopies)
          .set({ status: "available", updatedAt: new Date() })
          .where(eq(bookCopies.id, record.copyId));
      }

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
        if (record.copyId) {
          await tx
            .update(bookCopies)
            .set({ status: "available", updatedAt: new Date() })
            .where(eq(bookCopies.id, record.copyId));
        }
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

    await db.transaction(async (tx) => {
      await tx.update(books).set({ archivedAt: null, updatedAt: new Date() }).where(eq(books.id, id));
      await tx
        .update(bookCopies)
        .set({ archivedAt: null, updatedAt: new Date() })
        .where(eq(bookCopies.bookId, id));
    });
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
