"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, MoreHorizontal, Pencil, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { deleteBook, restoreArchivedBook } from "@/app/actions/admin";
import {
  BookFormDialog,
  type EditableBook,
} from "@/components/admin/book-form-dialog";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function BookActions({
  book,
  categories,
  archived = false,
}: {
  book: EditableBook;
  categories: string[];
  archived?: boolean;
}) {
  const router = useRouter();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [busy, setBusy] = useState<"delete" | "restore" | null>(null);

  async function handleDelete() {
    setBusy("delete");
    try {
      const result = await deleteBook(book.id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(result.message);
      setDeleteOpen(false);
      router.refresh();
    } catch {
      toast.error("Could not delete the book. Please try again.");
    } finally {
      setBusy(null);
    }
  }

  async function handleRestore() {
    setBusy("restore");
    try {
      const result = await restoreArchivedBook(book.id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(result.message);
      router.refresh();
    } catch {
      toast.error("Could not restore the book. Please try again.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex items-center justify-end gap-0.5">
      <BookFormDialog
        book={book}
        categories={categories}
        trigger={
          <Button variant="ghost" size="icon-sm" aria-label={`Edit ${book.title}`}>
            <Pencil className="size-4" />
          </Button>
        }
      />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label={`More actions for ${book.title}`}>
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuLabel>Catalogue</DropdownMenuLabel>
          {archived ? (
            <DropdownMenuItem onClick={handleRestore} disabled={busy !== null}>
              <RotateCcw className="size-4" /> Restore book
            </DropdownMenuItem>
          ) : (
            <>
              <DropdownMenuItem onClick={() => setDeleteOpen(true)} className="text-red-600 focus:text-red-700">
                <Trash2 className="size-4" /> Delete book
              </DropdownMenuItem>
            </>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem disabled>Book ID: {book.bookCode}</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete &quot;{book.title}&quot;?</AlertDialogTitle>
            <AlertDialogDescription>
              The book will be removed from the active catalogue. If it has issue history, the
              records are preserved for audit and reporting.
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
              Delete book
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
