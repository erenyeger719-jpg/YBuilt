import { motion, useReducedMotion } from "framer-motion";
import { Link } from "wouter";
import { Sparkles, ExternalLink, Copy, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import Header from "@/components/Header";

interface Project {
  id: string;
  title: string;
  date: string;
  thumbnail: string;
  url: string;
}

export default function Library() {
  const { data: projects = [], isLoading } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
  });
  const shouldReduceMotion = useReducedMotion();

  const hasProjects = projects.length > 0;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="pt-16 relative overflow-hidden min-h-screen">
      {/* Black → Red → Blue Diagonal Slash Backdrop */}
      <div className="fixed inset-0 -z-10">
        {/* Black stripe */}
        <div className="absolute inset-0 bg-black" />
        
        {/* Diagonal slash stripes container */}
        <div className="absolute inset-0 overflow-hidden">
          {/* Repeating diagonal stripes */}
          {[...Array(12)].map((_, i) => {
            const colorIndex = i % 3;
            const colors = [
              "bg-black", // black
              "bg-red-600", // red
              "bg-blue-600", // blue
            ];
            const glassColors = [
              "from-black/90 to-black/70", // black glass
              "from-red-600/80 to-red-700/60", // red glass
              "from-blue-600/80 to-blue-700/60", // blue glass
            ];
            
            return (
              <motion.div
                key={i}
                className={`absolute h-[200%] w-96 ${colors[colorIndex]} opacity-90`}
                style={{
                  left: `${i * 250 - 500}px`,
                  top: "-50%",
                  transform: "rotate(30deg)",
                  transformOrigin: "top left",
                }}
                initial={shouldReduceMotion ? { x: 0, opacity: 0.9 } : { x: -100, opacity: 0 }}
                animate={{ x: 0, opacity: 0.9 }}
                transition={shouldReduceMotion ? { duration: 0 } : { 
                  duration: 1.2, 
                  delay: i * 0.05,
                  ease: [0.22, 1, 0.36, 1]
                }}
              >
                {/* Glass overlay with rim light */}
                <div className={`absolute inset-0 bg-gradient-to-br ${glassColors[colorIndex]} backdrop-blur-sm`} />
                <div className="absolute inset-0 border-l-2 border-r-2 border-white/10" />
                
                {/* Specular highlights */}
                <div className="absolute top-0 left-0 right-0 h-1/3 bg-gradient-to-b from-white/20 to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 h-1/4 bg-gradient-to-t from-black/30 to-transparent" />
              </motion.div>
            );
          })}
        </div>

        {/* Shimmer effect overlay */}
        {!shouldReduceMotion && (
          <motion.div
            className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent"
            animate={{
              x: ["-100%", "200%"],
            }}
            transition={{
              duration: 20,
              repeat: Infinity,
              ease: "linear",
            }}
          />
        )}

        {/* Fog overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/40" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <motion.div
          initial={shouldReduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.8 }}
        >
          <h1 className="text-4xl md:text-5xl font-bold mb-2 metal-text text-white">
            My Library
          </h1>
          <p className="text-lg text-white/80 mb-12">
            {hasProjects ? "Your AI-generated projects" : "Your projects will appear here"}
          </p>
        </motion.div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <div key={i} className={`card-glass h-64 ${shouldReduceMotion ? '' : 'animate-pulse'}`} />
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
                className="card-glass group hover-elevate cursor-pointer"
                whileHover={shouldReduceMotion ? {} : { y: -8 }}
                data-testid={`card-project-${project.id}`}
              >
                <div className="gloss-sheen" />
                
                <div className="aspect-video bg-gradient-to-br from-neutral-800 to-neutral-900 dark:from-neutral-900 dark:to-black rounded-t-md overflow-hidden border-b border-border/30">
                  <img 
                    src={project.thumbnail}
                    alt={project.title}
                    className="w-full h-full object-cover"
                  />
                </div>
                
                <div className="p-4 space-y-3">
                  <div>
                    <h3 className="text-lg font-semibold text-white metal-text">{project.title}</h3>
                    <p className="text-sm text-white/60">{project.date}</p>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="flex-1"
                      data-testid={`button-open-${project.id}`}
                    >
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Open
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      data-testid={`button-duplicate-${project.id}`}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      data-testid={`button-delete-${project.id}`}
                    >
                      <Trash2 className="h-4 w-4" />
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
            <div className="card-glass max-w-lg p-12 text-center space-y-6">
              <div className="gloss-sheen" />
              
              <div className="space-y-4">
                <div className="inline-flex p-4 rounded-full glass-cta-border">
                  <Sparkles className="h-8 w-8 text-white" />
                </div>
                
                <h2 className="text-2xl font-bold text-white metal-text">
                  No projects yet
                </h2>
                
                <p className="text-white/70">
                  Create your first project with a single prompt.
                </p>
              </div>
              
              <Link href="/">
                <a>
                  <Button
                    size="lg"
                    className="glass-cta-border gap-2"
                    data-testid="button-create-now"
                  >
                    <Sparkles className="h-5 w-5" />
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
