import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Loader2, RefreshCw } from "lucide-react";
import type { ComponentProps } from "react";

type RefreshIconButtonProps = Omit<
  ComponentProps<typeof Button>,
  "aria-label" | "children" | "size" | "variant"
> & {
  label: string;
  isLoading?: boolean;
  inverse?: boolean;
};

export function RefreshIconButton({
  label,
  isLoading = false,
  inverse = false,
  className,
  disabled,
  ...props
}: RefreshIconButtonProps) {
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      aria-label={label}
      disabled={disabled || isLoading}
      className={cn(
        inverse
          ? "bg-background/10 text-background hover:bg-background/20"
          : "bg-muted text-foreground hover:bg-muted/80",
        className
      )}
      {...props}
    >
      {isLoading ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <RefreshCw className="size-4" />
      )}
    </Button>
  );
}
