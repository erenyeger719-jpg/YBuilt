import { Link, useLocation } from "wouter";
import { 
  User, 
  Palette, 
  Code, 
  Sparkles, 
  Shield, 
  Puzzle, 
  CreditCard, 
  Users, 
  Download,
  Bell
} from "lucide-react";
import { cn } from "@/lib/utils";

interface SidebarItemProps {
  to: string;
  icon: React.ReactNode;
  label: string;
  active?: boolean;
}

function SidebarItem({ to, icon, label, active }: SidebarItemProps) {
  return (
    <Link href={to}>
      <a
        data-testid={`settings-nav-${label.toLowerCase().replace(/\s+/g, '-')}`}
        className={cn(
          "flex items-center gap-3 px-4 py-2.5 rounded-md transition-colors",
          "hover-elevate active-elevate-2",
          active 
            ? "bg-accent text-accent-foreground" 
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        <span className="w-5 h-5 flex items-center justify-center">
          {icon}
        </span>
        <span className="font-medium">{label}</span>
      </a>
    </Link>
  );
}

export function SettingsSidebar() {
  const [location] = useLocation();
  
  const sections = [
    {
      label: "Personal",
      items: [
        { to: "/settings/account", icon: <User className="w-5 h-5" />, label: "Account" },
        { to: "/settings/appearance", icon: <Palette className="w-5 h-5" />, label: "Appearance" },
        { to: "/settings/notifications", icon: <Bell className="w-5 h-5" />, label: "Notifications" },
      ]
    },
    {
      label: "Workspace",
      items: [
        { to: "/settings/editor", icon: <Code className="w-5 h-5" />, label: "Editor" },
        { to: "/settings/ai", icon: <Sparkles className="w-5 h-5" />, label: "AI & Models" },
      ]
    },
    {
      label: "Organization",
      items: [
        { to: "/settings/security", icon: <Shield className="w-5 h-5" />, label: "Security" },
        { to: "/settings/integrations", icon: <Puzzle className="w-5 h-5" />, label: "Integrations" },
        { to: "/settings/billing", icon: <CreditCard className="w-5 h-5" />, label: "Billing" },
        { to: "/settings/team", icon: <Users className="w-5 h-5" />, label: "Team" },
      ]
    },
    {
      label: "Data",
      items: [
        { to: "/settings/export", icon: <Download className="w-5 h-5" />, label: "Data & Export" },
      ]
    }
  ];

  return (
    <aside className="w-64 flex-shrink-0 p-6 space-y-8">
      {sections.map((section) => (
        <div key={section.label} className="space-y-2">
          <h3 className="px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            {section.label}
          </h3>
          <nav className="space-y-1">
            {section.items.map((item) => (
              <SidebarItem
                key={item.to}
                {...item}
                active={location.startsWith(item.to)}
              />
            ))}
          </nav>
        </div>
      ))}
    </aside>
  );
}
