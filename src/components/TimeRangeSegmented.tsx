import { cn } from "@/lib/utils";

export type SegmentOption<T extends string> = {
  label: string;
  value: T;
};

export function TimeRangeSegmented<T extends string>({
  options,
  value,
  onChange,
  className,
  itemClassName,
  inverse = false,
}: {
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
  itemClassName?: string;
  inverse?: boolean;
}) {
  return (
    <div
      className={cn(
        "inline-flex w-fit items-center rounded-full p-[3px]",
        inverse ? "bg-white/10" : "bg-card",
        className
      )}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={cn(
              "h-7 rounded-full px-3 font-mono text-[11px] font-bold transition-all",
              inverse
                ? active
                  ? "bg-white text-black"
                  : "text-white hover:bg-white/10"
                : active
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              itemClassName
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
