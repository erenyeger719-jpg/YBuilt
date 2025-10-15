import { motion, type Variants } from "framer-motion";

interface LogoProps {
  className?: string;
  animate?: boolean;
}

export default function Logo({ className = "", animate = false }: LogoProps) {
  const logoVariants: Variants = {
    hidden: { opacity: 0, scale: 0.8 },
    visible: {
      opacity: 1,
      scale: 1,
      transition: {
        duration: 0.8,
        ease: [0.22, 1, 0.36, 1],
      },
    },
  };

  const Component = animate ? motion.div : "div";

  return (
    <Component
      className={`flex items-center gap-1 ${className}`}
      variants={animate ? logoVariants : undefined}
      initial={animate ? "hidden" : undefined}
      animate={animate ? "visible" : undefined}
    >
      <svg
        width="40"
        height="40"
        viewBox="0 0 40 40"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="relative"
      >
        <defs>
          <linearGradient id="glassGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.9)" />
            <stop offset="50%" stopColor="rgba(255,255,255,0.6)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0.3)" />
          </linearGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="2" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <path
          d="M8 8 L20 20 L32 8 L32 20 L20 32 L8 20 Z"
          fill="url(#glassGradient)"
          stroke="rgba(255,255,255,0.4)"
          strokeWidth="1.5"
          filter="url(#glow)"
        />
        <path
          d="M20 20 L20 32"
          stroke="rgba(255,255,255,0.6)"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
      <span className="text-2xl font-bold tracking-tight metal-text">built</span>
    </Component>
  );
}
