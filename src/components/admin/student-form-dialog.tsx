"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import type { StudentInput } from "@/lib/action-types";
import { createStudent, updateStudent } from "@/app/actions/admin";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";

export type CourseOption = {
  id: string;
  name: string;
  department: string;
  isActive: boolean;
};

export type EditableStudent = {
  id: string;
  collegeCode: string;
  fullName: string;
  fatherName: string;
  email: string;
  mobile: string;
  courseId: string;
  semester: string;
  status: "active" | "inactive";
};

const semesters = [
  "Semester 1",
  "Semester 2",
  "Semester 3",
  "Semester 4",
  "Semester 5",
  "Semester 6",
  "Semester 7",
  "Semester 8",
  "Year 1",
  "Year 2",
  "Year 3",
];

export function StudentFormDialog({
  courses,
  student,
  trigger,
}: {
  courses: CourseOption[];
  student?: EditableStudent;
  trigger: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<StudentInput>({
    collegeCode: student?.collegeCode ?? "",
    fullName: student?.fullName ?? "",
    fatherName: student?.fatherName ?? "",
    email: student?.email ?? "",
    mobile: student?.mobile ?? "",
    courseId: student?.courseId ?? courses[0]?.id ?? "",
    semester: student?.semester ?? "Semester 1",
    password: "",
    status: student?.status ?? "active",
  });

  const isEditing = Boolean(student);

  function update<K extends keyof StudentInput>(key: K, value: StudentInput[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const payload: StudentInput = {
        ...form,
        password: form.password?.trim() ? form.password : undefined,
      };
      const result = student
        ? await updateStudent(student.id, payload)
        : await createStudent(payload);

      if (!result.ok) {
        setError(result.error);
        return;
      }

      toast.success(result.message);
      setOpen(false);
      if (!student) {
        setForm({
          collegeCode: "",
          fullName: "",
          fatherName: "",
          email: "",
          mobile: "",
          courseId: courses[0]?.id ?? "",
          semester: "Semester 1",
          password: "",
          status: "active",
        });
      }
      router.refresh();
    } catch {
      setError("Something went wrong. Please check the connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit student" : "Add new student"}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Update the student's details or reset their library password."
              : "Create a library account. The student signs in with the college code and this password."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="student-code">College code</Label>
              <Input
                id="student-code"
                value={form.collegeCode}
                onChange={(event) => update("collegeCode", event.target.value)}
                placeholder="IPSA2024007"
                autoCapitalize="characters"
                spellCheck={false}
                required
                className="uppercase placeholder:normal-case"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="student-name">Student name</Label>
              <Input
                id="student-name"
                value={form.fullName}
                onChange={(event) => update("fullName", event.target.value)}
                placeholder="Full name"
                autoComplete="name"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="student-father">Father&apos;s name</Label>
              <Input
                id="student-father"
                value={form.fatherName}
                onChange={(event) => update("fatherName", event.target.value)}
                placeholder="Father's full name"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="student-mobile">Mobile number</Label>
              <Input
                id="student-mobile"
                value={form.mobile}
                onChange={(event) => update("mobile", event.target.value)}
                placeholder="9876543210"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                required
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="student-email">Email address</Label>
              <Input
                id="student-email"
                value={form.email}
                onChange={(event) => update("email", event.target.value)}
                placeholder="student@example.com"
                type="email"
                autoComplete="email"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="student-course">Course</Label>
              <select
                id="student-course"
                value={form.courseId}
                onChange={(event) => update("courseId", event.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                required
              >
                {courses.map((course) => (
                  <option key={course.id} value={course.id}>
                    {course.name}
                    {course.isActive ? "" : " (inactive)"}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="student-semester">Semester / year</Label>
              <select
                id="student-semester"
                value={form.semester}
                onChange={(event) => update("semester", event.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                required
              >
                {semesters.map((semester) => (
                  <option key={semester} value={semester}>
                    {semester}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="student-status">Account status</Label>
              <select
                id="student-status"
                value={form.status}
                onChange={(event) => update("status", event.target.value as "active" | "inactive")}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="student-password">
                {isEditing ? "New password (optional)" : "Login password"}
              </Label>
              <Input
                id="student-password"
                value={form.password ?? ""}
                onChange={(event) => update("password", event.target.value)}
                placeholder={isEditing ? "Leave blank to keep current" : "Minimum 8 characters"}
                type="text"
                autoComplete="new-password"
                minLength={form.password ? 8 : undefined}
              />
              <p className="text-xs text-muted-foreground">
                {isEditing
                  ? "Changing this signs the student out of other devices."
                  : "Share this password with the student. Default is Student@123."}
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="size-4 animate-spin" /> Saving…
                </>
              ) : isEditing ? (
                "Save changes"
              ) : (
                "Add student"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
