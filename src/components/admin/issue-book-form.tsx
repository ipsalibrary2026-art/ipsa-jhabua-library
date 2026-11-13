"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Loader2,
  PlusCircle,
  Search,
  TriangleAlert,
} from "lucide-react";
import { toast } from "sonner";

import { issueBook, issueNewBook } from "@/app/actions/admin";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { addDaysISO, formatDate, todayISO } from "@/lib/dates";

type AvailableCopy = {
  copyId: string;
  copyCode: string;
  shelfNumber: string;
  bookId: string;
  title: string;
  author: string;
  category: string;
};

type NewBookDraft = {
  bookCode: string;
  title: string;
  author: string;
  publisher: string;
  edition: string;
  category: string;
  shelfNumber: string;
};

const emptyBook: NewBookDraft = {
  bookCode: "",
  title: "",
  author: "",
  publisher: "",
  edition: "",
  category: "",
  shelfNumber: "",
};

export function IssueBookForm({
  student,
  copies,
  categories,
  activeBookIds,
}: {
  student: { fullName: string; collegeCode: string; courseName: string; semester: string };
  copies: AvailableCopy[];
  categories: string[];
  activeBookIds: string[];
}) {
  const router = useRouter();
  const today = todayISO();
  const [mode, setMode] = useState<"existing" | "new">("existing");
  const [query, setQuery] = useState("");
  const [copyId, setCopyId] = useState("");
  const [newBook, setNewBook] = useState<NewBookDraft>(emptyBook);
  const [issueDate, setIssueDate] = useState(today);
  const [dueDate, setDueDate] = useState(addDaysISO(today, 14));
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const activeSet = new Set(activeBookIds);
  const term = query.trim().toLowerCase();
  const visibleCopies = term
    ? copies.filter(
        (copy) =>
          copy.title.toLowerCase().includes(term) ||
          copy.copyCode.toLowerCase().includes(term) ||
          copy.author.toLowerCase().includes(term),
      )
    : copies;
  const selectedCopy = copies.find((copy) => copy.copyId === copyId);

  function updateNewBook<K extends keyof NewBookDraft>(key: K, value: NewBookDraft[K]) {
    setNewBook((current) => ({ ...current, [key]: value }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    if (mode === "existing" && !copyId) {
      setError("Select the physical Book ID you want to issue.");
      return;
    }

    setLoading(true);
    try {
      const result =
        mode === "existing"
          ? await issueBook({
              collegeCode: student.collegeCode,
              copyId,
              issueDate,
              dueDate,
              notes,
            })
          : await issueNewBook({
              collegeCode: student.collegeCode,
              ...newBook,
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
      setCopyId("");
      setQuery("");
      setNotes("");
      if (mode === "new") setNewBook(emptyBook);
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

      <div className="grid gap-2 sm:grid-cols-2" role="group" aria-label="How to choose the book">
        <button
          type="button"
          aria-pressed={mode === "existing"}
          onClick={() => setMode("existing")}
          className={
            mode === "existing"
              ? "flex items-start gap-3 rounded-lg border border-blue-500 bg-blue-50 p-3 text-left ring-1 ring-blue-500/30"
              : "flex items-start gap-3 rounded-lg border border-slate-200 bg-white p-3 text-left hover:border-slate-300"
          }
        >
          <BookOpen className="mt-0.5 size-4 shrink-0 text-blue-700" aria-hidden="true" />
          <span>
            <span className="block text-sm font-semibold text-slate-900">Select existing book</span>
            <span className="mt-0.5 block text-xs text-slate-600">
              Search the catalogue and choose a physical Book ID on the shelf.
            </span>
          </span>
        </button>
        <button
          type="button"
          aria-pressed={mode === "new"}
          onClick={() => setMode("new")}
          className={
            mode === "new"
              ? "flex items-start gap-3 rounded-lg border border-blue-500 bg-blue-50 p-3 text-left ring-1 ring-blue-500/30"
              : "flex items-start gap-3 rounded-lg border border-slate-200 bg-white p-3 text-left hover:border-slate-300"
          }
        >
          <PlusCircle className="mt-0.5 size-4 shrink-0 text-blue-700" aria-hidden="true" />
          <span>
            <span className="block text-sm font-semibold text-slate-900">
              Add new book during issue
            </span>
            <span className="mt-0.5 block text-xs text-slate-600">
              Register a new physical copy and issue it in one step.
            </span>
          </span>
        </button>
      </div>

      {mode === "existing" ? (
        <div className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="copy-search">Search by book name or Book ID</Label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
              <Input
                id="copy-search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="e.g. Operating System or BK-010-C2"
                className="pl-9"
                autoComplete="off"
                spellCheck={false}
              />
            </div>
          </div>

          {copies.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-center">
              <p className="text-sm font-medium text-slate-900">No physical copies available</p>
              <p className="mt-1 text-xs text-slate-600">
                Every copy is on loan. Use <strong>Add new book during issue</strong> to register a
                new copy without leaving this page.
              </p>
            </div>
          ) : visibleCopies.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-center text-sm text-slate-600">
              No available copy matches “{query}”. Try another name or Book ID.
            </div>
          ) : (
            <div className="max-h-72 overflow-y-auto rounded-lg border border-slate-200">
              <ul className="divide-y divide-slate-100">
                {visibleCopies.map((copy) => {
                  const alreadyIssued = activeSet.has(copy.bookId);
                  const selected = copy.copyId === copyId;
                  return (
                    <li key={copy.copyId}>
                      <button
                        type="button"
                        disabled={alreadyIssued}
                        onClick={() => setCopyId(copy.copyId)}
                        aria-pressed={selected}
                        className={
                          selected
                            ? "flex w-full items-start justify-between gap-3 bg-blue-50 px-3 py-2.5 text-left"
                            : "flex w-full items-start justify-between gap-3 px-3 py-2.5 text-left hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                        }
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium text-slate-900">
                            {copy.title}
                          </span>
                          <span className="mt-0.5 block text-xs text-slate-500">
                            {copy.author} · Shelf {copy.shelfNumber}
                            {alreadyIssued ? " · already issued to this student" : ""}
                          </span>
                        </span>
                        <span
                          className={
                            selected
                              ? "shrink-0 rounded-md bg-blue-600 px-2 py-1 font-mono text-[11px] font-semibold text-white"
                              : "shrink-0 rounded-md bg-slate-100 px-2 py-1 font-mono text-[11px] font-semibold text-slate-700"
                          }
                        >
                          {copy.copyCode}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          <p className="text-xs text-slate-500">
            {selectedCopy
              ? `Selected: ${selectedCopy.title} · Book ID ${selectedCopy.copyCode}`
              : "Select one physical Book ID to continue."}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-800">
            The book is saved to the catalogue and its physical copy is issued in a single step. If
            either step fails, nothing is saved.
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="new-book-code">Book ID (mandatory)</Label>
              <Input
                id="new-book-code"
                value={newBook.bookCode}
                onChange={(event) => updateNewBook("bookCode", event.target.value)}
                placeholder="e.g. BK-011"
                autoCapitalize="characters"
                spellCheck={false}
                required
                className="uppercase placeholder:normal-case"
              />
              <p className="text-xs text-slate-500">
                Unique physical copy ID. Duplicate IDs are rejected.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-book-title">Book name</Label>
              <Input
                id="new-book-title"
                value={newBook.title}
                onChange={(event) => updateNewBook("title", event.target.value)}
                placeholder="Full title"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-book-author">Author</Label>
              <Input
                id="new-book-author"
                value={newBook.author}
                onChange={(event) => updateNewBook("author", event.target.value)}
                placeholder="Author name"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-book-publisher">Publisher</Label>
              <Input
                id="new-book-publisher"
                value={newBook.publisher}
                onChange={(event) => updateNewBook("publisher", event.target.value)}
                placeholder="Publisher"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-book-edition">Edition</Label>
              <Input
                id="new-book-edition"
                value={newBook.edition}
                onChange={(event) => updateNewBook("edition", event.target.value)}
                placeholder="e.g. 3rd"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-book-category">Subject / category</Label>
              <Input
                id="new-book-category"
                value={newBook.category}
                onChange={(event) => updateNewBook("category", event.target.value)}
                placeholder="e.g. Management"
                list="issue-book-categories"
                required
              />
              <datalist id="issue-book-categories">
                {categories.map((category) => (
                  <option key={category} value={category} />
                ))}
              </datalist>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="new-book-shelf">Shelf / rack number</Label>
              <Input
                id="new-book-shelf"
                value={newBook.shelfNumber}
                onChange={(event) => updateNewBook("shelfNumber", event.target.value)}
                placeholder="e.g. B-02"
                required
              />
            </div>
          </div>
        </div>
      )}

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
        <Button type="submit" disabled={loading || (mode === "existing" && !copyId)}>
          {loading ? (
            <>
              <Loader2 className="size-4 animate-spin" /> Issuing…
            </>
          ) : (
            <>
              Confirm issue <ArrowRight className="size-4" />
            </>
          )}
        </Button>
      </div>
    </form>
  );
}
