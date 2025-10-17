import { useState } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { mockAuth, type MockUser } from "@/lib/mockAuth";
import { motion } from "framer-motion";
import { SiGoogle, SiApple, SiFacebook, SiGithub } from "react-icons/si";
import { FaXTwitter } from "react-icons/fa6";

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
      const result =
        mode === "signin"
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
    } catch {
      toast({
        variant: "destructive",
        title: "Error",
        description: "An unexpected error occurred",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleOAuthSignIn = async (provider: string) => {
    setLoading(true);
    try {
      const mockEmail = `demo-${provider}@ybuilt.com`;
      const result = await mockAuth.signIn(mockEmail, "mock-oauth-password");
      if (result.success && result.user) {
        toast({
          title: `Signed in with ${provider}`,
          description: `Welcome ${result.user.email}`,
        });
        onSuccess(result.user);
        onOpenChange(false);
      }
    } catch {
      toast({
        variant: "destructive",
        title: "Error",
        description: `${provider} sign-in failed`,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        {/* Softer overlay that still receives clicks */}
        <DialogOverlay className="fixed inset-0 z-[900] bg-black/25 backdrop-blur-[1px] data-[state=open]:animate-in data-[state=closed]:animate-out" />

        {/* Non-interactive wrapper that centers the card */}
        <div className="fixed inset-0 z-[1000] grid place-items-center p-4 pointer-events-none">
          {/* Make the Content just the card, NOT full-screen */}
          <DialogPrimitive.Content
            className="
              pointer-events-auto
              w-[92vw] max-w-md max-h-[85vh] overflow-y-auto
              rounded-2xl border bg-background p-4 sm:p-6 shadow-2xl
              outline-none
            "
            data-state={open ? "open" : "closed"}
            onCloseAutoFocus={(e) => e.preventDefault()}
          >
            <DialogHeader>
              <DialogTitle className="text-2xl font-bold">
                {mode === "signin" ? "Sign In" : "Create Account"}
              </DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground">
                Use a provider or continue with email.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6">
              {/* OAuth */}
              <div className="space-y-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleOAuthSignIn("Google")}
                  disabled={loading}
                  data-testid="button-oauth-google"
                  className="w-full gap-3 hover-elevate"
                  aria-label="Sign in with Google"
                >
                  <SiGoogle className="h-5 w-5" />
                  Sign in with Google
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleOAuthSignIn("Apple")}
                  disabled={loading}
                  data-testid="button-oauth-apple"
                  className="w-full gap-3 hover-elevate"
                  aria-label="Sign in with Apple"
                >
                  <SiApple className="h-5 w-5" />
                  Sign in with Apple
                </Button>

                <div className="grid grid-cols-3 gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => handleOAuthSignIn("Facebook")}
                    disabled={loading}
                    data-testid="button-oauth-facebook"
                    className="gap-2 hover-elevate"
                    aria-label="Sign in with Facebook"
                  >
                    <SiFacebook className="h-4 w-4" />
                    <span className="hidden sm:inline">Facebook</span>
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => handleOAuthSignIn("Twitter")}
                    disabled={loading}
                    data-testid="button-oauth-twitter"
                    className="gap-2 hover-elevate"
                    aria-label="Sign in with Twitter"
                  >
                    <FaXTwitter className="h-4 w-4" />
                    <span className="hidden sm:inline">Twitter</span>
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => handleOAuthSignIn("GitHub")}
                    disabled={loading}
                    data-testid="button-oauth-github"
                    className="gap-2 hover-elevate"
                    aria-label="Sign in with GitHub"
                  >
                    <SiGithub className="h-4 w-4" />
                    <span className="hidden sm:inline">GitHub</span>
                  </Button>
                </div>
              </div>

              <div className="relative">
                <Separator />
                <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-background px-2 text-xs text-muted-foreground">
                  Or continue with email
                </span>
              </div>

              {/* Email/Password */}
              <motion.form
                onSubmit={handleSubmit}
                className="space-y-4"
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
            </div>
          </DialogPrimitive.Content>
        </div>
      </DialogPortal>
    </Dialog>
  );
}
