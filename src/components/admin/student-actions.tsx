"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Eye,
  KeyRound,
  Loader2,
  MoreHorizontal,
  Pencil,
  Power,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import {
  archiveStudent,
  changeStudentPassword,
  setStudentStatus,
} from "@/app/actions/admin";
import {
  StudentFormDialog,
  type CourseOption,
  type EditableStudent,
} from "@/components/admin/student-form-dialog";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function StudentActions({
  student,
  courses,
  redirectAfterDelete,
}: {
  student: EditableStudent & { status: "active" | "inactive" };
  courses: CourseOption[];
  redirectAfterDelete?: boolean;
}) {
  const router = useRouter();
  const [resetOpen, setResetOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState<"reset" | "delete" | "status" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleReset() {
    setBusy("reset");
    setError(null);
    try {
      const result = await changeStudentPassword(student.id, password);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast.success(result.message);
      setResetOpen(false);
      setPassword("");
    } catch {
      setError("Could not reset the password. Please try again.");
    } finally {
      setBusy(null);
    }
  }

  async function handleDelete() {
    setBusy("delete");
    try {
      const result = await archiveStudent(student.id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(result.message);
      setDeleteOpen(false);
      if (redirectAfterDelete) router.push("/admin/students");
      router.refresh();
    } catch {
      toast.error("Could not delete the student. Please try again.");
    } finally {
      setBusy(null);
    }
  }

  async function handleStatus() {
    setBusy("status");
    try {
      const next = student.status === "active" ? "inactive" : "active";
      const result = await setStudentStatus(student.id, next);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(result.message);
      router.refresh();
    } catch {
      toast.error("Could not update the account status.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex items-center justify-end gap-0.5">
      <Button variant="ghost" size="icon-sm" asChild>
        <Link href={`/admin/students/${student.id}`} aria-label={`View ${student.fullName}`}>
          <Eye className="size-4" />
        </Link>
      </Button>

      <StudentFormDialog
        courses={courses}
        student={student}
        trigger={
          <Button variant="ghost" size="icon-sm" aria-label={`Edit ${student.fullName}`}>
            <Pencil className="size-4" />
          </Button>
        }
      />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label={`More actions for ${student.fullName}`}>
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuLabel>Manage account</DropdownMenuLabel>
          <DropdownMenuItem onClick={() => setResetOpen(true)}>
            <KeyRound className="size-4" /> Reset password
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleStatus} disabled={busy !== null}>
            <Power className="size-4" />
            {student.status === "active" ? "Deactivate account" : "Activate account"}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => setDeleteOpen(true)}
            className="text-red-600 focus:text-red-700"
          >
            <Trash2 className="size-4" /> Delete student
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reset student password</DialogTitle>
            <DialogDescription>
              Set a new password for {student.fullName} ({student.collegeCode}). Existing sessions
              will be signed out.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor={`new-password-${student.id}`}>New password</Label>
            <Input
              id={`new-password-${student.id}`}
              type="text"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="At least 8 characters"
              autoComplete="new-password"
            />
            {error ? <p className="text-sm text-red-600">{error}</p> : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleReset} disabled={busy === "reset" || password.length < 8}>
              {busy === "reset" ? <Loader2 className="size-4 animate-spin" /> : <KeyRound className="size-4" />}
              Set password
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {student.fullName}?</AlertDialogTitle>
            <AlertDialogDescription>
              The student will be removed from the active list and can no longer sign in. Their
              issue history stays in the library records for audit purposes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={busy === "delete"}
              className="bg-red-600 hover:bg-red-700"
            >
              {busy === "delete" ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
              Delete student
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
