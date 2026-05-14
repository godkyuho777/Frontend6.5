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
  onClick?: () => void;
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
}: LiteCardProps) {
  const interactive = !!onClick;
  return (
    <div
      onClick={onClick}
      className={cn(
        "relative overflow-hidden rounded-lg border shadow-sm transition-all",
        VARIANT_CLASSES[variant],
        interactive && "cursor-pointer hover:-translate-y-px hover:border-primary/40 hover:shadow-md active:scale-[0.99]",
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
