import { useState, useEffect, useCallback, useRef } from "react";

interface ResizableSplitterProps {
  leftPane: React.ReactNode | ((isCompact: boolean) => React.ReactNode);
  rightPane: React.ReactNode;
  defaultLeftPercent?: number;
  minLeftWidth?: number;
  minRightWidth?: number;
  storageKey?: string;
  compactThreshold?: number;
}

export function useResizableSplitter(defaultLeftPercent: number) {
  const [leftPercent, setLeftPercent] = useState(defaultLeftPercent);
  
  return {
    leftPercent,
    setLeftPercent,
  };
}

export default function ResizableSplitter({
  leftPane,
  rightPane,
  defaultLeftPercent = 33,
  minLeftWidth = 240,
  minRightWidth = 560,
  storageKey = "workspaceSplit",
  compactThreshold = 26,
}: ResizableSplitterProps) {
  const [leftPercent, setLeftPercent] = useState(() => {
    const saved = localStorage.getItem(storageKey);
    let initial = saved ? parseFloat(saved) : defaultLeftPercent;
    
    // Clamp initial value to 18%-50% range
    initial = Math.max(18, Math.min(50, initial));
    
    // Save clamped value back to localStorage
    localStorage.setItem(storageKey, initial.toString());
    
    return initial;
  });
  
  // Track current width during drag for immediate compact mode updates
  const [currentLeftPercent, setCurrentLeftPercent] = useState(leftPercent);
  
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const splitterRef = useRef<HTMLDivElement>(null);
  const rafId = useRef<number | null>(null);

  // Check for reduced motion preference
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Pointer Events - unified handler for mouse/touch/pen
  const handlePointerDown = (e: React.PointerEvent) => {
    if (!splitterRef.current || !containerRef.current) return;
    
    // Capture pointer for reliable tracking
    splitterRef.current.setPointerCapture(e.pointerId);
    setIsDragging(true);
  };

  const handlePointerMove = useCallback(
    (e: PointerEvent) => {
      if (!isDragging || !containerRef.current) return;

      // Skip if rAF already pending (prevent queuing)
      if (rafId.current !== null) return;

      rafId.current = requestAnimationFrame(() => {
        rafId.current = null;

        if (!containerRef.current) return;

        const rect = containerRef.current.getBoundingClientRect();
        const containerWidth = rect.width;
        
        // Calculate position relative to container
        const mouseX = e.clientX - rect.left;
        let leftPct = (mouseX / containerWidth) * 100;

        // Apply constraints: 18% min, 50% max for left pane
        const minLeftPercent = Math.max(18, (minLeftWidth / containerWidth) * 100);
        const maxLeftPercent = Math.min(50, 100 - (minRightWidth / containerWidth) * 100);

        leftPct = Math.max(minLeftPercent, Math.min(maxLeftPercent, leftPct));

        // Update CSS variable (cheap, no React re-render)
        containerRef.current.style.setProperty('--left-width-pct', `${leftPct}%`);
        
        // Update current percent for immediate compact mode detection
        setCurrentLeftPercent(leftPct);
      });
    },
    [isDragging, minLeftWidth, minRightWidth]
  );

  const handlePointerUp = useCallback(
    (e: PointerEvent) => {
      if (!splitterRef.current || !containerRef.current) return;

      // Release pointer capture
      splitterRef.current.releasePointerCapture((e as PointerEvent).pointerId);

      // NOW update React state for persistence
      const finalPct = containerRef.current.style.getPropertyValue('--left-width-pct') || `${leftPercent}%`;
      const numericPct = parseFloat(finalPct);
      
      setLeftPercent(numericPct);
      localStorage.setItem(storageKey, numericPct.toString());

      setIsDragging(false);

      // Cancel any pending rAF
      if (rafId.current !== null) {
        cancelAnimationFrame(rafId.current);
        rafId.current = null;
      }
    },
    [leftPercent, storageKey]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!containerRef.current) return;

      const container = containerRef.current;
      const containerWidth = container.getBoundingClientRect().width;
      const step = 2; // 2% step for arrow keys

      let newLeftPercent = leftPercent;

      if (e.key === "ArrowLeft") {
        e.preventDefault();
        newLeftPercent = leftPercent - step;
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        newLeftPercent = leftPercent + step;
      }

      // Apply constraints: 18% min, 50% max for left pane
      const minLeftPercent = Math.max(18, (minLeftWidth / containerWidth) * 100);
      const maxLeftPercent = Math.min(50, 100 - (minRightWidth / containerWidth) * 100);

      newLeftPercent = Math.max(minLeftPercent, Math.min(maxLeftPercent, newLeftPercent));

      if (newLeftPercent !== leftPercent) {
        setLeftPercent(newLeftPercent);
        localStorage.setItem(storageKey, newLeftPercent.toString());
      }
    },
    [leftPercent, minLeftWidth, minRightWidth, storageKey]
  );

  // Pointer event listeners
  useEffect(() => {
    if (isDragging) {
      document.addEventListener("pointermove", handlePointerMove);
      document.addEventListener("pointerup", handlePointerUp);
      
      return () => {
        document.removeEventListener("pointermove", handlePointerMove);
        document.removeEventListener("pointerup", handlePointerUp);
      };
    }
  }, [isDragging, handlePointerMove, handlePointerUp]);

  // Set initial CSS variable on mount to ensure it's always in sync with clamped leftPercent
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.style.setProperty('--left-width-pct', `${leftPercent}%`);
    }
  }, []); // Run once on mount

  // Update CSS variable when leftPercent changes (for keyboard/storage updates)
  useEffect(() => {
    if (containerRef.current && !isDragging) {
      containerRef.current.style.setProperty('--left-width-pct', `${leftPercent}%`);
    }
  }, [leftPercent, isDragging]);

  const transitionStyle = prefersReducedMotion || isDragging ? {} : { transition: "width 0.1s ease" };
  
  // Determine if we're in compact mode - use currentLeftPercent during drag for immediate updates
  const isCompact = currentLeftPercent <= compactThreshold;
  
  // Sync currentLeftPercent with leftPercent when not dragging
  useEffect(() => {
    if (!isDragging) {
      setCurrentLeftPercent(leftPercent);
    }
  }, [leftPercent, isDragging]);

  return (
    <div 
      ref={containerRef} 
      className="flex h-full w-full"
      style={{ '--left-width-pct': `${leftPercent}%` } as React.CSSProperties}
    >
      {/* Left Pane - Uses CSS variable for width */}
      <div
        style={{
          width: 'var(--left-width-pct)',
          ...transitionStyle,
        }}
        className={`overflow-x-hidden ${isCompact ? 'left--compact' : ''}`}
      >
        {typeof leftPane === 'function' ? leftPane(isCompact) : leftPane}
      </div>

      {/* Splitter */}
      <div
        ref={splitterRef}
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize workspace panels"
        tabIndex={0}
        onPointerDown={handlePointerDown}
        onKeyDown={handleKeyDown}
        className={`
          w-1 bg-border hover:bg-primary/50 cursor-col-resize
          focus:outline-none focus:ring-2 focus:ring-primary focus:bg-primary
          ${isDragging ? "bg-primary" : ""}
        `}
        data-testid="splitter-vertical"
      />

      {/* Right Pane */}
      <div
        style={{
          width: `calc(100% - var(--left-width-pct))`,
          ...transitionStyle,
        }}
        className="overflow-hidden"
      >
        {rightPane}
      </div>
    </div>
  );
}
