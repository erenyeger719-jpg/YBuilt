import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  FileText,
  Upload,
  Search,
  Eye,
  Terminal,
  Square,
  RotateCw,
  Code,
  Copy,
  Settings,
  Rocket,
  Database,
  Key,
  Boxes,
  Store,
  Lock,
  GitBranch,
  HardDrive,
  MonitorPlay,
  FolderKanban,
  Repeat,
  UserCircle,
  LogOut,
} from "lucide-react";

export default function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [, setLocation] = useLocation();

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const runCommand = (command: () => void) => {
    setOpen(false);
    command();
  };

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Type a command or search..." data-testid="input-command-search" />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        <CommandGroup heading="Files">
          <CommandItem
            onSelect={() => runCommand(() => console.log("New File"))}
            data-testid="command-new-file"
          >
            <FileText className="mr-2 h-4 w-4" />
            <span>New File</span>
          </CommandItem>
          <CommandItem
            onSelect={() => runCommand(() => console.log("Upload"))}
            data-testid="command-upload"
          >
            <Upload className="mr-2 h-4 w-4" />
            <span>Upload</span>
          </CommandItem>
          <CommandItem
            onSelect={() => runCommand(() => console.log("Search Files"))}
            data-testid="command-search-files"
          >
            <Search className="mr-2 h-4 w-4" />
            <span>Search Files</span>
            <kbd className="ml-auto pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
              <span className="text-xs">⌘</span>P
            </kbd>
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Actions">
          <CommandItem
            onSelect={() => runCommand(() => console.log("Preview"))}
            data-testid="command-preview"
          >
            <Eye className="mr-2 h-4 w-4" />
            <span>Preview</span>
          </CommandItem>
          <CommandItem
            onSelect={() => runCommand(() => console.log("Console"))}
            data-testid="command-console"
          >
            <Terminal className="mr-2 h-4 w-4" />
            <span>Console</span>
          </CommandItem>
          <CommandItem
            onSelect={() => runCommand(() => console.log("Stop Server"))}
            data-testid="command-stop-server"
          >
            <Square className="mr-2 h-4 w-4" />
            <span>Stop Server</span>
          </CommandItem>
          <CommandItem
            onSelect={() => runCommand(() => console.log("Refresh Preview"))}
            data-testid="command-refresh-preview"
          >
            <RotateCw className="mr-2 h-4 w-4" />
            <span>Refresh Preview</span>
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Tools">
          <CommandItem
            onSelect={() => runCommand(() => console.log("Open in VS Code"))}
            data-testid="command-vscode"
          >
            <Code className="mr-2 h-4 w-4" />
            <span>Open in VS Code</span>
          </CommandItem>
          <CommandItem
            onSelect={() => runCommand(() => console.log("Copy SSH"))}
            data-testid="command-copy-ssh"
          >
            <Copy className="mr-2 h-4 w-4" />
            <span>Copy SSH</span>
          </CommandItem>
          <CommandItem
            onSelect={() => runCommand(() => setLocation("/settings"))}
            data-testid="command-settings"
          >
            <Settings className="mr-2 h-4 w-4" />
            <span>Settings</span>
          </CommandItem>
          <CommandItem
            onSelect={() => runCommand(() => console.log("Publishing"))}
            data-testid="command-publishing"
          >
            <Rocket className="mr-2 h-4 w-4" />
            <span>Publishing</span>
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Developer">
          <CommandItem
            onSelect={() => runCommand(() => console.log("Database"))}
            data-testid="command-database"
          >
            <Database className="mr-2 h-4 w-4" />
            <span>Database</span>
          </CommandItem>
          <CommandItem
            onSelect={() => runCommand(() => console.log("Secrets"))}
            data-testid="command-secrets"
          >
            <Key className="mr-2 h-4 w-4" />
            <span>Secrets</span>
          </CommandItem>
          <CommandItem
            onSelect={() => runCommand(() => console.log("Shell"))}
            data-testid="command-shell"
          >
            <Terminal className="mr-2 h-4 w-4" />
            <span>Shell</span>
          </CommandItem>
          <CommandItem
            onSelect={() => runCommand(() => console.log("Workflows"))}
            data-testid="command-workflows"
          >
            <Boxes className="mr-2 h-4 w-4" />
            <span>Workflows</span>
          </CommandItem>
          <CommandItem
            onSelect={() => runCommand(() => console.log("Extension Store"))}
            data-testid="command-extensions"
          >
            <Store className="mr-2 h-4 w-4" />
            <span>Extension Store</span>
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Integrations">
          <CommandItem
            onSelect={() => runCommand(() => console.log("Auth"))}
            data-testid="command-auth"
          >
            <Lock className="mr-2 h-4 w-4" />
            <span>Auth</span>
          </CommandItem>
          <CommandItem
            onSelect={() => runCommand(() => console.log("Git"))}
            data-testid="command-git"
          >
            <GitBranch className="mr-2 h-4 w-4" />
            <span>Git</span>
          </CommandItem>
          <CommandItem
            onSelect={() => runCommand(() => console.log("App Storage"))}
            data-testid="command-app-storage"
          >
            <HardDrive className="mr-2 h-4 w-4" />
            <span>App Storage</span>
          </CommandItem>
          <CommandItem
            onSelect={() => runCommand(() => console.log("Replit KV"))}
            data-testid="command-replit-kv"
          >
            <Database className="mr-2 h-4 w-4" />
            <span>Replit KV</span>
          </CommandItem>
          <CommandItem
            onSelect={() => runCommand(() => console.log("VNC"))}
            data-testid="command-vnc"
          >
            <MonitorPlay className="mr-2 h-4 w-4" />
            <span>VNC</span>
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="User">
          <CommandItem
            onSelect={() => runCommand(() => setLocation("/library"))}
            data-testid="command-my-apps"
          >
            <FolderKanban className="mr-2 h-4 w-4" />
            <span>My Apps</span>
          </CommandItem>
          <CommandItem
            onSelect={() => runCommand(() => console.log("Remix"))}
            data-testid="command-remix"
          >
            <Repeat className="mr-2 h-4 w-4" />
            <span>Remix</span>
          </CommandItem>
          <CommandItem
            onSelect={() => runCommand(() => setLocation("/settings"))}
            data-testid="command-user-settings"
          >
            <UserCircle className="mr-2 h-4 w-4" />
            <span>User Settings</span>
          </CommandItem>
          <CommandItem
            onSelect={() => runCommand(() => console.log("Sign Out"))}
            data-testid="command-sign-out"
          >
            <LogOut className="mr-2 h-4 w-4" />
            <span>Sign Out</span>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
