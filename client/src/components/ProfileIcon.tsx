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
import { User2, LogIn, LogOut, Settings } from "lucide-react";
import { SignInModal } from "./SignInModal";
import { mockAuth, type MockUser } from "@/lib/mockAuth";

export default function ProfileIcon() {
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
          className="z-[500] min-w-[220px]"
        >
          <DropdownMenuLabel>
            {isAuthed ? user?.email : "Account"}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />

          {!isAuthed ? (
            <DropdownMenuItem
              onSelect={() => setOpenSignIn(true)}
              className="gap-2 cursor-pointer"
              data-testid="menu-item-signin"
            >
              <LogIn className="h-4 w-4" />
              <span>Sign in</span>
            </DropdownMenuItem>
          ) : (
            <>
              <DropdownMenuItem asChild className="gap-2 cursor-pointer">
                <a href="/settings">
                  <Settings className="h-4 w-4" />
                  <span>Settings</span>
                </a>
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={handleLogout}
                className="gap-2 cursor-pointer"
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
