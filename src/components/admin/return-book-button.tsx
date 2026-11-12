"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, Undo2 } from "lucide-react";
import { toast } from "sonner";

import { markReturned } from "@/app/actions/admin";
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
import { formatDate, todayISO } from "@/lib/dates";

export function ReturnBookButton({
  recordId,
  bookTitle,
  bookCode,
  studentName,
  dueDate,
}: {
  recordId: string;
  bookTitle: string;
  bookCode: string;
  studentName: string;
  dueDate: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [returnDate, setReturnDate] = useState(todayISO());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleReturn() {
    setLoading(true);
    setError(null);
    try {
      const result = await markReturned(recordId, returnDate);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast.success(result.message);
      setOpen(false);
      router.refresh();
    } catch {
      setError("Could not return the book. Check the connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Undo2 className="size-4" /> Mark returned
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Return this book?</DialogTitle>
          <DialogDescription>
            {bookTitle} ({bookCode}) from {studentName}. The copy will be added back to the
            available stock automatically.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
            <p className="text-slate-600">
              Due date: <span className="font-medium text-slate-900">{formatDate(dueDate)}</span>
            </p>
            <p className="text-slate-500">
              {returnDate > dueDate ? "Returned after the due date." : "Returned within the due date."}
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor={`return-date-${recordId}`}>Return date</Label>
            <Input
              id={`return-date-${recordId}`}
              type="date"
              value={returnDate}
              onChange={(event) => setReturnDate(event.target.value)}
              required
            />
          </div>
          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleReturn} disabled={loading || !returnDate}>
            {loading ? (
              <>
                <Loader2 className="size-4 animate-spin" /> Updating…
              </>
            ) : (
              <>
                <CheckCircle2 className="size-4" /> Confirm return
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
