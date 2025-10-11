import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { Settings, SettingsSection } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";

interface SettingsContextType {
  settings: Settings | null;
  loading: boolean;
  updateSection: (section: SettingsSection, data: any) => Promise<void>;
  refetch: () => Promise<void>;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchSettings = async () => {
    try {
      const response = await fetch("/api/settings");
      const data = await response.json();
      setSettings(data);
      
      // Store in localStorage for MOCK_MODE resilience
      if (typeof window !== "undefined") {
        localStorage.setItem("ybuilt_settings", JSON.stringify(data));
      }
    } catch (error) {
      console.error("Failed to fetch settings:", error);
      
      // Fallback to localStorage in MOCK_MODE
      if (typeof window !== "undefined") {
        const cached = localStorage.getItem("ybuilt_settings");
        if (cached) {
          setSettings(JSON.parse(cached));
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const updateSection = async (section: SettingsSection, data: any) => {
    try {
      const response = await fetch(`/api/settings/${section}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      
      const updatedSettings = await response.json();
      
      // Update local state with full response
      setSettings(updatedSettings);
      
      // Update localStorage
      if (typeof window !== "undefined") {
        localStorage.setItem("ybuilt_settings", JSON.stringify(updatedSettings));
      }
    } catch (error) {
      console.error(`Failed to update ${section}:`, error);
      throw error;
    }
  };

  const refetch = async () => {
    setLoading(true);
    await fetchSettings();
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  // Apply appearance settings immediately
  useEffect(() => {
    if (!settings?.appearance) return;

    const { theme, glassIntensity, glossFinish, parallaxIntensity, motion, lowBandwidth, fontFamily, fontSize } = settings.appearance;

    // Apply theme
    document.body.dataset.theme = theme;

    // Apply CSS variables
    document.documentElement.style.setProperty("--glass-alpha", `${glassIntensity / 100}`);
    document.documentElement.style.setProperty("--parallax-intensity", `${parallaxIntensity / 100}`);
    document.documentElement.style.setProperty("--base-font-size", `${fontSize}px`);

    // Apply gloss finish
    if (glossFinish) {
      document.documentElement.classList.add("gloss-enabled");
    } else {
      document.documentElement.classList.remove("gloss-enabled");
    }

    // Apply motion preferences
    if (motion === "none") {
      document.documentElement.classList.add("reduced-motion");
      document.documentElement.classList.add("no-motion");
    } else if (motion === "reduced") {
      document.documentElement.classList.add("reduced-motion");
      document.documentElement.classList.remove("no-motion");
    } else {
      document.documentElement.classList.remove("reduced-motion");
      document.documentElement.classList.remove("no-motion");
    }

    // Apply low bandwidth mode
    if (lowBandwidth) {
      document.documentElement.classList.add("low-bandwidth");
    } else {
      document.documentElement.classList.remove("low-bandwidth");
    }

    // Apply font family
    document.documentElement.style.setProperty("--font-family", fontFamily);
  }, [settings?.appearance]);

  return (
    <SettingsContext.Provider value={{ settings, loading, updateSection, refetch }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error("useSettings must be used within a SettingsProvider");
  }
  return context;
}
