import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { mockAuth, type MockUser } from "@/lib/mockAuth";
import { motion } from "framer-motion";

interface SignInModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (user: MockUser) => void;
}

export function SignInModal({ open, onOpenChange, onSuccess }: SignInModalProps) {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const result = mode === "signin"
        ? await mockAuth.signIn(email, password)
        : await mockAuth.createAccount(email, password);

      if (result.success && result.user) {
        toast({
          title: mode === "signin" ? "Signed in successfully" : "Account created successfully",
          description: `Welcome ${result.user.email}`,
        });
        onSuccess(result.user);
        onOpenChange(false);
        setEmail("");
        setPassword("");
      } else {
        toast({
          variant: "destructive",
          title: "Error",
          description: result.error || "Authentication failed",
        });
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "An unexpected error occurred",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md card-glass">
        <div className="gloss-sheen" />
        
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold metal-text">
            {mode === "signin" ? "Sign In" : "Create Account"}
          </DialogTitle>
        </DialogHeader>

        <motion.form
          onSubmit={handleSubmit}
          className="space-y-4 relative z-10"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading}
              data-testid="input-email"
              className="bg-background/50"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={loading}
              data-testid="input-password"
              className="bg-background/50"
            />
          </div>

          {mode === "signup" && (
            <p className="text-sm text-muted-foreground">
              In mock mode, any email/password combination works
            </p>
          )}

          <div className="flex flex-col gap-2 pt-2">
            <Button
              type="submit"
              disabled={loading}
              data-testid={mode === "signin" ? "button-signin" : "button-signup"}
              className="w-full"
            >
              {loading ? "Loading..." : mode === "signin" ? "Sign In" : "Create Account"}
            </Button>

            <Button
              type="button"
              variant="ghost"
              onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
              disabled={loading}
              data-testid="button-toggle-mode"
              className="w-full"
            >
              {mode === "signin" 
                ? "Need an account? Sign up" 
                : "Already have an account? Sign in"}
            </Button>
          </div>
        </motion.form>
      </DialogContent>
    </Dialog>
  );
}
