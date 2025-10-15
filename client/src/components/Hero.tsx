import { motion, type Variants } from "framer-motion";
import { useLocation } from "wouter";
import PromptInput from "./PromptInput";
import { useGeneration } from "@/hooks/useGeneration";
import PreviewModal from "./PreviewModal";
import { useToast } from "@/hooks/use-toast";
import { useEffect } from "react";

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.2,
      delayChildren: 0.3,
    },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.8,
      ease: [0.22, 1, 0.36, 1],
    },
  },
};

export default function Hero() {
  const [, setLocation] = useLocation();
  const { generate, reset, isGenerating, status, error, redirectUrl } = useGeneration();
  const { toast } = useToast();

  useEffect(() => {
    if (error) {
      toast({
        title: "Generation failed",
        description: error,
        variant: "destructive",
      });
    }
  }, [error, toast]);

  // Handle redirect to finalize page
  useEffect(() => {
    if (redirectUrl) {
      setLocation(redirectUrl);
    }
  }, [redirectUrl, setLocation]);

  return (
    <section className="relative min-h-screen flex items-center justify-center pt-16 overflow-hidden">
      {/* Ultra-HDR Background */}
      <div className="absolute inset-0 bg-gradient-to-r from-black via-neutral-800 to-neutral-300 dark:from-black dark:via-neutral-900 dark:to-neutral-700">
        {/* Smoke overlay effect */}
        <div className="absolute inset-0 opacity-30">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-white/5 rounded-full blur-3xl animate-pulse" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-white/10 rounded-full blur-3xl animate-pulse delay-700" />
        </div>
      </div>

      {/* Diagonal Striped Glass Backdrop */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="glass-stripe-container">
          {/* Glass stripes */}
          {[...Array(12)].map((_, i) => (
            <div
              key={i}
              className={`glass-stripe ${i % 2 === 0 ? 'glass-stripe-white' : 'glass-stripe-black'}`}
              style={{
                left: `${i * 10 - 10}%`,
              }}
            />
          ))}
          
          {/* Reflected headline text */}
          <div className="hero-reflection" aria-hidden="true">
            From Idea to Digital Reality
          </div>
        </div>
      </div>

      {/* Content */}
      <motion.div
        className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        <motion.h1
          className="text-hero-mobile md:text-hero font-bold mb-6 metal-text relative"
          variants={itemVariants}
        >
          <span className="relative z-10">From Idea to Digital Reality</span>
          {/* Text readability overlay */}
          <span className="absolute inset-0 bg-black/20 dark:bg-black/30 blur-xl -z-10" aria-hidden="true" />
        </motion.h1>
        
        <motion.p
          className="text-xl md:text-2xl mb-12 text-muted-foreground font-light tracking-wide"
          variants={itemVariants}
        >
          Build smarter. Launch faster.
        </motion.p>

        <motion.div variants={itemVariants}>
          <PromptInput onGenerate={generate} isGenerating={isGenerating} />
        </motion.div>
      </motion.div>
    </section>
  );
}
