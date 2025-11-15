// client/src/components/ProfileIcon.tsx
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import {
  User2,
  LogIn,
  LogOut,
  Settings,
  Crown,
  Gift,
  HelpCircle,
  Moon,
  ChevronRight,
  Check,
  Plus,
} from "lucide-react";
import { SignInModal } from "./SignInModal";
import { mockAuth, type MockUser } from "@/lib/mockAuth";

type ProfileIconProps = {
  /** Optional: open a dedicated appearance / theme modal from outside */
  onOpenAppearance?: () => void;
};

export default function ProfileIcon({ onOpenAppearance }: ProfileIconProps) {
  const [openSignIn, setOpenSignIn] = useState(false);
  const [user, setUser] = useState<MockUser | null>(null);

  // Load current user on mount (mock mode)
  useEffect(() => {
    (async () => {
      const u = await mockAuth.getCurrentUser();
      setUser(u);
      // keep localStorage in sync so other tabs/pages can read it if needed
      if (u) localStorage.setItem("user", JSON.stringify(u));
      else localStorage.removeItem("user");
    })();
  }, []);

  const isAuthed = useMemo(() => Boolean(user?.email), [user]);

  function handleLogout() {
    mockAuth.signOut();
    setUser(null);
    localStorage.removeItem("user");
  }

  function handleSignInSuccess(u: MockUser) {
    setUser(u);
    localStorage.setItem("user", JSON.stringify(u));
  }

  // “Appearance” handler – either open an external modal or just toggle theme
  function handleAppearance() {
    if (onOpenAppearance) {
      onOpenAppearance();
      return;
    }

    const root = document.documentElement;
    const isDark = root.classList.contains("dark");

    if (isDark) {
      root.classList.remove("dark");
      localStorage.setItem("theme", "light");
    } else {
      root.classList.add("dark");
      localStorage.setItem("theme", "dark");
    }
  }

  const workspaceName = "Your's Ybuilt";
  const avatarInitial =
    (user?.displayName || user?.email || "Y").trim().charAt(0).toUpperCase() ||
    "Y";

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          {/* square, centered, no stray padding */}
          <Button
            variant="secondary"
            size="icon"
            aria-label="Open profile menu"
            className="h-9 w-9 md:h-10 md:w-10 rounded-xl p-0 grid place-items-center shadow-sm"
            data-testid="button-profile"
          >
            <User2 className="h-5 w-5" />
          </Button>
        </DropdownMenuTrigger>

        {/* ensure this renders above sticky header and chat dock */}
        <DropdownMenuContent
          align="end"
          sideOffset={8}
          collisionPadding={16}
          className="z-[500] w-[320px] rounded-2xl border border-white/10 bg-[#1C1C1C] p-0 shadow-xl"
        >
          {!isAuthed ? (
            <>
              <DropdownMenuLabel className="px-4 py-3 text-sm font-medium">
                Account
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={() => setOpenSignIn(true)}
                className="gap-2 cursor-pointer px-4 py-2 text-sm"
                data-testid="menu-item-signin"
              >
                <LogIn className="h-4 w-4" />
                <span>Sign in</span>
              </DropdownMenuItem>
            </>
          ) : (
            <>
              {/* Top profile header: avatar + “Your's Ybuilt” + email */}
              <div className="px-4 pt-3 pb-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500 to-pink-500 text-sm font-semibold text-white">
                    {avatarInitial}
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm font-semibold text-neutral-50">
                      {workspaceName}
                    </span>
                    <span className="text-xs text-neutral-400">
                      {user?.email}
                    </span>
                  </div>
                </div>
              </div>

              {/* Turn Pro / Upgrade card */}
              <div className="px-4 pb-3">
                <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10">
                      <Crown className="h-4 w-4 text-yellow-300" />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-sm font-medium text-neutral-50">
                        Turn Pro
                      </span>
                      <span className="text-xs text-neutral-400">
                        Unlock more AI, cloud & collab.
                      </span>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    className="rounded-lg bg-[#4338CA] px-3 py-1 text-xs font-medium text-white hover:bg-[#4F46E5]"
                    onClick={(e) => {
                      // Pricing flow to be wired later
                      e.preventDefault();
                    }}
                  >
                    Upgrade
                  </Button>
                </div>
              </div>

              {/* Settings + Invite buttons */}
              <div className="flex gap-2 px-4 pb-3">
                <Button
                  variant="outline"
                  className="flex-1 justify-start gap-2 rounded-xl border-white/10 bg-white/5 text-sm text-neutral-100 hover:bg-white/10"
                  asChild
                >
                  <a href="/settings">
                    <Settings className="h-4 w-4" />
                    <span>Settings</span>
                  </a>
                </Button>
                <Button
                  variant="outline"
                  className="flex-1 justify-start gap-2 rounded-xl border-white/10 bg-white/5 text-sm text-neutral-100 hover:bg-white/10"
                  onClick={() => {
                    // Hook up real invite flow later
                  }}
                >
                  <User2 className="h-4 w-4" />
                  <span>Invite</span>
                </Button>
              </div>

              <DropdownMenuSeparator className="my-1 border-white/10" />

              {/* Workspaces section */}
              <div className="px-4 py-2">
                <div className="mb-2 flex items-center justify-between text-xs font-medium text-neutral-500">
                  <span>Workspaces</span>
                  <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-white/10 text-[10px] text-neutral-200">
                    1
                  </span>
                </div>

                {/* Current workspace */}
                <button className="flex w-full items-center justify-between rounded-xl bg-white/5 px-3 py-2 text-sm text-neutral-100">
                  <div className="flex items-center gap-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-orange-500 text-xs font-semibold text-white">
                      {avatarInitial}
                    </div>
                    <div className="flex flex-col items-start">
                      <span>{workspaceName}</span>
                      <span className="text-[11px] text-neutral-400">FREE</span>
                    </div>
                  </div>
                  <Check className="h-4 w-4 text-emerald-400" />
                </button>

                {/* Create workspace */}
                <button className="mt-2 flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-neutral-200 hover:bg-white/5">
                  <Plus className="h-4 w-4" />
                  <span>Create new workspace</span>
                </button>
              </div>

              <DropdownMenuSeparator className="my-1 border-white/10" />

              {/* Utility links */}
              <DropdownMenuItem
                className="gap-2 cursor-pointer px-4 py-2 text-sm text-blue-400"
                onSelect={(e) => {
                  e.preventDefault();
                  // wire to real credits page later
                  window.open("/credits", "_blank");
                }}
              >
                <Gift className="h-4 w-4" />
                <span>Get free credits</span>
              </DropdownMenuItem>

              <DropdownMenuItem
                className="gap-2 cursor-pointer px-4 py-2 text-sm"
                onSelect={(e) => {
                  e.preventDefault();
                  window.open("/help", "_blank");
                }}
              >
                <HelpCircle className="h-4 w-4" />
                <span>Help Center</span>
              </DropdownMenuItem>

              <DropdownMenuItem
                className="gap-2 cursor-pointer px-4 py-2 text-sm"
                onSelect={(e) => {
                  e.preventDefault();
                  handleAppearance();
                }}
              >
                <Moon className="h-4 w-4" />
                <span>Appearance</span>
                <ChevronRight className="ml-auto h-4 w-4 opacity-60" />
              </DropdownMenuItem>

              <DropdownMenuSeparator className="my-1 border-white/10" />

              <DropdownMenuItem
                onSelect={(e) => {
                  e.preventDefault();
                  handleLogout();
                }}
                className="gap-2 cursor-pointer px-4 py-2 text-sm text-red-400 focus:text-red-400"
                data-testid="menu-item-signout"
              >
                <LogOut className="h-4 w-4" />
                <span>Sign out</span>
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Pass onSuccess so TS stops complaining and state updates */}
      <SignInModal
        open={openSignIn}
        onOpenChange={setOpenSignIn}
        onSuccess={handleSignInSuccess}
      />
    </>
  );
}
