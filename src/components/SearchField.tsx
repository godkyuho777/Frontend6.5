import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Search } from "lucide-react";
import type * as React from "react";

type SearchFieldProps = Omit<React.ComponentProps<typeof Input>, "type"> & {
  shortcut?: string;
  wrapperClassName?: string;
  surface?: "muted" | "transparent";
};

export function SearchField({
  className,
  shortcut,
  wrapperClassName,
  surface = "muted",
  ...props
}: SearchFieldProps) {
  return (
    <div
      className={cn(
        "flex h-9 min-w-0 items-center gap-2 rounded-md px-3",
        surface === "muted" ? "bg-muted" : "bg-transparent hover:bg-muted",
        wrapperClassName
      )}
    >
      <Search className="size-4 shrink-0 text-muted-foreground" />
      <Input
        type="search"
        className={cn(
          "h-8 min-w-0 flex-1 rounded-none border-0 bg-transparent p-0 font-sans text-sm leading-8 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0",
          className
        )}
        {...props}
      />
      {shortcut ? (
        <span className="shrink-0 font-sans text-sm font-medium text-muted-foreground">
          {shortcut}
        </span>
      ) : null}
    </div>
  );
}
