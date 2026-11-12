"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import type { BookInput } from "@/lib/action-types";
import { createBook, updateBook } from "@/app/actions/admin";
import { Alert, AlertDescription } from "@/components/ui/alert";
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

export type EditableBook = {
  id: string;
  bookCode: string;
  title: string;
  author: string;
  publisher: string;
  edition: string;
  category: string;
  totalCopies: number;
  shelfNumber: string;
};

export function BookFormDialog({
  book,
  categories,
  trigger,
}: {
  book?: EditableBook;
  categories: string[];
  trigger: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<BookInput>({
    bookCode: book?.bookCode ?? "",
    title: book?.title ?? "",
    author: book?.author ?? "",
    publisher: book?.publisher ?? "",
    edition: book?.edition ?? "",
    category: book?.category ?? "",
    totalCopies: book?.totalCopies ?? 1,
    shelfNumber: book?.shelfNumber ?? "",
  });

  function update<K extends keyof BookInput>(key: K, value: BookInput[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const result = book ? await updateBook(book.id, form) : await createBook(form);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast.success(result.message);
      setOpen(false);
      if (!book) {
        setForm({
          bookCode: "",
          title: "",
          author: "",
          publisher: "",
          edition: "",
          category: "",
          totalCopies: 1,
          shelfNumber: "",
        });
      }
      router.refresh();
    } catch {
      setError("Something went wrong. Please check the connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  const isEditing = Boolean(book);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit book" : "Add new book"}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Update the catalogue entry. Available copies adjust automatically for active loans."
              : "Add a title to the library catalogue and set how many copies are held."}
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
              <Label htmlFor="book-code">Book ID</Label>
              <Input
                id="book-code"
                value={form.bookCode}
                onChange={(event) => update("bookCode", event.target.value)}
                placeholder="BK-011"
                autoCapitalize="characters"
                spellCheck={false}
                required
                className="uppercase placeholder:normal-case"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="book-title">Book name</Label>
              <Input
                id="book-title"
                value={form.title}
                onChange={(event) => update("title", event.target.value)}
                placeholder="Full title"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="book-author">Author</Label>
              <Input
                id="book-author"
                value={form.author}
                onChange={(event) => update("author", event.target.value)}
                placeholder="Author name"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="book-publisher">Publisher</Label>
              <Input
                id="book-publisher"
                value={form.publisher}
                onChange={(event) => update("publisher", event.target.value)}
                placeholder="Publisher"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="book-edition">Edition</Label>
              <Input
                id="book-edition"
                value={form.edition}
                onChange={(event) => update("edition", event.target.value)}
                placeholder="e.g. 3rd"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="book-category">Subject / category</Label>
              <Input
                id="book-category"
                value={form.category}
                onChange={(event) => update("category", event.target.value)}
                placeholder="e.g. Management"
                list="book-categories"
                required
              />
              <datalist id="book-categories">
                {categories.map((category) => (
                  <option key={category} value={category} />
                ))}
              </datalist>
            </div>
            <div className="space-y-2">
              <Label htmlFor="book-copies">Total copies</Label>
              <Input
                id="book-copies"
                type="number"
                min={1}
                max={999}
                value={form.totalCopies}
                onChange={(event) => update("totalCopies", Number(event.target.value))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="book-shelf">Shelf / rack number</Label>
              <Input
                id="book-shelf"
                value={form.shelfNumber}
                onChange={(event) => update("shelfNumber", event.target.value)}
                placeholder="e.g. B-02"
                required
              />
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
                "Add book"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
