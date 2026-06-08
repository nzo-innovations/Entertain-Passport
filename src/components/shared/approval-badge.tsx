import { Badge } from "@/components/ui/badge";
import { APPROVAL_STATUS_LABELS, type ApprovalStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

const VARIANTS: Record<
  ApprovalStatus,
  "default" | "secondary" | "success" | "warning" | "live" | "outline"
> = {
  DRAFT: "outline",
  PENDING_REVIEW: "warning",
  APPROVED: "success",
  REJECTED: "live",
  CHANGES_REQUESTED: "secondary",
};

export function ApprovalBadge({
  status,
  className,
}: {
  status: string;
  className?: string;
}) {
  const key = status as ApprovalStatus;
  return (
    <Badge variant={VARIANTS[key] ?? "outline"} className={cn(className)}>
      {APPROVAL_STATUS_LABELS[key] ?? status}
    </Badge>
  );
}
