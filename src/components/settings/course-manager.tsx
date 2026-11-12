"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BookPlus, Loader2, Power } from "lucide-react";
import { toast } from "sonner";

import { createCourse, setCourseActive } from "@/app/actions/admin";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type CourseRow = {
  id: string;
  name: string;
  department: string;
  isActive: boolean;
};

export function CourseManager({ courses }: { courses: CourseRow[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [department, setDepartment] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const result = await createCourse(name, department);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast.success(result.message);
      setName("");
      setDepartment("");
      router.refresh();
    } catch {
      setError("Could not add the course. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleToggle(course: CourseRow) {
    setBusyId(course.id);
    try {
      const result = await setCourseActive(course.id, !course.isActive);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(result.message);
      router.refresh();
    } catch {
      toast.error("Could not update the course.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-5">
      <form onSubmit={handleCreate} className="space-y-3 rounded-lg bg-slate-50 p-3 sm:p-4">
        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="course-name">Course name</Label>
            <Input
              id="course-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g. B.Com."
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="course-department">Department</Label>
            <Input
              id="course-department"
              value={department}
              onChange={(event) => setDepartment(event.target.value)}
              placeholder="e.g. Department of Commerce"
              required
            />
          </div>
        </div>
        <Button type="submit" size="sm" disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="size-4 animate-spin" /> Adding…
            </>
          ) : (
            <>
              <BookPlus className="size-4" /> Add course
            </>
          )}
        </Button>
      </form>

      <div className="divide-y divide-slate-100 rounded-lg border border-slate-200">
        {courses.map((course) => (
          <div key={course.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-slate-900">{course.name}</p>
              <p className="truncate text-xs text-slate-500">{course.department}</p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <span
                className={
                  course.isActive
                    ? "text-xs font-medium text-emerald-700"
                    : "text-xs font-medium text-slate-500"
                }
              >
                {course.isActive ? "Enabled" : "Disabled"}
              </span>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => handleToggle(course)}
                disabled={busyId === course.id}
                aria-label={course.isActive ? `Disable ${course.name}` : `Enable ${course.name}`}
              >
                {busyId === course.id ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Power className="size-4" />
                )}
              </Button>
            </div>
          </div>
        ))}
      </div>
      <p className="text-xs text-slate-500">
        Disabled courses stay on existing student profiles but cannot be selected for new students.
      </p>
    </div>
  );
}
