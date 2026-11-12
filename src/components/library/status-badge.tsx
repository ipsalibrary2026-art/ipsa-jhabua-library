import { Badge } from "@/components/ui/badge";
import { isOverdue } from "@/lib/dates";
import { cn } from "@/lib/utils";

type Status = "issued" | "returned" | "removed";

export function IssueStatusBadge({
  status,
  dueDate,
}: {
  status: Status | string;
  dueDate?: string | null;
}) {
  if (status === "returned") {
    return (
      <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">
        Returned
      </Badge>
    );
  }

  if (status === "removed") {
    return (
      <Badge variant="outline" className="border-slate-200 bg-slate-100 text-slate-600">
        Removed
      </Badge>
    );
  }

  if (dueDate && isOverdue({ status, dueDate })) {
    return (
      <Badge variant="outline" className="border-red-200 bg-red-50 text-red-700">
        Overdue
      </Badge>
    );
  }

  return (
    <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700">
      Issued
    </Badge>
  );
}

export function AccountStatusBadge({ status }: { status: "active" | "inactive" | string }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        status === "active"
          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
          : "border-slate-200 bg-slate-100 text-slate-600",
      )}
    >
      {status === "active" ? "Active" : "Inactive"}
    </Badge>
  );
}
