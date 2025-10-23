import { useState, useEffect } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Link } from "wouter";
import { Sparkles, ExternalLink, Copy, Trash2, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import Header from "@/components/Header";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import ChatDock from "@/components/ChatDock";
import PreviewsLibrary from "@/components/library/PreviewsLibrary";

interface Draft {
  draftId: string;
  title: string;
  description: string;
  thumbnail: string;
  createdAt: string;
  jobId: string;
}

export default function Library() {
  const { data: drafts = [], isLoading } = useQuery<Draft[]>({
    queryKey: ["/api/drafts", "demo"],
  });

  const [respectSystemTheme, setRespectSystemTheme] = useState(false);
  const shouldReduceMotion = useReducedMotion();
  const hasDrafts = drafts.length > 0;

  useEffect(() => {
    // Force library theme unless user opts to respect system theme
    if (!respectSystemTheme) {
      (document.body as HTMLBodyElement).dataset.forceTheme = "library";
    } else {
      delete (document.body as HTMLBodyElement).dataset.forceTheme;
    }

    return () => {
      // Cleanup on unmount
      delete (document.body as HTMLBodyElement).dataset.forceTheme;
    };
  }, [respectSystemTheme]);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="library-root min-h-screen">
        {/* Glass matcap and diagonal stripes applied via CSS ::before pseudo-element */}

        {/* Content */}
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 pt-24">
          {/* Header with Theme Toggle */}
          <div className="flex items-start justify-between mb-12">
            <motion.div
              initial={shouldReduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.8 }}
            >
              <h1 className="text-4xl md:text-5xl font-bold mb-2 text-white drop-shadow-lg">
                My Library
              </h1>
              <p className="text-lg text-white/90 drop-shadow">
                {hasDrafts ? "Your saved drafts" : "Your drafts will appear here"}
              </p>
            </motion.div>

            {/* Theme Respect Toggle */}
            <motion.div
              initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={
                shouldReduceMotion ? { duration: 0 } : { duration: 0.8, delay: 0.2 }
              }
              className="flex items-center gap-2 bg-black/30 backdrop-blur-md px-4 py-2 rounded-lg border border-white/20"
            >
              <Switch
                id="theme-toggle"
                checked={respectSystemTheme}
                onCheckedChange={setRespectSystemTheme}
                data-testid="switch-respect-theme"
              />
              <Label
                htmlFor="theme-toggle"
                className="text-sm text-white/90 cursor-pointer"
              >
                Respect system theme
              </Label>
            </motion.div>
          </div>

          {/* Drafts Grid or Empty State */}
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(6)].map((_, i) => (
                <div
                  key={i}
                  className={`bg-black/30 backdrop-blur-md h-64 rounded-lg border border-white/20 ${
                    shouldReduceMotion ? "" : "animate-pulse"
                  }`}
                />
              ))}
            </div>
          ) : hasDrafts ? (
            <motion.div
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
              initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={
                shouldReduceMotion ? { duration: 0 } : { duration: 0.6, delay: 0.2 }
              }
            >
              {drafts.map((draft, index) => (
                <motion.div
                  key={draft.draftId}
                  initial={
                    shouldReduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }
                  }
                  animate={{ opacity: 1, y: 0 }}
                  transition={
                    shouldReduceMotion
                      ? { duration: 0 }
                      : { duration: 0.6, delay: index * 0.1 }
                  }
                  className="bg-black/30 backdrop-blur-md rounded-lg border border-white/20 overflow-hidden hover-elevate cursor-pointer"
                  whileHover={shouldReduceMotion ? {} : { y: -8 }}
                  data-testid={`card-draft-${draft.draftId}`}
                >
                  <div className="aspect-video bg-gradient-to-br from-neutral-800 to-neutral-900 overflow-hidden">
                    <img
                      src={draft.thumbnail}
                      alt={draft.title}
                      className="w-full h-full object-cover"
                    />
                  </div>

                  <div className="p-4">
                    <h3 className="font-semibold text-white mb-1">
                      {draft.title || "Untitled"}
                    </h3>
                    <p className="text-sm text-white/70 mb-4">
                      {new Date(draft.createdAt).toLocaleDateString()}
                    </p>

                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        className="flex-1"
                        onClick={() =>
                          (window.location.href = `/workspace/${draft.jobId}`)
                        }
                        data-testid={`button-open-${draft.draftId}`}
                      >
                        <ExternalLink className="h-3 w-3 mr-1" />
                        Open
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        data-testid={`button-delete-${draft.draftId}`}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          ) : (
            <motion.div
              initial={shouldReduceMotion ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.8, delay: 0.2 }}
              className="flex items-center justify-center min-h-[60vh]"
            >
              <div className="bg-black/30 backdrop-blur-md rounded-lg border border-white/20 max-w-lg p-12 text-center space-y-6">
                <div className="space-y-4">
                  <Sparkles className="h-12 w-12 mx-auto text-white/80" />
                  <h2 className="text-2xl font-bold text-white">No drafts saved yet</h2>
                  <p className="text-white/70">
                    Generate a website and save it to your library
                  </p>
                </div>

                <Button
                  className="gap-2"
                  size="lg"
                  onClick={() => (window.location.href = "/")}
                  data-testid="button-create-now"
                >
                  <Sparkles className="h-4 w-4" />
                  Generate Website
                </Button>
              </div>
            </motion.div>
          )}

          {/* My Previews section */}
          <div className="mt-12">
            <h2 className="text-2xl font-bold text-white mb-4">My Previews</h2>
            <PreviewsLibrary />
          </div>
        </div>

        {/* Right-side chat dock for Library page */}
        <ChatDock />
      </div>
    </div>
  );
}
