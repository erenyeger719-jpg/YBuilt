import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import Logo from "./Logo";
import GetHelpModal from "@/components/GetHelpModal";
import type { SystemStatus } from "@shared/schema";
import {
  Home,
  Clock,
  FileCode,
  Library,
  UserCircle,
  User,
  Bell,
  Users,
  Terminal,
  Palette,
  Settings,
  HelpCircle,
  LogOut,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface LogoButtonProps {
  currentProjectName?: string;
  currentProjectPath?: string;
  onThemeToggle?: () => void;
  onLogout?: () => void;
  isWorkspace?: boolean;
  onThemeModalOpen?: () => void;
}

export default function LogoButton({
  currentProjectName,
  currentProjectPath,
  onThemeToggle,
  onLogout,
  isWorkspace = false,
  onThemeModalOpen,
}: LogoButtonProps) {
  const [, setLocation] = useLocation();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [helpModalOpen, setHelpModalOpen] = useState(false);

  // Poll system status every 30 seconds
  const { data: systemStatus } = useQuery<SystemStatus>({
    queryKey: ["/api/status"],
    refetchInterval: 30000,
  });

  const handleNavigation = (path: string) => {
    setLocation(path);
  };

  const handleThemeToggle = () => {
    onThemeToggle?.();
  };

  const handleLogout = () => {
    onLogout?.();
  };

  const handleBack = () => {
    window.history.back();
  };

  const truncateProjectName = (name: string) => {
    return name.length > 30 ? name.substring(0, 30) + "..." : name;
  };

  const handleThemeClick = () => {
    setDropdownOpen(false); // Close dropdown first
    setTimeout(() => {
      if (isWorkspace && onThemeModalOpen) {
        onThemeModalOpen(); // Then open theme modal for workspace
      } else {
        handleThemeToggle(); // Or toggle global theme
      }
    }, 100);
  };

  return (
    <DropdownMenu open={dropdownOpen} onOpenChange={setDropdownOpen}>
      <DropdownMenuTrigger
        className="focus:outline-none focus:ring-2 focus:ring-primary rounded-sm"
        data-testid="button-logo-menu"
        aria-label="Open Ybuilt menu"
      >
        <Logo />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        side="bottom"
        className={isWorkspace ? "logo-menu workspace" : "w-56"}
        style={{ zIndex: 9999 }}
        data-testid="menu-logo-dropdown"
        aria-label="Ybuilt menu"
      >
        <DropdownMenuItem
          onClick={() => handleNavigation("/")}
          data-testid="menuitem-home"
        >
          <span className="menu-label">Home</span>
          {isWorkspace && <Home className="menu-icon h-5 w-5" aria-hidden="true" />}
        </DropdownMenuItem>

        <DropdownMenuItem
          onClick={() => handleNavigation("/recent")}
          data-testid="menuitem-recent"
        >
          <span className="menu-label">Recent</span>
          {isWorkspace && <Clock className="menu-icon h-5 w-5" aria-hidden="true" />}
        </DropdownMenuItem>

        <DropdownMenuItem
          onClick={() => currentProjectPath && handleNavigation(currentProjectPath)}
          disabled={!currentProjectName}
          data-testid="menuitem-current-project"
        >
          <span className="menu-label">{currentProjectName ? truncateProjectName(currentProjectName) : "No Workspace"}</span>
          {isWorkspace && <FileCode className="menu-icon h-5 w-5" aria-hidden="true" />}
        </DropdownMenuItem>

        <DropdownMenuItem
          onClick={() => handleNavigation("/library")}
          data-testid="menuitem-library"
        >
          <span className="menu-label">Library</span>
          {isWorkspace && <Library className="menu-icon h-5 w-5" aria-hidden="true" />}
        </DropdownMenuItem>

        <DropdownMenuItem
          onClick={() => handleNavigation("/settings/account")}
          data-testid="menuitem-account"
        >
          <span className="menu-label">Account</span>
          {isWorkspace && <UserCircle className="menu-icon h-5 w-5" aria-hidden="true" />}
        </DropdownMenuItem>

        {!isWorkspace && (
          <DropdownMenuItem
            onClick={() => handleNavigation("/core")}
            data-testid="menuitem-core"
          >
            Core
          </DropdownMenuItem>
        )}

        <DropdownMenuItem
          onClick={() => handleNavigation("/settings/profile")}
          data-testid="menuitem-profile"
        >
          <span className="menu-label">Profile</span>
          {isWorkspace && <User className="menu-icon h-5 w-5" aria-hidden="true" />}
        </DropdownMenuItem>

        <DropdownMenuItem
          onClick={() => handleNavigation("/notifications")}
          data-testid="menuitem-notifications"
        >
          <span className="menu-label">Notifications</span>
          {isWorkspace && <Bell className="menu-icon h-5 w-5" aria-hidden="true" />}
        </DropdownMenuItem>

        {!isWorkspace && (
          <DropdownMenuItem
            onClick={() => handleNavigation("/notifications?filter=unread")}
            data-testid="menuitem-notifications-unread"
          >
            Unread
          </DropdownMenuItem>
        )}

        <DropdownMenuItem
          onClick={() => handleNavigation("/teams/new")}
          data-testid="menuitem-create-team"
        >
          <span className="menu-label">Create Team</span>
          {isWorkspace && <Users className="menu-icon h-5 w-5" aria-hidden="true" />}
        </DropdownMenuItem>

        <DropdownMenuSub>
          <DropdownMenuSubTrigger
            aria-haspopup="true"
            data-testid="menuitem-clui"
          >
            <span className="menu-label">CLUI</span>
            {isWorkspace && <Terminal className="menu-icon h-5 w-5" aria-hidden="true" />}
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent
            style={{ zIndex: 9999 }}
            data-testid="submenu-clui"
          >
            <DropdownMenuItem
              onClick={() => handleNavigation("/clui/command-line")}
              data-testid="menuitem-clui-command-line"
            >
              Command Line
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => handleNavigation("/clui/terminal")}
              data-testid="menuitem-clui-terminal"
            >
              Terminal
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => handleNavigation("/clui/console")}
              data-testid="menuitem-clui-console"
            >
              Console
            </DropdownMenuItem>
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        <DropdownMenuItem
          onClick={handleThemeClick}
          data-testid="menuitem-theme"
        >
          <span className="menu-label">{isWorkspace ? "Theme for project" : "Toggle Theme"}</span>
          {isWorkspace && <Palette className="menu-icon h-5 w-5" aria-hidden="true" />}
        </DropdownMenuItem>

        <DropdownMenuItem
          onClick={() => handleNavigation("/settings")}
          data-testid="menuitem-settings"
        >
          <span className="menu-label">Settings</span>
          {isWorkspace && <Settings className="menu-icon h-5 w-5" aria-hidden="true" />}
        </DropdownMenuItem>

        <DropdownMenuSub>
          <DropdownMenuSubTrigger
            aria-haspopup="true"
            data-testid="menuitem-help"
          >
            <span className="menu-label">Help</span>
            {isWorkspace && <HelpCircle className="menu-icon h-5 w-5" aria-hidden="true" />}
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent
            style={{ zIndex: 9999 }}
            data-testid="submenu-help"
          >
            <DropdownMenuItem
              onClick={() => handleNavigation("/status")}
              data-testid="menuitem-status"
              className="flex items-center gap-2"
            >
              <span className={`w-2 h-2 rounded-full ${
                systemStatus?.services?.some(s => s.status === "degraded") 
                  ? "bg-amber-500" 
                  : systemStatus?.ok 
                    ? "bg-green-500" 
                    : "bg-red-500"
              }`} />
              <span>{systemStatus?.summary || "Checking status..."}</span>
            </DropdownMenuItem>
            
            <DropdownMenuItem
              onClick={() => { setDropdownOpen(false); setHelpModalOpen(true); }}
              data-testid="menuitem-get-help"
            >
              ? Get help
            </DropdownMenuItem>
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        {!isWorkspace && (
          <DropdownMenuItem
            onClick={handleBack}
            data-testid="menuitem-back"
          >
            Back
          </DropdownMenuItem>
        )}

        <DropdownMenuSeparator />

        <DropdownMenuItem
          onClick={handleLogout}
          data-testid="menuitem-logout"
        >
          <span className="menu-label">Log out</span>
          {isWorkspace && <LogOut className="menu-icon h-5 w-5" aria-hidden="true" />}
        </DropdownMenuItem>
      </DropdownMenuContent>
      <GetHelpModal open={helpModalOpen} onOpenChange={setHelpModalOpen} />
    </DropdownMenu>
  );
}
