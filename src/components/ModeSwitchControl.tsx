import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { Wallet, Zap } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";

type ModeSwitchControlProps = {
  mode: "lite" | "pro";
  className?: string;
};

const REVEAL_UNTIL_KEY = "tradelabModeSwitchRevealUntil";
const REVEAL_AFTER_SWITCH_MS = 500;
const NAVIGATE_AFTER_SWITCH_MS = 180;

export function ModeSwitchControl({ mode, className }: ModeSwitchControlProps) {
  const [, setLocation] = useLocation();
  const isPro = mode === "pro";
  const [checked, setChecked] = useState(isPro);
  const navigateTimerRef = useRef<number | null>(null);

  useEffect(() => {
    setChecked(isPro);
  }, [isPro]);

  useEffect(() => {
    return () => {
      if (navigateTimerRef.current !== null) {
        window.clearTimeout(navigateTimerRef.current);
      }
    };
  }, []);

  const handleModeChange = (checked: boolean) => {
    const nextMode = checked ? "pro" : "lite";
    setChecked(checked);
    try {
      localStorage.setItem("tradelabMode", nextMode);
      sessionStorage.setItem(
        REVEAL_UNTIL_KEY,
        String(Date.now() + REVEAL_AFTER_SWITCH_MS)
      );
    } catch {}
    if (navigateTimerRef.current !== null) {
      window.clearTimeout(navigateTimerRef.current);
    }
    navigateTimerRef.current = window.setTimeout(() => {
      setLocation(checked ? "/" : "/lite");
    }, NAVIGATE_AFTER_SWITCH_MS);
  };

  return (
    <div
      className={cn("flex h-9 items-center gap-2 rounded-md px-2", className)}
    >
      <div className="flex min-w-[72px] items-center gap-1.5 font-sans text-sm font-bold leading-none text-foreground">
        {isPro ? <Zap className="size-3.5" /> : <Wallet className="size-3.5" />}
        <span>{isPro ? "프로 모드" : "라이트 모드"}</span>
      </div>
      <Switch
        checked={checked}
        onCheckedChange={handleModeChange}
        aria-label={isPro ? "라이트 모드로 전환" : "프로 모드로 전환"}
        className={cn(
          "h-7 w-12 rounded-md border-0 p-[3px] shadow-none",
          "transition-all duration-200",
          "data-[state=unchecked]:bg-[#e8e8e8] data-[state=checked]:bg-primary",
          "focus-visible:ring-2 focus-visible:ring-ring/30"
        )}
        thumbClassName={cn(
          "size-[22px] rounded-[8px] bg-card shadow-none transition-transform duration-200 ease-out",
          "data-[state=unchecked]:translate-x-0 data-[state=checked]:translate-x-5"
        )}
      />
    </div>
  );
}
