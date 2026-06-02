/**
 * LiteCard — Lite 모드의 기본 카드 컨테이너.
 * Pro 의 HudPanel 보다 부드러운 톤, 큰 라운딩, 기본 큰 폰트.
 */

import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

interface LiteCardProps {
  title?: string;
  subtitle?: string;
  icon?: ReactNode;
  children: ReactNode;
  variant?: "default" | "good" | "caution" | "bad" | "muted";
  className?: string;
  /**
   * 실제 클릭 핸들러. 제공하면 카드가 버튼처럼 동작하며 키보드(Enter/Space)
   * 와 focus-visible 링을 갖춘다. 이미 <Link> 로 감싼 카드라면 onClick 대신
   * `interactive` 를 써서 시각 효과만 주고 중첩 인터랙티브 요소를 피한다.
   */
  onClick?: () => void;
  /** 클릭 핸들러 없이 hover lift 등 시각적 인터랙티브 스타일만 적용. */
  interactive?: boolean;
}

const VARIANT_CLASSES: Record<Required<LiteCardProps>["variant"], string> = {
  default: "border-border bg-card",
  good: "border-neon-green/40 bg-neon-green/5",
  caution: "border-neon-yellow/40 bg-neon-yellow/5",
  bad: "border-neon-red/40 bg-neon-red/5",
  muted: "border-border bg-muted/40",
};

export function LiteCard({
  title,
  subtitle,
  icon,
  children,
  variant = "default",
  className,
  onClick,
  interactive: interactiveProp = false,
}: LiteCardProps) {
  const isButton = !!onClick;
  const interactive = isButton || interactiveProp;
  return (
    <div
      onClick={onClick}
      // 실제 핸들러가 있으면 버튼 시맨틱 + 키보드 활성화를 제공 (기존엔
      // onClick 만 있고 키보드/포커스가 없어 키보드·스크린리더 사용자가
      // 카드를 누를 수 없었다).
      role={isButton ? "button" : undefined}
      tabIndex={isButton ? 0 : undefined}
      onKeyDown={
        isButton
          ? event => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onClick?.();
              }
            }
          : undefined
      }
      className={cn(
        "relative overflow-hidden rounded-lg border shadow-sm transition-all",
        VARIANT_CLASSES[variant],
        interactive && "cursor-pointer hover:-translate-y-px hover:border-primary/40 hover:shadow-md active:scale-[0.99]",
        isButton &&
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
        className
      )}
    >
      {(title || subtitle || icon) && (
        <div className="px-4 pt-4 pb-2 flex items-start gap-3">
          {icon && <div className="mt-0.5 shrink-0">{icon}</div>}
          <div className="min-w-0">
            {title && (
              <h3 className="font-display text-base font-bold tracking-tight text-foreground">
                {title}
              </h3>
            )}
            {subtitle && (
              <p className="font-sans text-[11px] text-muted-foreground mt-0.5">
                {subtitle}
              </p>
            )}
          </div>
        </div>
      )}
      <div className="px-4 pb-4 pt-1">{children}</div>
    </div>
  );
}
