import { cn } from "@/lib/utils";

interface HudPanelProps {
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
  headerRight?: React.ReactNode;
  variant?: "default" | "highlight" | "danger";
}

export function HudPanel({
  title,
  subtitle,
  children,
  className,
  headerRight,
  variant = "default",
}: HudPanelProps) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-lg bg-card",
        className
      )}
    >
      {title && (
        <div className="flex items-center justify-between px-5 py-4">
          <div className="flex items-center gap-3">
            <div>
              <h3 className="text-xl font-bold tracking-tight text-foreground">
                {title}
              </h3>
              {subtitle && (
                <p className="mt-1 font-sans text-xs text-muted-foreground">
                  {subtitle}
                </p>
              )}
            </div>
          </div>
          {headerRight}
        </div>
      )}

      <div className="p-5">{children}</div>
    </div>
  );
}

interface StatCardProps {
  label: string;
  value: string | number;
  change?: number;
  unit?: string;
  variant?: "default" | "positive" | "negative";
}

export function StatCard({
  label,
  value,
  change,
  unit,
  variant = "default",
}: StatCardProps) {
  return (
    <div className="rounded-lg bg-card p-4">
      <div className="mb-2 text-[14px] font-medium tracking-[0.06em] text-muted-foreground">
        {label}
      </div>
      <div className="flex items-baseline gap-1">
        <span
          className={cn(
            "tl-market-number text-2xl leading-none",
            variant === "positive" && "text-neon-green",
            variant === "negative" && "text-neon-red",
            variant === "default" && "text-foreground"
          )}
        >
          {value}
        </span>
        {unit && (
          <span className="font-mono text-[14px] text-muted-foreground">{unit}</span>
        )}
      </div>
      {change !== undefined && (
        <div
          className={cn(
            "mt-2 font-sans text-[14px] font-bold",
            change >= 0 ? "text-neon-green" : "text-neon-red"
          )}
        >
          {change >= 0 ? "+" : ""}
          {change.toFixed(2)}%
        </div>
      )}
    </div>
  );
}
