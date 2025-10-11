import { Moon, Sun, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import Logo from "./Logo";
import { useState, useEffect } from "react";

export default function Header() {
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  const [lowGloss, setLowGloss] = useState(false);

  useEffect(() => {
    const savedTheme = localStorage.getItem("theme") as "light" | "dark" | null;
    const savedLowGloss = localStorage.getItem("lowGloss") === "true";
    
    if (savedTheme) {
      setTheme(savedTheme);
      document.documentElement.classList.toggle("dark", savedTheme === "dark");
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
    document.documentElement.classList.toggle("dark", newTheme === "dark");
    localStorage.setItem("theme", newTheme);
  };

  const toggleLowGloss = () => {
    const newLowGloss = !lowGloss;
    setLowGloss(newLowGloss);
    document.documentElement.classList.toggle("low-gloss", newLowGloss);
    localStorage.setItem("lowGloss", String(newLowGloss));
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 border-b border-border/50 backdrop-blur-md bg-background/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Logo />
          
          <div className="flex items-center gap-2">
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
          </div>
        </div>
      </div>
    </header>
  );
}
