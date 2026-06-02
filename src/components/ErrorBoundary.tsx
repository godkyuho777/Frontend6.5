import { cn } from "@/lib/utils";
import { AlertTriangle, RotateCcw, Trash2 } from "lucide-react";
import { Component, ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * 🚨 ErrorBoundary — top-level React error catcher (App.tsx 의 root).
 *
 * Recovery 액션:
 *   1. Reload Page — 단순 reload (fix 가 deploy 된 경우 충분).
 *   2. Clear simulator data + reload — `tradelab.sim.*` + `tradelab.simUser`
 *      전체 삭제 후 reload. 시뮬레이터 페이지에서 발생한 무한 루프 (React
 *      #185 등) 가 cached storage 상태 때문이면 이걸로 해결됨.
 *
 * 시뮬레이터 페이지가 무한 루프 발생 시 사용자는 페이지 진입 자체를 못 함 —
 * ErrorBoundary 안에서만 reset 가능하므로 본 fallback 화면에서 직접 제공.
 *
 * 본 컴포넌트는 dependency-free (sim-local-store import 없음) — circular
 * import 위험 차단 + ErrorBoundary 가 자기 자신을 깨뜨리는 시나리오 방지.
 * localStorage 접근은 inline 으로 처리.
 */
class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  private handleClearSimAndReload = () => {
    try {
      if (typeof window !== "undefined") {
        const keys = Object.keys(window.localStorage);
        for (const k of keys) {
          if (k.startsWith("tradelab.sim.") || k === "tradelab.simUser") {
            window.localStorage.removeItem(k);
          }
        }
      }
    } catch {
      // ignore — 다음 reload 가 처리
    }
    if (typeof window !== "undefined") {
      window.location.reload();
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center min-h-screen p-8 bg-background">
          <div className="flex flex-col items-center w-full max-w-2xl p-8">
            <AlertTriangle
              size={48}
              className="text-destructive mb-6 flex-shrink-0"
            />

            <h2 className="text-xl font-bold mb-4">
              예상치 못한 오류가 발생했습니다
            </h2>

            {/* 스택 트레이스는 개발 모드에서만 노출. 프로덕션에서 내부 코드
                경로/파일 구조를 사용자·제3자에게 흘리지 않고(정보 누출 방지),
                일반 사용자에게 무의미한 텍스트 벽 대신 친절한 안내를 보여준다. */}
            {import.meta.env.DEV && this.state.error?.stack ? (
              <div className="p-4 w-full rounded bg-muted overflow-auto mb-6">
                <pre className="text-sm text-muted-foreground whitespace-break-spaces">
                  {this.state.error.stack}
                </pre>
              </div>
            ) : (
              <p className="mb-6 max-w-md text-center text-sm text-muted-foreground">
                일시적인 오류일 수 있어요. 아래 버튼으로 새로고침하면 대부분
                해결됩니다.
              </p>
            )}

            <div className="flex flex-col sm:flex-row items-center gap-3">
              <button
                onClick={() => window.location.reload()}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-lg",
                  "bg-primary text-primary-foreground",
                  "hover:opacity-90 cursor-pointer",
                )}
              >
                <RotateCcw size={16} />
                Reload Page
              </button>

              <button
                onClick={this.handleClearSimAndReload}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-lg",
                  "bg-destructive text-destructive-foreground",
                  "hover:opacity-90 cursor-pointer",
                )}
                title="시뮬레이터 localStorage 데이터를 모두 삭제 후 reload"
              >
                <Trash2 size={16} />
                Clear simulator data + reload
              </button>
            </div>

            <p className="mt-4 text-xs text-muted-foreground text-center max-w-md">
              시뮬레이터 페이지에서 무한 루프가 발생한 경우 두 번째 버튼을
              누르면 localStorage 의 시뮬레이터 데이터를 삭제하고 fresh 한
              상태로 reload 합니다.
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
