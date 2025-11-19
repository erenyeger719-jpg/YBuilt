// client/src/components/Header.tsx
import { Library, Settings as SettingsIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link, useLocation } from "wouter";
import LogoButton from "./LogoButton";
import ProfileIcon from "./ProfileIcon";
import { useState, useEffect } from "react";
import { getSession, switchTeam } from "@/lib/session";
import InviteDialog from "@/components/teams/InviteDialog";
import SettingsModal from "@/components/SettingsModal";

interface HeaderProps {
  logSummary?: {
    status: "success" | "error" | "building";
    lastBuild: string;
  };
  workspaceName?: string;
  onThemeModalOpen?: () => void;
}

/** Minimal team switcher for the header's right side */
function TeamSwitcher() {
  const [loading, setLoading] = useState(true);
  const [teams, setTeams] = useState<any[]>([]);
  const [current, setCurrent] = useState<any>(null);

  useEffect(() => {
    (async () => {
      try {
        const s = await getSession();
        setTeams(s?.teams || []);
        setCurrent(s?.currentTeam || null);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return null;

  return (
    <select
      className="text-xs border rounded px-2 py-1 bg-transparent"
      value={current?.id || (teams[0]?.id ?? "")}
      onChange={async (e) => {
        const id = e.target.value;
        try {
          if (id === "__create__") {
            const name = prompt("Team name?")?.trim();
            if (!name) return;
            await fetch("/api/teams", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ name }),
            });
            window.location.reload();
            return;
          }
          await switchTeam(id);
        } finally {
          window.location.reload(); // simplest: refresh UI scoped to team
        }
      }}
      aria-label="Switch team"
      title="Switch team"
    >
      {teams.length ? (
        <>
          {teams.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
          <option value="__create__">+ Create team…</option>
        </>
      ) : (
        <>
          <option value="">(no team)</option>
          <option value="__create__">+ Create team…</option>
        </>
      )}
    </select>
  );
}

export default function Header({
  logSummary,
  workspaceName,
  onThemeModalOpen,
}: HeaderProps) {
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [location] = useLocation();
  const [atTop, setAtTop] = useState(true);

  const isWorkspace = location.startsWith("/workspace/");
  const isHome = location === "/";
  const isLibrary = location.startsWith("/library");
  const isSettings = location.startsWith("/settings");

  useEffect(() => {
    const savedTheme = localStorage.getItem("theme") as
      | "light"
      | "dark"
      | null;
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

    // still honour previously saved low-gloss mode if it exists
    if (savedLowGloss) {
      document.documentElement.classList.add("low-gloss");
    }
  }, []);

  // track whether header is at the very top (hero start) or scrolled
  useEffect(() => {
    const onScroll = () => {
      setAtTop(window.scrollY < 8);
    };
    onScroll(); // initialise
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
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

  const handleLogout = () => {
    localStorage.removeItem("user");
    window.location.href = "/";
  };

  const workspaceId = isWorkspace ? location.split("/")[2] : undefined;
  const currentProjectPath = workspaceId ? `/workspace/${workspaceId}` : undefined;

  // solid at top, glass once scrolled
  const baseHeaderClasses =
    "sticky top-0 z-[50] border-b transition-colors duration-300";
  const solidClasses =
    theme === "dark"
      ? "bg-[#1B1B1B] text-white border-white/10"
      : "bg-white text-black border-neutral-200";
  const glassClasses =
    "bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60";

  // 🟣 NEW: in dark mode, force header/nav text to stay white everywhere
  const navTextClass = theme === "dark" ? "text-white" : "";

  return (
    <header
      data-header
      className={`${baseHeaderClasses} ${atTop ? solidClasses : glassClasses}`}
    >
      {/* Full-width container with tighter side padding */}
      <div className="w-full px-2 sm:px-4 lg:px-6">
        {/* Row: logo left, actions right */}
        <div className="flex h-14 md:h-16 items-center justify-between gap-2">
          {/* LEFT: Logo / launcher */}
          <div className="shrink-0 -ml-2 sm:-ml-3">
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
          <nav className="hidden md:flex items-center gap-2 -mr-2 sm:-mr-3">
            {isWorkspace && logSummary && (
              <Badge
                variant={
                  logSummary.status === "success"
                    ? "default"
                    : logSummary.status === "error"
                    ? "destructive"
                    : "secondary"
                }
                className={`gap-1.5 ${navTextClass}`}
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
              className={`gap-2 whitespace-nowrap ${navTextClass}`}
              data-testid="button-library"
              aria-label="Library"
              asChild
            >
              <Link href="/library">
                <Library className="h-4 w-4" />
                <span>Library</span>
              </Link>
            </Button>

            {/* Team nav next to Library */}
            <Button
              variant="ghost"
              size="sm"
              className={navTextClass}
              asChild
            >
              <Link href="/team">Team</Link>
            </Button>

            {/* Team switcher (minimal) */}
            <div className={navTextClass}>
              <TeamSwitcher />
            </div>
            <div className={navTextClass}>
              <InviteDialog />
            </div>

            {/* Settings (opens modal) */}
            <Button
              variant="ghost"
              size="sm"
              className={`gap-2 ${navTextClass}`}
              onClick={() => setSettingsOpen(true)}
              data-testid="button-settings"
              aria-label="Open settings"
              title="Settings"
            >
              <SettingsIcon className="h-4 w-4" />
              <span>Settings</span>
            </Button>

            {/* Clean, simple end cap */}
            <div className={navTextClass}>
              <ProfileIcon />
            </div>
          </nav>

          {/* RIGHT (mobile) — compact so nothing overflows */}
          <div className="md:hidden flex items-center gap-1 -mr-2 sm:-mr-3">
            <Button
              variant="ghost"
              size="icon"
              className={navTextClass}
              asChild
              aria-label="Library"
            >
              <Link href="/library">
                <Library className="h-4 w-4" />
              </Link>
            </Button>

            <Button
              variant="ghost"
              size="sm"
              className={navTextClass}
              asChild
            >
              <Link href="/team">Team</Link>
            </Button>

            <div className={navTextClass}>
              <TeamSwitcher />
            </div>
            <div className={navTextClass}>
              <InviteDialog />
            </div>

            <Button
              variant="ghost"
              size="icon"
              className={navTextClass}
              onClick={() => setSettingsOpen(true)}
              aria-label="Open settings"
              title="Settings"
            >
              <SettingsIcon className="h-5 w-5" />
            </Button>

            <div className={navTextClass}>
              <ProfileIcon />
            </div>
          </div>
        </div>
      </div>

      {/* Settings Modal mount point */}
      <SettingsModal
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />
    </header>
  );
}
