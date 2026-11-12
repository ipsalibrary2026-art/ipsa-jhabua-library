export type ActionResult =
  | { ok: true; message: string; id?: string }
  | { ok: false; error: string };

export type StudentInput = {
  collegeCode: string;
  fullName: string;
  fatherName: string;
  email: string;
  mobile: string;
  courseId: string;
  semester: string;
  password?: string;
  status: "active" | "inactive";
};

export type BookInput = {
  bookCode: string;
  title: string;
  author: string;
  publisher: string;
  edition: string;
  category: string;
  totalCopies: number;
  shelfNumber: string;
};

export type IssueInput = {
  collegeCode: string;
  bookId: string;
  issueDate: string;
  dueDate: string;
  notes?: string;
};
