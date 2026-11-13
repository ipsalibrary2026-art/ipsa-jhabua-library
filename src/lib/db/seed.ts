import "dotenv/config";

import { and, asc, eq, sql } from "drizzle-orm";

import { auth } from "./auth";
import { db } from "./index";
import {
  admins,
  auditLogs,
  bookCopies,
  books,
  courses,
  issueRecords,
  students,
} from "./schema";
import { user } from "./auth-schema";

const STUDENT_PASSWORD = "Student@123";
const ADMIN_EMAIL = "admin@ipsa.edu";
const ADMIN_PASSWORD = "Admin@12345";

function dateOffset(days: number) {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

const courseSeed = [
  { name: "BBA", department: "Department of Management" },
  { name: "BCA", department: "Department of Computer Applications" },
  { name: "B.Sc. Biotechnology", department: "Department of Biotechnology" },
  { name: "B.Sc. Horticulture", department: "Department of Horticulture" },
];

const studentSeed = [
  {
    collegeCode: "IPSA2024001",
    fullName: "Aarav Sharma",
    fatherName: "Rajesh Sharma",
    course: "BCA",
    semester: "Semester 4",
    mobile: "9876543210",
    email: "aarav.sharma@example.com",
    status: "active" as const,
  },
  {
    collegeCode: "IPSA2024002",
    fullName: "Priya Verma",
    fatherName: "Suresh Verma",
    course: "BBA",
    semester: "Semester 2",
    mobile: "9876543211",
    email: "priya.verma@example.com",
    status: "active" as const,
  },
  {
    collegeCode: "IPSA2024003",
    fullName: "Rohan Gupta",
    fatherName: "Anil Gupta",
    course: "B.Sc. Biotechnology",
    semester: "Semester 6",
    mobile: "9876543212",
    email: "rohan.gupta@example.com",
    status: "active" as const,
  },
  {
    collegeCode: "IPSA2024004",
    fullName: "Ananya Singh",
    fatherName: "Mahendra Singh",
    course: "B.Sc. Horticulture",
    semester: "Semester 2",
    mobile: "9876543213",
    email: "ananya.singh@example.com",
    status: "active" as const,
  },
  {
    collegeCode: "IPSA2024005",
    fullName: "Kabir Mehta",
    fatherName: "Vikram Mehta",
    course: "BCA",
    semester: "Semester 6",
    mobile: "9876543214",
    email: "kabir.mehta@example.com",
    status: "active" as const,
  },
  {
    collegeCode: "IPSA2024006",
    fullName: "Meera Nair",
    fatherName: "Suresh Nair",
    course: "BBA",
    semester: "Semester 4",
    mobile: "9876543215",
    email: "meera.nair@example.com",
    status: "active" as const,
  },
];

const bookSeed = [
  {
    bookCode: "BK-001",
    title: "Business Organization and Management",
    author: "R.K. Sharma",
    publisher: "Himalaya Publishing House",
    edition: "2nd",
    category: "Management",
    totalCopies: 5,
    shelfNumber: "A-01",
  },
  {
    bookCode: "BK-002",
    title: "Principles of Marketing",
    author: "Philip Kotler",
    publisher: "Pearson Education",
    edition: "17th",
    category: "Management",
    totalCopies: 4,
    shelfNumber: "A-02",
  },
  {
    bookCode: "BK-003",
    title: "Programming in C",
    author: "E. Balagurusamy",
    publisher: "McGraw Hill",
    edition: "8th",
    category: "Computer Science",
    totalCopies: 6,
    shelfNumber: "B-01",
  },
  {
    bookCode: "BK-004",
    title: "Database System Concepts",
    author: "Abraham Silberschatz",
    publisher: "McGraw Hill",
    edition: "7th",
    category: "Computer Science",
    totalCopies: 4,
    shelfNumber: "B-02",
  },
  {
    bookCode: "BK-005",
    title: "Java: The Complete Reference",
    author: "Herbert Schildt",
    publisher: "McGraw Hill",
    edition: "12th",
    category: "Computer Science",
    totalCopies: 3,
    shelfNumber: "B-03",
  },
  {
    bookCode: "BK-006",
    title: "Molecular Biology of the Cell",
    author: "Bruce Alberts",
    publisher: "Garland Science",
    edition: "6th",
    category: "Biotechnology",
    totalCopies: 3,
    shelfNumber: "C-01",
  },
  {
    bookCode: "BK-007",
    title: "Hartmann & Kester's Plant Propagation",
    author: "Fred T. Davies",
    publisher: "Pearson Education",
    edition: "9th",
    category: "Horticulture",
    totalCopies: 2,
    shelfNumber: "D-01",
  },
  {
    bookCode: "BK-008",
    title: "Introductory Horticulture",
    author: "E.P. Christopher",
    publisher: "Oxford & IBH",
    edition: "3rd",
    category: "Horticulture",
    totalCopies: 3,
    shelfNumber: "D-02",
  },
  {
    bookCode: "BK-009",
    title: "Financial Management",
    author: "I.M. Pandey",
    publisher: "Vikas Publishing",
    edition: "12th",
    category: "Management",
    totalCopies: 4,
    shelfNumber: "A-03",
  },
  {
    bookCode: "BK-010",
    title: "Operating System Concepts",
    author: "Abraham Silberschatz",
    publisher: "Wiley",
    edition: "10th",
    category: "Computer Science",
    totalCopies: 5,
    shelfNumber: "B-04",
  },
];

async function ensureAdmin() {
  const existingAdmin = await db.select().from(admins).where(eq(admins.email, ADMIN_EMAIL));
  if (existingAdmin.length > 0) return;

  const existingUser = await db.select().from(user).where(eq(user.email, ADMIN_EMAIL));
  let userId = existingUser[0]?.id;

  if (!userId) {
    const result = await auth.api.signUpEmail({
      body: {
        email: ADMIN_EMAIL,
        password: ADMIN_PASSWORD,
        name: "IPSA Librarian",
      },
    });
    userId = result.user.id;
  }

  await db.update(user).set({ role: "admin", emailVerified: true }).where(eq(user.id, userId));
  await db
    .insert(admins)
    .values({ userId, fullName: "IPSA Librarian", email: ADMIN_EMAIL })
    .onConflictDoNothing();
}

async function ensureStudent(entry: (typeof studentSeed)[number], courseMap: Map<string, string>) {
  const existing = await db
    .select()
    .from(students)
    .where(eq(students.collegeCode, entry.collegeCode));
  if (existing.length > 0) return existing[0];

  const loginEmail = `${entry.collegeCode.toLowerCase()}@students.ipsa.local`;
  const existingUser = await db.select().from(user).where(eq(user.email, loginEmail));
  let userId = existingUser[0]?.id;

  if (!userId) {
    const result = await auth.api.signUpEmail({
      body: {
        email: loginEmail,
        password: STUDENT_PASSWORD,
        name: entry.fullName,
      },
    });
    userId = result.user.id;
  }

  await db.update(user).set({ role: "student", emailVerified: true }).where(eq(user.id, userId));

  const courseId = courseMap.get(entry.course);
  if (!courseId) throw new Error(`Course not found: ${entry.course}`);

  const inserted = await db
    .insert(students)
    .values({
      collegeCode: entry.collegeCode,
      fullName: entry.fullName,
      fatherName: entry.fatherName,
      email: entry.email,
      mobile: entry.mobile,
      courseId,
      semester: entry.semester,
      status: entry.status,
      authUserId: userId,
    })
    .returning();

  return inserted[0];
}

async function ensureBook(entry: (typeof bookSeed)[number]) {
  const existing = await db.select().from(books).where(eq(books.bookCode, entry.bookCode));
  const book =
    existing[0] ??
    (
      await db
        .insert(books)
        .values({
          ...entry,
          availableCopies: entry.totalCopies,
        })
        .returning()
    )[0];

  for (let index = 1; index <= Math.max(entry.totalCopies, 1); index += 1) {
    const copyCode = index === 1 ? entry.bookCode : `${entry.bookCode}-C${index}`;
    await db
      .insert(bookCopies)
      .values({
        copyCode,
        bookId: book.id,
        shelfNumber: entry.shelfNumber,
        status: "available",
      })
      .onConflictDoNothing();
  }

  return book;
}

async function ensureIssue(entry: {
  recordCode: string;
  studentId: string;
  bookId: string;
  issueDate: string;
  dueDate: string;
  returnDate?: string;
  status: "issued" | "returned" | "removed";
  issuedBy: string | null;
  notes?: string;
}) {
  const existing = await db
    .select()
    .from(issueRecords)
    .where(eq(issueRecords.recordCode, entry.recordCode));
  if (existing.length > 0) return;

  const availableCopy = await db
    .select()
    .from(bookCopies)
    .where(
      and(
        eq(bookCopies.bookId, entry.bookId),
        entry.status === "issued"
          ? eq(bookCopies.status, "available")
          : sql`true`,
      ),
    )
    .orderBy(asc(bookCopies.copyCode))
    .limit(1);

  const copyId = availableCopy[0]?.id ?? null;
  await db.insert(issueRecords).values({ ...entry, copyId });

  if (entry.status === "issued" && copyId) {
    await db
      .update(bookCopies)
      .set({ status: "issued", updatedAt: new Date() })
      .where(eq(bookCopies.id, copyId));
    await db
      .update(books)
      .set({ availableCopies: sql`${books.availableCopies} - 1`, updatedAt: new Date() })
      .where(eq(books.id, entry.bookId));
  }
}

async function main() {
  console.log("Seeding IPSA College Library…");

  for (const course of courseSeed) {
    await db.insert(courses).values(course).onConflictDoNothing();
  }

  const allCourses = await db.select().from(courses);
  const courseMap = new Map(allCourses.map((course) => [course.name, course.id]));

  await ensureAdmin();

  for (const entry of studentSeed) {
    await ensureStudent(entry, courseMap);
  }

  for (const entry of bookSeed) {
    await ensureBook(entry);
  }

  const allStudents = await db.select().from(students);
  const allBooks = await db.select().from(books);
  const adminUser = await db.select().from(user).where(eq(user.email, ADMIN_EMAIL));

  const studentByCode = new Map(allStudents.map((student) => [student.collegeCode, student]));
  const bookByCode = new Map(allBooks.map((book) => [book.bookCode, book]));
  const adminId = adminUser[0]?.id ?? null;

  const recordSeed = [
    {
      recordCode: "REC-2026-0001",
      studentCode: "IPSA2024001",
      bookCode: "BK-003",
      issueDate: dateOffset(-23),
      dueDate: dateOffset(-9),
      returnDate: undefined,
      status: "issued" as const,
      notes: "First issue of the semester.",
    },
    {
      recordCode: "REC-2026-0002",
      studentCode: "IPSA2024001",
      bookCode: "BK-001",
      issueDate: dateOffset(-60),
      dueDate: dateOffset(-30),
      returnDate: dateOffset(-35),
      status: "returned" as const,
    },
    {
      recordCode: "REC-2026-0003",
      studentCode: "IPSA2024002",
      bookCode: "BK-002",
      issueDate: dateOffset(-11),
      dueDate: dateOffset(3),
      returnDate: undefined,
      status: "issued" as const,
    },
    {
      recordCode: "REC-2026-0004",
      studentCode: "IPSA2024003",
      bookCode: "BK-006",
      issueDate: dateOffset(-18),
      dueDate: dateOffset(-4),
      returnDate: undefined,
      status: "issued" as const,
    },
    {
      recordCode: "REC-2026-0005",
      studentCode: "IPSA2024004",
      bookCode: "BK-007",
      issueDate: dateOffset(-40),
      dueDate: dateOffset(-12),
      returnDate: dateOffset(-15),
      status: "returned" as const,
    },
    {
      recordCode: "REC-2026-0006",
      studentCode: "IPSA2024005",
      bookCode: "BK-004",
      issueDate: dateOffset(-35),
      dueDate: dateOffset(-7),
      returnDate: dateOffset(-10),
      status: "returned" as const,
    },
    {
      recordCode: "REC-2026-0007",
      studentCode: "IPSA2024002",
      bookCode: "BK-009",
      issueDate: dateOffset(-2),
      dueDate: dateOffset(12),
      returnDate: undefined,
      status: "issued" as const,
    },
    {
      recordCode: "REC-2026-0008",
      studentCode: "IPSA2024006",
      bookCode: "BK-010",
      issueDate: dateOffset(-28),
      dueDate: dateOffset(2),
      returnDate: dateOffset(-1),
      status: "returned" as const,
    },
  ];

  for (const record of recordSeed) {
    const student = studentByCode.get(record.studentCode);
    const book = bookByCode.get(record.bookCode);
    if (!student || !book) continue;
    await ensureIssue({
      recordCode: record.recordCode,
      studentId: student.id,
      bookId: book.id,
      issueDate: record.issueDate,
      dueDate: record.dueDate,
      returnDate: record.returnDate,
      status: record.status,
      issuedBy: adminId,
      notes: record.notes,
    });
  }

  const logCount = await db.select({ count: sql<number>`count(*)::int` }).from(auditLogs);
  if ((logCount[0]?.count ?? 0) === 0) {
    await db.insert(auditLogs).values([
      {
        actorUserId: adminId,
        actorName: "IPSA Librarian",
        actorRole: "admin",
        action: "seed",
        entityType: "system",
        entityId: null,
        details: { message: "Library database initialised with sample catalogue." },
      },
    ]);
  }

  console.log("Seed complete.");
  console.log(`Admin login: ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`);
  console.log("Student login: IPSA2024001 / Student@123");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
