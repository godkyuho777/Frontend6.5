import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type ModifierStatus = "real" | "stub" | "mock" | "error";

/**
 * Modifier 데이터 상태 배지.
 * real = 실제 데이터, stub = 데이터 부족/키 미설정, mock = 임시값, error = 호출 실패.
 */
export function StatusBadge({
  status,
  errorDetail,
}: {
  status: ModifierStatus;
  errorDetail?: string;
}) {
  const cls =
    status === "real"
      ? "border-neon-green/40 text-neon-green bg-neon-green/5"
      : status === "stub"
        ? "border-muted-foreground/40 text-muted-foreground"
        : status === "mock"
          ? "border-orange-400/40 text-orange-300 bg-orange-500/5"
          : "border-neon-red/50 text-neon-red bg-neon-red/5";

  return (
    <Badge
      variant="outline"
      className={cn("font-mono text-[10px] uppercase tracking-wider", cls)}
      title={errorDetail}
    >
      {status}
    </Badge>
  );
}
