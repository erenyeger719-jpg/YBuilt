// client/src/components/Hero.tsx
import { useState, FormEvent, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

export default function Hero() {
  const { toast } = useToast();
  const [promptText, setPromptText] = useState("");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);
  const mouseRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    // Set canvas size
    const resizeCanvas = () => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      ctx.scale(dpr, dpr);
    };
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Mouse tracking for interactive effect
    const handleMouseMove = (e: MouseEvent) => {
      mouseRef.current = { x: e.clientX, y: e.clientY };
    };
    window.addEventListener('mousemove', handleMouseMove);

    // Animation parameters
    let time = 0;
    const particles: Array<{
      x: number;
      y: number;
      angle: number;
      radius: number;
      speed: number;
      hue: number;
      size: number;
      opacity: number;
      rotationSpeed: number;
      phase: number;
      orbitRadius: number;
      orbitSpeed: number;
    }> = [];

    // Create complex swirling particles
    const particleCount = 1200;
    for (let i = 0; i < particleCount; i++) {
      const layerIndex = Math.floor(i / (particleCount / 4)); // 4 layers
      const angle = (i / particleCount) * Math.PI * 2 * 12; // Multiple spirals
      const radius = 80 + (i / particleCount) * 450 + Math.random() * 50;
      
      particles.push({
        x: 0,
        y: 0,
        angle: angle,
        radius: radius,
        speed: 0.0008 + Math.random() * 0.002 - layerIndex * 0.0002,
        hue: (i / particleCount) * 360 + Math.random() * 60,
        size: Math.random() * 2.5 + 0.5,
        opacity: Math.random() * 0.6 + 0.2,
        rotationSpeed: (Math.random() - 0.5) * 0.003,
        phase: Math.random() * Math.PI * 2,
        orbitRadius: Math.random() * 30 + 10,
        orbitSpeed: Math.random() * 0.02 + 0.01
      });
    }

    // Flowing streams data
    const streams: Array<{
      points: Array<{ x: number; y: number }>;
      hue: number;
      width: number;
      speed: number;
      offset: number;
    }> = [];

    for (let i = 0; i < 12; i++) {
      streams.push({
        points: [],
        hue: (i / 12) * 360,
        width: Math.random() * 3 + 1,
        speed: Math.random() * 0.002 + 0.001,
        offset: Math.random() * Math.PI * 2
      });
    }

    // Animation loop
    const animate = () => {
      const centerX = window.innerWidth / 2;
      const centerY = window.innerHeight / 2;
      
      // Mouse influence
      const mouseInfluenceX = (mouseRef.current.x - centerX) * 0.05;
      const mouseInfluenceY = (mouseRef.current.y - centerY) * 0.05;

      // Clear canvas with dark background
      ctx.fillStyle = 'rgba(2, 6, 23, 1)';
      ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);

      // Create multiple gradient layers for depth
      const gradients = [];
      for (let i = 0; i < 3; i++) {
        const gradient = ctx.createRadialGradient(
          centerX + mouseInfluenceX * (i + 1),
          centerY + mouseInfluenceY * (i + 1),
          0,
          centerX + mouseInfluenceX * (i + 1),
          centerY + mouseInfluenceY * (i + 1),
          400 + i * 100
        );
        
        const hueShift = time * 0.05 + i * 120;
        gradient.addColorStop(0, 'rgba(0, 0, 0, 1)');
        gradient.addColorStop(0.3, `hsla(${hueShift % 360}, 70%, 20%, 0.8)`);
        gradient.addColorStop(0.5, `hsla(${(hueShift + 60) % 360}, 70%, 30%, 0.5)`);
        gradient.addColorStop(0.7, `hsla(${(hueShift + 120) % 360}, 70%, 40%, 0.3)`);
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
        gradients.push(gradient);
      }

      // Draw background gradient layers
      gradients.forEach((gradient, index) => {
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        ctx.globalAlpha = 0.3 - index * 0.05;
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);
        ctx.restore();
      });

      // Draw flowing streams
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      
      streams.forEach((stream, streamIndex) => {
        ctx.beginPath();
        ctx.strokeStyle = `hsla(${(stream.hue + time * 0.2) % 360}, 80%, 60%, 0.3)`;
        ctx.lineWidth = stream.width;
        ctx.globalAlpha = 0.4;
        
        stream.points = [];
        for (let i = 0; i < 150; i++) {
          const t = i / 150;
          const angle = stream.offset + t * Math.PI * 4 + 
                       Math.sin(time * stream.speed + i * 0.1) * 0.5 +
                       Math.cos(time * stream.speed * 0.5 + i * 0.05) * 0.3;
          
          const radiusVariation = Math.sin(time * 0.001 + i * 0.1 + streamIndex) * 50;
          const r = 100 + t * 400 + radiusVariation;
          
          const x = centerX + Math.cos(angle) * r * (1 + Math.sin(time * 0.001) * 0.1) + mouseInfluenceX;
          const y = centerY + Math.sin(angle) * r * 0.6 * (1 + Math.cos(time * 0.001) * 0.1) + mouseInfluenceY;
          
          stream.points.push({ x, y });
          
          if (i === 0) {
            ctx.moveTo(x, y);
          } else {
            const cp1x = (stream.points[i - 1].x + x) / 2;
            const cp1y = (stream.points[i - 1].y + y) / 2;
            ctx.quadraticCurveTo(stream.points[i - 1].x, stream.points[i - 1].y, cp1x, cp1y);
          }
        }
        
        ctx.stroke();
      });
      ctx.restore();

      // Draw particles with complex motion
      particles.forEach((particle, index) => {
        // Update particle physics
        particle.angle += particle.speed + Math.sin(time * 0.001 + particle.phase) * 0.0005;
        particle.rotationSpeed *= 0.9995;
        
        // Orbital motion around the main path
        const orbitAngle = time * particle.orbitSpeed + particle.phase;
        const orbitX = Math.cos(orbitAngle) * particle.orbitRadius;
        const orbitY = Math.sin(orbitAngle) * particle.orbitRadius * 0.5;
        
        // Main spiral path with distortion
        const spiralDistortion = Math.sin(time * 0.001 + particle.angle * 3) * 30;
        const radiusDistortion = Math.cos(time * 0.0015 + index * 0.01) * 20;
        const finalRadius = particle.radius + spiralDistortion + radiusDistortion;
        
        // Calculate position with multiple influences
        const baseX = Math.cos(particle.angle) * finalRadius;
        const baseY = Math.sin(particle.angle) * finalRadius * 0.6; // Elliptical
        
        // Apply transformations
        const x = centerX + baseX + orbitX + mouseInfluenceX * 0.5;
        const y = centerY + baseY + orbitY + mouseInfluenceY * 0.5;
        
        // Distance-based effects
        const distance = Math.sqrt(Math.pow(x - centerX, 2) + Math.pow(y - centerY, 2));
        const maxDistance = 600;
        const distanceFade = Math.max(0, 1 - distance / maxDistance);
        const blackHoleFade = distance < 100 ? distance / 100 : 1;
        
        // Dynamic color with iridescent effect
        const hueShift = Math.sin(time * 0.0015 + index * 0.1) * 80;
        const finalHue = (particle.hue + hueShift + time * 0.15) % 360;
        const saturation = 70 + Math.sin(time * 0.002 + index * 0.5) * 30;
        const lightness = 45 + Math.sin(time * 0.003 + index * 0.3) * 25;
        
        // Draw particle with multiple layers
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        ctx.globalAlpha = particle.opacity * distanceFade * blackHoleFade * 0.9;
        
        // Outer glow layer
        const glowSize = particle.size * 5 + Math.sin(time * 0.01 + particle.phase) * 2;
        const glowGradient = ctx.createRadialGradient(x, y, 0, x, y, glowSize);
        glowGradient.addColorStop(0, `hsla(${finalHue}, ${saturation}%, ${lightness + 20}%, 0.8)`);
        glowGradient.addColorStop(0.3, `hsla(${finalHue}, ${saturation}%, ${lightness}%, 0.4)`);
        glowGradient.addColorStop(0.6, `hsla(${(finalHue + 30) % 360}, ${saturation}%, ${lightness}%, 0.2)`);
        glowGradient.addColorStop(1, `hsla(${(finalHue + 60) % 360}, ${saturation}%, ${lightness}%, 0)`);
        
        ctx.fillStyle = glowGradient;
        ctx.beginPath();
        ctx.arc(x, y, glowSize, 0, Math.PI * 2);
        ctx.fill();
        
        // Middle bright layer
        ctx.globalAlpha = particle.opacity * distanceFade * blackHoleFade;
        const midGradient = ctx.createRadialGradient(x, y, 0, x, y, particle.size * 2);
        midGradient.addColorStop(0, `hsla(${finalHue}, 100%, 70%, 1)`);
        midGradient.addColorStop(0.5, `hsla(${finalHue}, 100%, 60%, 0.8)`);
        midGradient.addColorStop(1, `hsla(${finalHue}, 100%, 50%, 0)`);
        
        ctx.fillStyle = midGradient;
        ctx.beginPath();
        ctx.arc(x, y, particle.size * 2, 0, Math.PI * 2);
        ctx.fill();
        
        // Inner core
        ctx.fillStyle = `hsla(${finalHue}, 100%, 90%, 1)`;
        ctx.beginPath();
        ctx.arc(x, y, particle.size * 0.5, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.restore();
      });

      // Draw central black hole with event horizon effect
      const blackHoleGradient = ctx.createRadialGradient(
        centerX + mouseInfluenceX * 0.3,
        centerY + mouseInfluenceY * 0.3,
        0,
        centerX + mouseInfluenceX * 0.3,
        centerY + mouseInfluenceY * 0.3,
        200
      );
      blackHoleGradient.addColorStop(0, 'rgba(0, 0, 0, 1)');
      blackHoleGradient.addColorStop(0.5, 'rgba(0, 0, 0, 0.98)');
      blackHoleGradient.addColorStop(0.7, 'rgba(0, 0, 0, 0.9)');
      blackHoleGradient.addColorStop(0.9, 'rgba(0, 0, 0, 0.5)');
      blackHoleGradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
      
      ctx.fillStyle = blackHoleGradient;
      ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);

      // Event horizon glow rings
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      
      for (let i = 0; i < 3; i++) {
        const ringRadius = 150 + i * 30 + Math.sin(time * 0.002 + i) * 10;
        const ringGradient = ctx.createRadialGradient(
          centerX + mouseInfluenceX * 0.2,
          centerY + mouseInfluenceY * 0.2,
          ringRadius - 10,
          centerX + mouseInfluenceX * 0.2,
          centerY + mouseInfluenceY * 0.2,
          ringRadius + 20
        );
        
        const hue = (time * 0.3 + i * 120) % 360;
        ringGradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
        ringGradient.addColorStop(0.5, `hsla(${hue}, 70%, 50%, ${0.3 - i * 0.08})`);
        ringGradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
        
        ctx.fillStyle = ringGradient;
        ctx.globalAlpha = 0.6 - i * 0.15;
        ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);
      }
      ctx.restore();

      // Light distortion effect near event horizon
      ctx.save();
      ctx.globalCompositeOperation = 'color-dodge';
      ctx.globalAlpha = 0.3;
      
      for (let i = 0; i < 5; i++) {
        const angle = (i / 5) * Math.PI * 2 + time * 0.001;
        const x = centerX + Math.cos(angle) * 180 + mouseInfluenceX * 0.4;
        const y = centerY + Math.sin(angle) * 180 * 0.6 + mouseInfluenceY * 0.4;
        
        const lightGradient = ctx.createRadialGradient(x, y, 0, x, y, 100);
        const hue = (time * 0.5 + i * 72) % 360;
        lightGradient.addColorStop(0, `hsla(${hue}, 100%, 70%, 0.5)`);
        lightGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
        
        ctx.fillStyle = lightGradient;
        ctx.fillRect(x - 100, y - 100, 200, 200);
      }
      ctx.restore();

      time++;
      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      window.removeEventListener('mousemove', handleMouseMove);
      cancelAnimationFrame(animationRef.current);
    };
  }, []);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    const prompt = promptText.trim();
    if (!prompt) return;

    try {
      console.log("[hero] starting fetch → /api/generate", { prompt });

      const r = await fetch("/api/generate", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, promptText: prompt }),
      });

      const ct = r.headers.get("content-type") || "";
      const bodyText = await r.text();
      const data =
        ct.includes("application/json") && bodyText ? JSON.parse(bodyText) : {};

      console.log("[hero] status:", r.status, "data:", data);

      if (!r.ok) {
        const msg =
          (data as any)?.message ||
          (data as any)?.error ||
          r.statusText ||
          "Request failed";
        const err: any = new Error(msg);
        err.status = r.status;
        err.body = data;
        throw err;
      }

      const id =
        (data as any).jobId ||
        (data as any).id ||
        (data as any)?.job?.id ||
        (data as any)?.data?.jobId ||
        (data as any)?.data?.id;

      if (!id) throw new Error("No jobId in response");

      const target = `/workspace/${id}`;
      console.log("[hero] redirect →", target);
      window.location.assign(target);
      setTimeout(() => {
        window.location.href = target;
      }, 50);
    } catch (err: any) {
      if (err?.status === 401) {
        toast({
          title: "Sign in required",
          description: "Please sign in to create a project.",
          variant: "destructive",
        });
        return;
      }
      console.error("[hero] error:", err);
      toast({
        title: "Create failed",
        description: err?.message || "Request failed",
        variant: "destructive",
      });
    }
  }

  return (
    <section className="relative flex min-h-[calc(100vh-64px)] items-center justify-center overflow-hidden bg-[#020617] text-slate-50">
      {/* Canvas for animated black hole effect */}
      <canvas 
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
        style={{ 
          filter: 'contrast(1.1) saturate(1.2)',
        }}
      />

      {/* Additional color enhancement layers */}
      <div className="absolute inset-0 mix-blend-color-dodge opacity-30">
        <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-blue-600 via-transparent to-purple-600 animate-pulse" style={{ animationDuration: '4s' }} />
        <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-tl from-orange-600 via-transparent to-pink-600 animate-pulse" style={{ animationDuration: '5s', animationDelay: '2s' }} />
      </div>
      
      {/* Grain/noise texture overlay for depth */}
      <div 
        className="absolute inset-0 opacity-[0.12] mix-blend-overlay pointer-events-none"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='0.5'/%3E%3C/svg%3E")`,
          backgroundRepeat: 'repeat',
          backgroundSize: '128px 128px'
        }}
      />

      {/* Vignette effect */}
      <div className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(circle at center, transparent 30%, rgba(2, 6, 23, 0.6) 100%)'
        }}
      />

      {/* Content Container */}
      <div className="relative z-10 mx-auto flex w-full max-w-5xl flex-col items-center px-4 py-16 sm:px-6 lg:px-8">
        {/* Main Headline with Glow Effect */}
        <div className="mb-8 relative">
          {/* Glow behind text */}
          <div className="absolute inset-0 blur-3xl opacity-50">
            <div className="w-full h-full bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 animate-gradient-shift" />
          </div>
          
          <h1 className="relative text-center text-5xl font-bold tracking-tight sm:text-6xl md:text-7xl lg:text-8xl">
            <span className="bg-gradient-to-br from-blue-300 via-white to-purple-300 bg-clip-text text-transparent animate-shimmer">
              From Idea to Digital
            </span>
            <span className="block mt-2 bg-gradient-to-br from-purple-300 via-white to-orange-300 bg-clip-text text-transparent animate-shimmer" 
                  style={{ animationDelay: '0.3s' }}>
              Reality
            </span>
          </h1>
        </div>

        {/* Tagline with subtle animation */}
        <p className="mb-12 text-xs font-bold tracking-[0.45em] text-white/70 uppercase animate-fade-in" 
           style={{ animationDelay: '0.5s' }}>
          BUILD SMARTER. LAUNCH FASTER
        </p>

        {/* Glassmorphic Prompt Bar */}
        <div className="w-full max-w-3xl rounded-full border border-white/10 bg-white/5 backdrop-blur-xl backdrop-saturate-150 px-3 py-2 shadow-2xl shadow-black/50 animate-fade-in" 
             style={{ animationDelay: '0.7s' }}>
          <form
            className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4"
            onSubmit={handleCreate}
          >
            <label htmlFor="hero-idea-input" className="sr-only">
              Describe your website or app idea
            </label>

            <input
              id="hero-idea-input"
              type="text"
              value={promptText}
              onChange={(e) => setPromptText(e.target.value)}
              placeholder="Describe your website or app idea..."
              className="w-full rounded-full bg-white/5 px-5 py-3 text-sm text-white placeholder:text-white/40 outline-none ring-0 transition-all duration-300 border border-transparent hover:bg-white/10 focus:border-white/20 focus:bg-white/10 sm:text-base"
            />

            <Button
              type="submit"
              className="h-[46px] shrink-0 rounded-full bg-gradient-to-r from-purple-500 via-pink-500 to-orange-500 px-8 text-sm font-semibold text-white shadow-lg shadow-purple-500/25 hover:shadow-xl hover:shadow-purple-500/40 transition-all duration-300 hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent animate-gradient-shift"
            >
              Create
            </Button>
          </form>

          <div className="mt-2 flex items-center justify-center pb-1">
            <button
              type="button"
              className="text-xs font-medium text-white/50 transition-colors hover:text-white/80"
            >
              or Explore previews →
            </button>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes gradient-shift {
          0%, 100% {
            background-position: 0% 50%;
          }
          50% {
            background-position: 100% 50%;
          }
        }

        @keyframes shimmer {
          0%, 100% {
            opacity: 0.8;
            filter: brightness(1);
          }
          50% {
            opacity: 1;
            filter: brightness(1.2);
          }
        }

        @keyframes fade-in {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .animate-gradient-shift {
          background-size: 200% 200%;
          animation: gradient-shift 3s ease infinite;
        }

        .animate-shimmer {
          animation: shimmer 3s ease-in-out infinite;
          background-size: 200% 200%;
        }

        .animate-fade-in {
          animation: fade-in 1s ease-out forwards;
        }
      `}</style>
    </section>
  );
}