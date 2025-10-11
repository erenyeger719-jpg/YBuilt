import { User, Library, Settings, LogOut, LogIn } from "lucide-react";
import { useLocation } from "wouter";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

interface ProfileIconProps {
  isAuthenticated?: boolean;
}

export default function ProfileIcon({ isAuthenticated = false }: ProfileIconProps) {
  const [, setLocation] = useLocation();

  const menuItems = isAuthenticated
    ? [
        { icon: Library, label: "My Library", href: "/library" },
        { icon: Settings, label: "Settings", href: "/settings" },
        { icon: LogOut, label: "Sign Out", href: "#" },
      ]
    : [
        { icon: LogIn, label: "Sign In", href: "/signin" },
      ];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          size="icon"
          variant="ghost"
          className="w-10 h-10 rounded-full glass-cta-border"
          data-testid="button-profile"
          aria-label="Profile menu"
        >
          <User className="h-5 w-5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {menuItems.map((item, index) => (
          <DropdownMenuItem
            key={index}
            className="cursor-pointer"
            data-testid={`link-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
            onSelect={() => {
              if (item.href !== "#") {
                setLocation(item.href);
              }
            }}
          >
            <item.icon className="h-4 w-4 mr-2" />
            <span>{item.label}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
