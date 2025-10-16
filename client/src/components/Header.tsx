import { Moon, Sun, Sparkles, Library } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link, useLocation } from "wouter";
import LogoButton from "./LogoButton";
import PaymentButton from "./PaymentButton";
import CurrencyToggle from "./CurrencyToggle";
import ProfileIcon from "./ProfileIcon";
import { useState, useEffect } from "react";

interface HeaderProps {
  logSummary?: {
    status: "success" | "error" | "building";
    lastBuild: string;
  };
  workspaceName?: string;
  onThemeModalOpen?: () => void;
}

export default function Header({
  logSummary,
  workspaceName,
  onThemeModalOpen,
}: HeaderProps) {
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  const [lowGloss, setLowGloss] = useState(false);
  const [currency, setCurrency] = useState<"INR" | "USD">("INR");
  const [location] = useLocation();

  const isWorkspace = location.startsWith("/workspace/");
  const isHome = location === "/";
  const isLibrary = location.startsWith("/library");
  const isSettings = location.startsWith("/settings");

  useEffect(() => {
    const savedTheme = localStorage.getItem("theme") as "light" | "dark" | null;
    const savedLowGloss = localStorage.getItem("lowGloss") === "true";

    if (savedTheme) {
      setTheme(savedTheme);
      if (savedTheme === "dark") {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
    } else {
      setTheme("dark");
      document.documentElement.classList.add("dark");
    }

    if (savedLowGloss) {
      setLowGloss(true);
      document.documentElement.classList.add("low-gloss");
    }
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === "dark" ? "light" : "dark";
    setTheme(newTheme);
    if (newTheme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
    localStorage.setItem("theme", newTheme);
  };

  const toggleLowGloss = () => {
    const newLowGloss = !lowGloss;
    setLowGloss(newLowGloss);
    if (newLowGloss) {
      document.documentElement.classList.add("low-gloss");
    } else {
      document.documentElement.classList.remove("low-gloss");
    }
    localStorage.setItem("lowGloss", String(newLowGloss));
  };

  const amount = currency === "INR" ? 799 : 10;

  const handleLogout = () => {
    localStorage.removeItem("user");
    window.location.href = "/";
  };

  const workspaceId = isWorkspace ? location.split("/")[2] : undefined;
  const currentProjectPath = workspaceId ? `/workspace/${workspaceId}` : undefined;

  return (
    <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      {/* Centered, responsive container with sane side paddings */}
      <div className="mx-auto w-full max-w-7xl px-3 sm:px-6 lg:px-8">
        {/* Row: logo left, actions right */}
        <div className="flex h-14 md:h-16 items-center justify-between gap-2">
          {/* LEFT: Logo / launcher */}
          <div className="shrink-0">
            <LogoButton
              currentProjectName={workspaceName}
              currentProjectPath={currentProjectPath}
              onThemeToggle={toggleTheme}
              onLogout={handleLogout}
              isWorkspace={isWorkspace}
              onThemeModalOpen={onThemeModalOpen}
              isHome={isHome}
              isLibrary={isLibrary}
              isSettings={isSettings}
            />
          </div>

          {/* RIGHT (desktop) */}
          <nav className="hidden md:flex items-center gap-2">
            {isWorkspace && logSummary && (
              <Badge
                variant={
                  logSummary.status === "success"
                    ? "default"
                    : logSummary.status === "error"
                    ? "destructive"
                    : "secondary"
                }
                className="gap-1.5"
                data-testid="badge-log-summary"
              >
                <span className="text-xs">
                  Build: {logSummary.status} • Last: {logSummary.lastBuild}
                </span>
              </Badge>
            )}

            <Button
              variant="ghost"
              size="sm"
              className="gap-2 whitespace-nowrap"
              data-testid="button-library"
              aria-label="Library"
              asChild
            >
              <Link href="/library">
                <Library className="h-4 w-4" />
                <span>Library</span>
              </Link>
            </Button>

            {/* Keep payment visible on desktop only to avoid crowding on mobile */}
            <div className="hidden md:inline-flex">
              <PaymentButton amount={amount} currency={currency} />
            </div>

            <CurrencyToggle onCurrencyChange={setCurrency} />

            <Button
              size="icon"
              variant="ghost"
              onClick={toggleLowGloss}
              data-testid="button-toggle-gloss"
              aria-label="Toggle low gloss mode"
              title="Toggle low gloss / high contrast mode"
            >
              <Sparkles className="h-5 w-5" />
            </Button>

            <Button
              size="icon"
              variant="ghost"
              onClick={toggleTheme}
              data-testid="button-toggle-theme"
              aria-label="Toggle theme"
            >
              {theme === "dark" ? (
                <Sun className="h-5 w-5" />
              ) : (
                <Moon className="h-5 w-5" />
              )}
            </Button>

            <ProfileIcon />
          </nav>

          {/* RIGHT (mobile) — compact so nothing overflows */}
          <div className="md:hidden flex items-center gap-1">
            <Button variant="ghost" size="icon" asChild aria-label="Library">
              <Link href="/library">
                <Library className="h-4 w-4" />
              </Link>
            </Button>
            <CurrencyToggle onCurrencyChange={setCurrency} />
            <Button
              size="icon"
              variant="ghost"
              onClick={toggleLowGloss}
              aria-label="Toggle low gloss mode"
              title="Toggle low gloss / high contrast mode"
            >
              <Sparkles className="h-5 w-5" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              onClick={toggleTheme}
              aria-label="Toggle theme"
            >
              {theme === "dark" ? (
                <Sun className="h-5 w-5" />
              ) : (
                <Moon className="h-5 w-5" />
              )}
            </Button>
            <ProfileIcon />
          </div>
        </div>
      </div>
    </header>
  );
}
