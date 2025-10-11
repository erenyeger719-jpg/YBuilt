import { useState, useEffect } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Link } from "wouter";
import { Sparkles, ExternalLink, Copy, Trash2, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import Header from "@/components/Header";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

interface Project {
  id: string;
  title: string;
  thumbnail: string;
  date: string;
}

export default function Library() {
  const { data: projects = [], isLoading } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
  });

  const [respectSystemTheme, setRespectSystemTheme] = useState(false);
  const shouldReduceMotion = useReducedMotion();
  const hasProjects = projects.length > 0;

  useEffect(() => {
    // Force library theme unless user opts to respect system theme
    if (!respectSystemTheme) {
      document.body.dataset.forceTheme = 'library';
    } else {
      delete document.body.dataset.forceTheme;
    }
    
    return () => {
      // Cleanup on unmount
      delete document.body.dataset.forceTheme;
    };
  }, [respectSystemTheme]);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="library-root min-h-screen relative overflow-hidden">
        {/* Library Background - Black → Red → Light Blue Diagonal Bands */}
        <div className="fixed inset-0 -z-10">
          {/* Rightmost Band - Deep Black with Rim Highlights */}
          <div 
            className="absolute inset-0"
            style={{
              background: 'var(--lib-bg-right)',
              clipPath: 'polygon(100% 0, 100% 100%, 66% 100%, 33% 0)',
            }}
          >
            {/* Rim highlights for black band */}
            <div 
              className="absolute inset-0"
              style={{
                background: 'linear-gradient(120deg, transparent 0%, var(--lib-rim) 100%)',
              }}
            />
            {/* Glass overlay */}
            <div 
              className="absolute inset-0"
              style={{
                backdropFilter: `blur(var(--lib-glass-blur)) saturate(130%)`,
                background: `rgba(255,255,255,var(--lib-gloss-alpha))`,
              }}
            />
          </div>

          {/* Center Band - High-Contrast Red */}
          <div 
            className="absolute inset-0"
            style={{
              background: 'var(--lib-bg-center)',
              clipPath: 'polygon(66% 0, 66% 100%, 33% 100%, 0% 0)',
            }}
          >
            {/* Glass overlay */}
            <div 
              className="absolute inset-0"
              style={{
                backdropFilter: `blur(var(--lib-glass-blur)) saturate(130%)`,
                background: `rgba(255,255,255,var(--lib-gloss-alpha))`,
              }}
            />
          </div>

          {/* Leftmost Band - Light Blue Gradient */}
          <div 
            className="absolute inset-0"
            style={{
              background: `linear-gradient(135deg, var(--lib-bg-left-gradient-start) 0%, var(--lib-bg-left-gradient-end) 100%)`,
              clipPath: 'polygon(33% 0, 33% 100%, 0% 100%, 0% 0)',
            }}
          >
            {/* Glass overlay */}
            <div 
              className="absolute inset-0"
              style={{
                backdropFilter: `blur(var(--lib-glass-blur)) saturate(130%)`,
                background: `rgba(255,255,255,var(--lib-gloss-alpha))`,
              }}
            />
          </div>

          {/* Shimmer overlay (respects reduced motion) */}
          {!shouldReduceMotion && (
            <div className="absolute inset-0 pointer-events-none opacity-30">
              <div className="absolute inset-0 bg-gradient-to-br from-transparent via-white/5 to-transparent animate-pulse" />
            </div>
          )}

          {/* Top gradient wash for readability */}
          <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/40" />
        </div>

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
                {hasProjects ? "Your AI-generated projects" : "Your projects will appear here"}
              </p>
            </motion.div>

            {/* Theme Respect Toggle */}
            <motion.div
              initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.8, delay: 0.2 }}
              className="flex items-center gap-2 bg-black/30 backdrop-blur-md px-4 py-2 rounded-lg border border-white/20"
            >
              <Switch
                id="theme-toggle"
                checked={respectSystemTheme}
                onCheckedChange={setRespectSystemTheme}
                data-testid="switch-respect-theme"
              />
              <Label htmlFor="theme-toggle" className="text-sm text-white/90 cursor-pointer">
                Respect system theme
              </Label>
            </motion.div>
          </div>

          {/* Projects Grid or Empty State */}
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(6)].map((_, i) => (
                <div key={i} className={`bg-black/30 backdrop-blur-md h-64 rounded-lg border border-white/20 ${shouldReduceMotion ? '' : 'animate-pulse'}`} />
              ))}
            </div>
          ) : hasProjects ? (
            <motion.div
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
              initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.6, delay: 0.2 }}
            >
              {projects.map((project, index) => (
                <motion.div
                  key={project.id}
                  initial={shouldReduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.6, delay: index * 0.1 }}
                  className="bg-black/30 backdrop-blur-md rounded-lg border border-white/20 overflow-hidden hover-elevate cursor-pointer"
                  whileHover={shouldReduceMotion ? {} : { y: -8 }}
                  data-testid={`card-project-${project.id}`}
                >
                  <div className="aspect-video bg-gradient-to-br from-neutral-800 to-neutral-900 overflow-hidden">
                    <img 
                      src={project.thumbnail} 
                      alt={project.title}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  
                  <div className="p-4">
                    <h3 className="font-semibold text-white mb-1">{project.title}</h3>
                    <p className="text-sm text-white/70 mb-4">{project.date}</p>
                    
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        className="flex-1"
                        data-testid={`button-open-${project.id}`}
                      >
                        <ExternalLink className="h-3 w-3 mr-1" />
                        Open
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        data-testid={`button-duplicate-${project.id}`}
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        data-testid={`button-delete-${project.id}`}
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
                  <h2 className="text-2xl font-bold text-white">No projects yet</h2>
                  <p className="text-white/70">
                    Create your first project with a single prompt.
                  </p>
                </div>
                
                <Link href="/">
                  <a>
                    <Button 
                      className="gap-2"
                      size="lg"
                      data-testid="button-create-now"
                    >
                      <Sparkles className="h-4 w-4" />
                      Create Now
                    </Button>
                  </a>
                </Link>
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}
