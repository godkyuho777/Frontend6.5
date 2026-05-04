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
        err instanceof Error ? err.message : "Failed to send sign-in link"
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
            Sign in
          </DialogTitle>
          <DialogDescription className="font-mono text-xs">
            We'll email you a one-time sign-in link.
          </DialogDescription>
        </DialogHeader>
        {sent ? (
          <div className="space-y-2 py-4">
            <p className="font-mono text-sm">
              Check{" "}
              <span className="text-neon-cyan break-all">{email}</span>{" "}
              for a sign-in link.
            </p>
            <p className="font-mono text-xs text-muted-foreground">
              Click the link to complete sign-in. You can close this dialog.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="signin-email" className="font-mono text-xs">
                Email
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
                className="bg-neon-pink/20 border border-neon-pink text-neon-pink hover:bg-neon-pink/30"
              >
                {submitting ? "Sending..." : "Send sign-in link"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
