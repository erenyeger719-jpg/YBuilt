import { useLocation } from "wouter";
import Logo from "./Logo";
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
}

export default function LogoButton({
  currentProjectName,
  currentProjectPath,
  onThemeToggle,
  onLogout,
}: LogoButtonProps) {
  const [, setLocation] = useLocation();

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

  return (
    <DropdownMenu>
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
        className="w-56"
        style={{ zIndex: 9999 }}
        data-testid="menu-logo-dropdown"
        aria-label="Ybuilt menu"
      >
        <DropdownMenuItem
          onClick={() => handleNavigation("/")}
          data-testid="menuitem-home"
        >
          Home
        </DropdownMenuItem>

        <DropdownMenuItem
          onClick={() => handleNavigation("/recent")}
          data-testid="menuitem-recent"
        >
          Recent
        </DropdownMenuItem>

        <DropdownMenuItem
          onClick={() => currentProjectPath && handleNavigation(currentProjectPath)}
          disabled={!currentProjectName}
          data-testid="menuitem-current-project"
        >
          {currentProjectName ? truncateProjectName(currentProjectName) : "No Workspace"}
        </DropdownMenuItem>

        <DropdownMenuItem
          onClick={() => handleNavigation("/library")}
          data-testid="menuitem-library"
        >
          Library
        </DropdownMenuItem>

        <DropdownMenuItem
          onClick={() => handleNavigation("/account")}
          data-testid="menuitem-account"
        >
          Account
        </DropdownMenuItem>

        <DropdownMenuItem
          onClick={() => handleNavigation("/core")}
          data-testid="menuitem-core"
        >
          Core
        </DropdownMenuItem>

        <DropdownMenuItem
          onClick={() => handleNavigation("/profile")}
          data-testid="menuitem-profile"
        >
          Profile
        </DropdownMenuItem>

        <DropdownMenuItem
          onClick={() => handleNavigation("/notifications")}
          data-testid="menuitem-notifications"
        >
          Notifications
        </DropdownMenuItem>

        <DropdownMenuItem
          onClick={() => handleNavigation("/notifications?filter=unread")}
          data-testid="menuitem-notifications-unread"
        >
          Unread
        </DropdownMenuItem>

        <DropdownMenuItem
          onClick={() => handleNavigation("/teams/new")}
          data-testid="menuitem-create-team"
        >
          Create Team
        </DropdownMenuItem>

        <DropdownMenuSub>
          <DropdownMenuSubTrigger
            aria-haspopup="true"
            data-testid="menuitem-clui"
          >
            CLUI
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
          onClick={handleThemeToggle}
          data-testid="menuitem-theme"
        >
          Toggle Theme
        </DropdownMenuItem>

        <DropdownMenuItem
          onClick={() => handleNavigation("/settings")}
          data-testid="menuitem-settings"
        >
          Settings
        </DropdownMenuItem>

        <DropdownMenuItem
          onClick={() => handleNavigation("/help")}
          data-testid="menuitem-help"
        >
          Help
        </DropdownMenuItem>

        <DropdownMenuItem
          onClick={handleBack}
          data-testid="menuitem-back"
        >
          Back
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem
          onClick={handleLogout}
          data-testid="menuitem-logout"
        >
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
