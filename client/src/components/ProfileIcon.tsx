import { useState, useEffect } from "react";
import { User, Settings, LogOut, LogIn, CreditCard } from "lucide-react";
import { useLocation } from "wouter";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { SignInModal } from "./SignInModal";
import { mockAuth, type MockUser } from "@/lib/mockAuth";
import { useToast } from "@/hooks/use-toast";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

export default function ProfileIcon() {
  const [, setLocation] = useLocation();
  const [currentUser, setCurrentUser] = useState<MockUser | null>(null);
  const [showSignIn, setShowSignIn] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    // Load current user on mount
    const loadUser = async () => {
      const user = await mockAuth.getCurrentUser();
      setCurrentUser(user);
    };
    loadUser();
  }, []);

  const handleSelect = (path: string) => {
    if (path === "signout") {
      mockAuth.signOut();
      setCurrentUser(null);
      toast({
        title: "Signed out successfully",
        description: "You have been signed out of your account",
      });
      return;
    }
    if (path === "signin") {
      setShowSignIn(true);
      return;
    }
    setLocation(path);
  };

  const handleSignInSuccess = (user: MockUser) => {
    setCurrentUser(user);
  };

  // Get user initials for avatar from email
  const getUserInitials = () => {
    if (!currentUser) return "?";
    // Get first 2 characters from email (before @)
    const emailPart = currentUser.email.split('@')[0];
    return emailPart.substring(0, 2).toUpperCase();
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full card-glass w-9 h-9"
            data-testid="button-profile"
            aria-label="Profile menu"
          >
            <div className="gloss-sheen rounded-full" />
            {currentUser ? (
              <Avatar className="h-7 w-7 relative z-10">
                <AvatarFallback className="bg-primary/20 text-primary text-xs font-semibold">
                  {getUserInitials()}
                </AvatarFallback>
              </Avatar>
            ) : (
              <User className="h-4 w-4 relative z-10" />
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56 card-glass">
          <div className="gloss-sheen" />
          {currentUser ? (
            <>
              <DropdownMenuLabel className="relative z-10">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none">{currentUser.email}</p>
                  <p className="text-xs leading-none text-muted-foreground">ID: {currentUser.id}</p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={() => handleSelect("/library")}
                className="cursor-pointer relative z-10"
                data-testid="menu-item-library"
              >
                <User className="mr-2 h-4 w-4" />
                My Library
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => handleSelect("/settings")}
                className="cursor-pointer relative z-10"
                data-testid="menu-item-settings"
              >
                <Settings className="mr-2 h-4 w-4" />
                Settings
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => handleSelect("/settings/billing")}
                className="cursor-pointer relative z-10"
                data-testid="menu-item-manage-billing"
              >
                <CreditCard className="mr-2 h-4 w-4" />
                Manage Billing
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={() => handleSelect("signout")}
                className="cursor-pointer relative z-10"
                data-testid="menu-item-signout"
              >
                <LogOut className="mr-2 h-4 w-4" />
                Sign Out
              </DropdownMenuItem>
            </>
          ) : (
            <>
              <DropdownMenuLabel className="relative z-10">Account</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={() => handleSelect("signin")}
                className="cursor-pointer relative z-10"
                data-testid="menu-item-signin"
              >
                <LogIn className="mr-2 h-4 w-4" />
                Sign In
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <SignInModal
        open={showSignIn}
        onOpenChange={setShowSignIn}
        onSuccess={handleSignInSuccess}
      />
    </>
  );
}
