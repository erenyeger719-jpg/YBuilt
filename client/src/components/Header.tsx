import { Moon, Sun, Sparkles, Library, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link, useLocation } from "wouter";
import Logo from "./Logo";
import PaymentButton from "./PaymentButton";
import CurrencyToggle from "./CurrencyToggle";
import ProfileIcon from "./ProfileIcon";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useState, useEffect } from "react";

interface HeaderProps {
  showPublish?: boolean;
  logSummary?: {
    status: "success" | "error" | "building";
    lastBuild: string;
  };
  onPublish?: () => void;
}

export default function Header({ showPublish, logSummary, onPublish }: HeaderProps) {
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  const [lowGloss, setLowGloss] = useState(false);
  const [currency, setCurrency] = useState<"INR" | "USD">("INR");
  const [location] = useLocation();

  const isWorkspace = location.startsWith("/workspace/");

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

  return (
    <header className="fixed top-0 left-0 right-0 z-50 border-b border-border/50 backdrop-blur-md bg-background/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">
          <Tooltip>
            <TooltipTrigger asChild>
              <Link href="/">
                <a className="flex items-center" data-testid="link-home-logo">
                  <Logo />
                </a>
              </Link>
            </TooltipTrigger>
            <TooltipContent>
              <p>Ybuilt — Home</p>
            </TooltipContent>
          </Tooltip>
          
          <div className="flex items-center gap-2">
            {isWorkspace && logSummary && (
              <Badge 
                variant={logSummary.status === "success" ? "default" : logSummary.status === "error" ? "destructive" : "secondary"}
                className="gap-1.5"
                data-testid="badge-log-summary"
              >
                <span className="text-xs">
                  Build: {logSummary.status} • Last: {logSummary.lastBuild}
                </span>
              </Badge>
            )}
            
            {isWorkspace && showPublish && (
              <Button
                variant="default"
                size="sm"
                className="gap-2"
                onClick={onPublish}
                data-testid="button-publish"
              >
                <Upload className="h-4 w-4" />
                <span>Publish</span>
              </Button>
            )}
            
            <Button
              variant="ghost"
              size="sm"
              className="gap-2"
              data-testid="button-library"
              aria-label="Library"
              asChild
            >
              <Link href="/library">
                <a>
                  <Library className="h-4 w-4" />
                  <span className="hidden sm:inline">Library</span>
                </a>
              </Link>
            </Button>
            <PaymentButton amount={amount} currency={currency} />
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
          </div>
        </div>
      </div>
    </header>
  );
}
