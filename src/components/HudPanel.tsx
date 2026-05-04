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
  const borderColor =
    variant === "highlight"
      ? "border-neon-cyan/40"
      : variant === "danger"
        ? "border-neon-red/40"
        : "border-border/50";

  const cornerColor =
    variant === "highlight"
      ? "bg-neon-cyan"
      : variant === "danger"
        ? "bg-neon-red"
        : "bg-neon-pink";

  return (
    <div
      className={cn(
        "relative bg-card/80 backdrop-blur-sm border rounded-sm overflow-hidden",
        borderColor,
        className
      )}
    >
      {/* Corner brackets */}
      <div className={cn("absolute top-0 left-0 w-3 h-[2px]", cornerColor)} />
      <div className={cn("absolute top-0 left-0 w-[2px] h-3", cornerColor)} />
      <div className={cn("absolute top-0 right-0 w-3 h-[2px]", cornerColor)} />
      <div className={cn("absolute top-0 right-0 w-[2px] h-3", cornerColor)} />
      <div className={cn("absolute bottom-0 left-0 w-3 h-[2px]", cornerColor)} />
      <div className={cn("absolute bottom-0 left-0 w-[2px] h-3", cornerColor)} />
      <div className={cn("absolute bottom-0 right-0 w-3 h-[2px]", cornerColor)} />
      <div className={cn("absolute bottom-0 right-0 w-[2px] h-3", cornerColor)} />

      {title && (
        <div className="flex items-center justify-between px-4 py-3 border-b border-border/30">
          <div className="flex items-center gap-3">
            <div className={cn("w-1.5 h-1.5 rounded-full", cornerColor)} />
            <div>
              <h3 className="font-display text-xs font-bold tracking-wider uppercase text-foreground">
                {title}
              </h3>
              {subtitle && (
                <p className="text-[10px] font-mono text-muted-foreground mt-0.5">
                  {subtitle}
                </p>
              )}
            </div>
          </div>
          {headerRight}
        </div>
      )}

      <div className="p-4">{children}</div>
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
    <div className="hud-frame p-3">
      <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider mb-1">
        {label}
      </div>
      <div className="flex items-baseline gap-1">
        <span
          className={cn(
            "font-display text-xl font-bold",
            variant === "positive" && "text-neon-green",
            variant === "negative" && "text-neon-red",
            variant === "default" && "text-neon-cyan"
          )}
        >
          {value}
        </span>
        {unit && (
          <span className="font-mono text-xs text-muted-foreground">{unit}</span>
        )}
      </div>
      {change !== undefined && (
        <div
          className={cn(
            "font-mono text-xs mt-1",
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
