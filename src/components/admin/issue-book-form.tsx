"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, CheckCircle2, Loader2, TriangleAlert } from "lucide-react";
import { toast } from "sonner";

import { issueBook } from "@/app/actions/admin";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { addDaysISO, formatDate, todayISO } from "@/lib/dates";

type AvailableBook = {
  id: string;
  bookCode: string;
  title: string;
  author: string;
  availableCopies: number;
  shelfNumber: string;
};

export function IssueBookForm({
  student,
  books,
  activeBookIds,
}: {
  student: { fullName: string; collegeCode: string; courseName: string; semester: string };
  books: AvailableBook[];
  activeBookIds: string[];
}) {
  const router = useRouter();
  const today = todayISO();
  const [bookId, setBookId] = useState("");
  const [issueDate, setIssueDate] = useState(today);
  const [dueDate, setDueDate] = useState(addDaysISO(today, 14));
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const activeSet = new Set(activeBookIds);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      const result = await issueBook({
        collegeCode: student.collegeCode,
        bookId,
        issueDate,
        dueDate,
        notes,
      });

      if (!result.ok) {
        setError(result.error);
        return;
      }

      toast.success(result.message);
      setSuccess(result.message);
      setBookId("");
      setNotes("");
      router.refresh();
    } catch {
      setError("Something went wrong. Check the connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error ? (
        <Alert variant="destructive">
          <TriangleAlert className="size-4" />
          <AlertTitle>Could not issue this book</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {success ? (
        <Alert className="border-emerald-200 bg-emerald-50 text-emerald-900">
          <CheckCircle2 className="size-4 text-emerald-600" />
          <AlertTitle>Book issued</AlertTitle>
          <AlertDescription className="text-emerald-800">
            {success} It is now visible in the student&apos;s dashboard.
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="issue-book">Available book</Label>
        <select
          id="issue-book"
          value={bookId}
          onChange={(event) => setBookId(event.target.value)}
          required
          className="flex h-10 w-full rounded-md border border-input bg-white px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          <option value="">Select a book from the catalogue</option>
          {books.map((book) => {
            const alreadyIssued = activeSet.has(book.id);
            return (
              <option key={book.id} value={book.id} disabled={alreadyIssued}>
                {book.title} · {book.bookCode} · {book.availableCopies} available
                {alreadyIssued ? " (already issued to this student)" : ""}
              </option>
            );
          })}
        </select>
        <p className="text-xs text-slate-500">
          Only books with at least one copy on the shelf can be issued.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="issue-date">Issue date</Label>
          <Input
            id="issue-date"
            type="date"
            value={issueDate}
            max={dueDate}
            onChange={(event) => {
              setIssueDate(event.target.value);
              if (event.target.value > dueDate) setDueDate(addDaysISO(event.target.value, 14));
            }}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="due-date">Due date</Label>
          <Input
            id="due-date"
            type="date"
            value={dueDate}
            min={issueDate}
            onChange={(event) => setDueDate(event.target.value)}
            required
          />
          <p className="text-xs text-slate-500">Default loan period is 14 days.</p>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="issue-notes">Notes (optional)</Label>
        <Textarea
          id="issue-notes"
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          placeholder="Reference number, condition on issue, or a note for the desk."
          rows={2}
          maxLength={500}
        />
      </div>

      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
        Issuing to <strong className="font-medium text-slate-900">{student.fullName}</strong> ·{" "}
        <span className="font-mono text-xs">{student.collegeCode}</span> · due{" "}
        {formatDate(dueDate)}
      </div>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" asChild>
          <Link href="/admin/issues/return">Go to returns</Link>
        </Button>
        <Button type="submit" disabled={loading || !bookId}>
          {loading ? (
            <>
              <Loader2 className="size-4 animate-spin" /> Issuing…
            </>
          ) : (
            <>
              Issue book <ArrowRight className="size-4" />
            </>
          )}
        </Button>
      </div>
    </form>
  );
}
