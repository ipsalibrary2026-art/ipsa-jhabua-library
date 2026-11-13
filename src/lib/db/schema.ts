import { relations, sql } from "drizzle-orm";
import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { user } from "./auth-schema";

export const studentStatusEnum = pgEnum("student_status", ["active", "inactive"]);
export const issueStatusEnum = pgEnum("issue_status", ["issued", "returned", "removed"]);
export const bookCopyStatusEnum = pgEnum("book_copy_status", ["available", "issued"]);

export const courses = pgTable("courses", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull().unique(),
  department: text("department").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const admins = pgTable("admins", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id")
    .notNull()
    .unique()
    .references(() => user.id, { onDelete: "cascade" }),
  fullName: text("full_name").notNull(),
  email: text("email").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const students = pgTable(
  "students",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    collegeCode: text("college_code").notNull().unique(),
    fullName: text("full_name").notNull(),
    fatherName: text("father_name").notNull(),
    email: text("email").notNull(),
    mobile: text("mobile").notNull(),
    courseId: uuid("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "restrict" }),
    semester: text("semester").notNull(),
    status: studentStatusEnum("status").notNull().default("active"),
    authUserId: text("auth_user_id")
      .notNull()
      .unique()
      .references(() => user.id, { onDelete: "cascade" }),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("students_course_idx").on(table.courseId),
    index("students_name_idx").on(table.fullName),
  ],
);

export const books = pgTable(
  "books",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    bookCode: text("book_code").notNull().unique(),
    title: text("title").notNull(),
    author: text("author").notNull(),
    publisher: text("publisher").notNull(),
    edition: text("edition").notNull(),
    category: text("category").notNull(),
    totalCopies: integer("total_copies").notNull().default(1),
    availableCopies: integer("available_copies").notNull().default(1),
    shelfNumber: text("shelf_number").notNull(),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("books_title_idx").on(table.title),
    index("books_category_idx").on(table.category),
  ],
);

export const bookCopies = pgTable(
  "book_copies",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    copyCode: text("copy_code").notNull().unique(),
    bookId: uuid("book_id")
      .notNull()
      .references(() => books.id, { onDelete: "cascade" }),
    shelfNumber: text("shelf_number").notNull(),
    status: bookCopyStatusEnum("status").notNull().default("available"),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("book_copies_book_idx").on(table.bookId),
    index("book_copies_status_idx").on(table.status),
  ],
);

export const issueRecords = pgTable(
  "issue_records",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    recordCode: text("record_code").notNull().unique(),
    studentId: uuid("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "restrict" }),
    bookId: uuid("book_id")
      .notNull()
      .references(() => books.id, { onDelete: "restrict" }),
    copyId: uuid("copy_id").references(() => bookCopies.id, { onDelete: "restrict" }),
    issueDate: date("issue_date", { mode: "string" }).notNull(),
    dueDate: date("due_date", { mode: "string" }).notNull(),
    returnDate: date("return_date", { mode: "string" }),
    status: issueStatusEnum("status").notNull().default("issued"),
    issuedBy: text("issued_by").references(() => user.id, { onDelete: "set null" }),
    returnedBy: text("returned_by").references(() => user.id, { onDelete: "set null" }),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("issue_records_student_idx").on(table.studentId),
    index("issue_records_book_idx").on(table.bookId),
    index("issue_records_copy_idx").on(table.copyId),
    index("issue_records_status_idx").on(table.status),
    uniqueIndex("issue_records_active_unique")
      .on(table.studentId, table.bookId)
      .where(sql`${table.status} = 'issued'`),
    uniqueIndex("issue_records_active_copy_unique")
      .on(table.copyId)
      .where(sql`${table.status} = 'issued' and ${table.copyId} is not null`),
  ],
);

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    actorUserId: text("actor_user_id").references(() => user.id, { onDelete: "set null" }),
    actorName: text("actor_name").notNull(),
    actorRole: text("actor_role").notNull().default("admin"),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id"),
    details: jsonb("details").$type<Record<string, unknown>>().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("audit_logs_created_idx").on(table.createdAt)],
);

export const courseRelations = relations(courses, ({ many }) => ({
  students: many(students),
}));

export const studentRelations = relations(students, ({ one, many }) => ({
  course: one(courses, {
    fields: [students.courseId],
    references: [courses.id],
  }),
  issueRecords: many(issueRecords),
}));

export const bookRelations = relations(books, ({ many }) => ({
  copies: many(bookCopies),
  issueRecords: many(issueRecords),
}));

export const bookCopyRelations = relations(bookCopies, ({ one, many }) => ({
  book: one(books, {
    fields: [bookCopies.bookId],
    references: [books.id],
  }),
  issueRecords: many(issueRecords),
}));

export const issueRecordRelations = relations(issueRecords, ({ one }) => ({
  student: one(students, {
    fields: [issueRecords.studentId],
    references: [students.id],
  }),
  book: one(books, {
    fields: [issueRecords.bookId],
    references: [books.id],
  }),
  copy: one(bookCopies, {
    fields: [issueRecords.copyId],
    references: [bookCopies.id],
  }),
}));

export const adminsRelations = relations(admins, ({ one }) => ({
  user: one(user, {
    fields: [admins.userId],
    references: [user.id],
  }),
}));

export type Course = typeof courses.$inferSelect;
export type Admin = typeof admins.$inferSelect;
export type Student = typeof students.$inferSelect;
export type Book = typeof books.$inferSelect;
export type BookCopy = typeof bookCopies.$inferSelect;
export type IssueRecord = typeof issueRecords.$inferSelect;
export type AuditLog = typeof auditLogs.$inferSelect;
