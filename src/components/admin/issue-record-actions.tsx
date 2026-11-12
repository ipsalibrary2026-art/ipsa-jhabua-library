"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarClock, Loader2, MoreHorizontal, Pencil, Trash2, UserRound } from "lucide-react";
import { toast } from "sonner";

import { removeIssueRecord, updateIssueDates } from "@/app/actions/admin";
import { ReturnBookButton } from "@/components/admin/return-book-button";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function IssueRecordActions({
  record,
}: {
  record: {
    id: string;
    recordCode: string;
    studentId: string;
    bookTitle: string;
    bookCode: string;
    studentName: string;
    issueDate: string;
    dueDate: string;
    status: "issued" | "returned" | "removed";
  };
}) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [removeOpen, setRemoveOpen] = useState(false);
  const [issueDate, setIssueDate] = useState(record.issueDate);
  const [dueDate, setDueDate] = useState(record.dueDate);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState<"edit" | "remove" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleEdit() {
    setLoading("edit");
    setError(null);
    try {
      const result = await updateIssueDates(record.id, issueDate, dueDate);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast.success(result.message);
      setEditOpen(false);
      router.refresh();
    } catch {
      setError("Could not update the dates. Please try again.");
    } finally {
      setLoading(null);
    }
  }

  async function handleRemove() {
    setLoading("remove");
    setError(null);
    try {
      const result = await removeIssueRecord(record.id, reason);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast.success(result.message);
      setRemoveOpen(false);
      setReason("");
      router.refresh();
    } catch {
      setError("Could not remove the record. Please try again.");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="flex items-center justify-end gap-1">
      {record.status === "issued" ? (
        <ReturnBookButton
          recordId={record.id}
          bookTitle={record.bookTitle}
          bookCode={record.bookCode}
          studentName={record.studentName}
          dueDate={record.dueDate}
        />
      ) : null}

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label="Edit issue dates">
            <Pencil className="size-4" />
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit loan dates</DialogTitle>
            <DialogDescription>
              {record.recordCode} · {record.bookTitle} · {record.studentName}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor={`edit-issue-${record.id}`}>Issue date</Label>
              <Input
                id={`edit-issue-${record.id}`}
                type="date"
                value={issueDate}
                onChange={(event) => setIssueDate(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`edit-due-${record.id}`}>Due date</Label>
              <Input
                id={`edit-due-${record.id}`}
                type="date"
                min={issueDate}
                value={dueDate}
                onChange={(event) => setDueDate(event.target.value)}
              />
            </div>
          </div>
          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleEdit} disabled={loading === "edit" || !issueDate || !dueDate}>
              {loading === "edit" ? <Loader2 className="size-4 animate-spin" /> : <CalendarClock className="size-4" />}
              Save dates
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label={`More actions for ${record.recordCode}`}>
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuLabel>Record actions</DropdownMenuLabel>
          <DropdownMenuItem asChild>
            <Link href={`/admin/students/${record.studentId}`}>
              <UserRound className="size-4" /> View student profile
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setEditOpen(true)}>
            <Pencil className="size-4" /> Edit dates
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => setRemoveOpen(true)}
            disabled={record.status === "removed"}
            className="text-red-600 focus:text-red-700"
          >
            <Trash2 className="size-4" /> Remove record
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={removeOpen} onOpenChange={setRemoveOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {record.recordCode}?</AlertDialogTitle>
            <AlertDialogDescription>
              This takes the record out of circulation and frees the copy, but it stays in the
              library&apos;s audit history. Give a reason so the change can be traced.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <Label htmlFor={`remove-reason-${record.id}`}>Reason</Label>
            <Textarea
              id={`remove-reason-${record.id}`}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="e.g. Record created in error"
              rows={2}
            />
          </div>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemove}
              disabled={loading === "remove" || reason.trim().length < 3}
              className="bg-red-600 hover:bg-red-700"
            >
              {loading === "remove" ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
              Remove record
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
