import { useState, type ReactNode, type FormEvent } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

type SignInDialogProps = {
  children: ReactNode;
};

export function SignInDialog({ children }: SignInDialogProps) {
  const { signInWithEmail } = useAuth();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email || submitting) return;
    setSubmitting(true);
    try {
      await signInWithEmail(email);
      setSent(true);
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : "로그인 링크 전송에 실패했습니다."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) {
      setEmail("");
      setSent(false);
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display tracking-wider">
            로그인
          </DialogTitle>
          <DialogDescription className="font-mono text-xs">
            일회용 로그인 링크를 이메일로 보내드립니다.
          </DialogDescription>
        </DialogHeader>
        {sent ? (
          <div className="space-y-2 py-4">
            <p className="font-sans text-sm">
              <span className="text-primary break-all">{email}</span> 로
              로그인 링크를 보냈습니다.
            </p>
            <p className="font-sans text-xs text-muted-foreground">
              메일의 링크를 클릭하면 로그인이 완료됩니다. 이 창은 닫으셔도
              됩니다.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="signin-email" className="font-sans text-xs">
                이메일
              </Label>
              <Input
                id="signin-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoFocus
                required
              />
            </div>
            <DialogFooter>
              <Button
                type="submit"
                disabled={submitting || !email}
                className="w-full"
              >
                {submitting ? "전송 중..." : "로그인 링크 받기"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
