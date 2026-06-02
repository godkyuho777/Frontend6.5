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
  // 접근성 이름 보장 — placeholder 는 스크린리더의 신뢰할 수 있는 라벨이 아니다.
  // 호출부가 aria-label / aria-labelledby 를 주지 않으면 placeholder(또는 "검색")
  // 를 기본 aria-label 로 사용한다. 명시적 라벨이 있으면 {...props} 가 덮어쓴다.
  const hasExplicitLabel =
    props["aria-label"] != null || props["aria-labelledby"] != null;
  const fallbackLabel =
    typeof props.placeholder === "string" && props.placeholder.trim().length > 0
      ? props.placeholder
      : "검색";
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
        aria-label={hasExplicitLabel ? undefined : fallbackLabel}
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
