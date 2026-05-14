import { useEffect, useState } from "react";

type HealthState =
  | { status: "loading" }
  | { status: "ok"; branch: string }
  | { status: "error"; detail: string };

/**
 * 사이드바 푸터에 표시되는 백엔드 브랜치 인디케이터.
 * /api/health 를 폴링하여 결합 브랜치(feat/v6.5-merge)가 정상 응답하는지 시각적으로 확인.
 *
 * - 연결 OK 시 초록 배지 + 브랜치 이름
 * - 실패 시 빨간 배지 + 에러 사유
 */
export function BackendBranchIndicator({
  variant = "stacked",
}: {
  variant?: "stacked" | "topbar";
}) {
  const [state, setState] = useState<HealthState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;

    const ping = async () => {
      try {
        const res = await fetch("/api/health", { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as { ok?: boolean; branch?: string };
        if (cancelled) return;
        if (json.ok) {
          setState({ status: "ok", branch: json.branch ?? "unknown" });
        } else {
          setState({ status: "error", detail: "ok=false" });
        }
      } catch (err) {
        if (cancelled) return;
        setState({
          status: "error",
          detail: err instanceof Error ? err.message : "unknown",
        });
      }
    };

    ping();
    const interval = setInterval(ping, 30_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const dot =
    state.status === "ok"
      ? "bg-emerald-400"
      : state.status === "error"
      ? "bg-red-500"
      : "bg-neon-cyan/40 animate-pulse";

  const text =
    state.status === "ok"
      ? state.branch
      : state.status === "error"
      ? "offline"
      : "checking…";

  const title =
    state.status === "error"
      ? `Backend health failed: ${state.detail}`
      : "Backend /api/health";

  if (variant === "topbar") {
    return (
      <div className="hidden items-center gap-2 lg:flex">
        <div
          className="inline-flex h-8 items-center gap-2 rounded-md bg-muted px-3 font-sans text-xs font-bold text-muted-foreground transition-colors hover:bg-muted/80"
          title={title}
        >
          <span className={`size-1.5 shrink-0 rounded-full ${dot}`} />
          <span>
            Backend <span className="text-foreground">{text}</span>
          </span>
        </div>
        <div
          className="inline-flex h-8 items-center gap-2 rounded-md bg-muted px-3 font-sans text-xs font-bold text-muted-foreground transition-colors hover:bg-muted/80"
          title="PATTERN_SYSTEM_AUDIT v1 권고 적용: 다중 패턴 합산 + 거래량/추세 컨텍스트 + TF 차등 + look-ahead 안전"
        >
          <span className="size-1.5 shrink-0 rounded-full bg-emerald-500" />
          <span>
            Patterns <span className="text-foreground">audit v1</span>
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-1 mb-2">
      <div
        className="flex items-center gap-2 px-2 py-1.5 rounded-sm border border-border/30 bg-background/40 group-data-[collapsible=icon]:justify-center"
        title={title}
      >
        <span className={`h-2 w-2 rounded-full ${dot} shrink-0`} />
        <span className="text-[10px] font-sans text-muted-foreground truncate group-data-[collapsible=icon]:hidden">
          Backend: <span className="text-neon-cyan">{text}</span>
        </span>
      </div>
      <div
        className="flex items-center gap-2 px-2 py-1 rounded-sm border border-emerald-500/30 bg-emerald-500/5 group-data-[collapsible=icon]:hidden"
        title="PATTERN_SYSTEM_AUDIT v1 권고 적용: 다중 패턴 합산 + 거래량/추세 컨텍스트 + TF 차등 + look-ahead 안전"
      >
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shrink-0" />
        <span className="text-[9px] font-sans text-emerald-400 truncate">
          Patterns: audit v1 ✓
        </span>
      </div>
    </div>
  );
}
