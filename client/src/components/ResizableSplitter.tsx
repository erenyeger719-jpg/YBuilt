import { useState, useEffect, useCallback, useRef } from "react";

interface ResizableSplitterProps {
  leftPane: React.ReactNode;
  rightPane: React.ReactNode;
  defaultLeftPercent?: number;
  minLeftWidth?: number;
  minRightWidth?: number;
  storageKey?: string;
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
}: ResizableSplitterProps) {
  const [leftPercent, setLeftPercent] = useState(() => {
    const saved = localStorage.getItem(storageKey);
    return saved ? parseFloat(saved) : defaultLeftPercent;
  });
  
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const splitterRef = useRef<HTMLDivElement>(null);

  // Check for reduced motion preference
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Save to localStorage whenever leftPercent changes
  useEffect(() => {
    localStorage.setItem(storageKey, leftPercent.toString());
  }, [leftPercent, storageKey]);

  const handleMouseDown = useCallback(() => {
    setIsDragging(true);
  }, []);

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging || !containerRef.current) return;

      const container = containerRef.current;
      const containerRect = container.getBoundingClientRect();
      const containerWidth = containerRect.width;
      
      // Calculate position relative to container
      const mouseX = e.clientX - containerRect.left;
      let newLeftPercent = (mouseX / containerWidth) * 100;

      // Apply min width constraints
      const minLeftPercent = (minLeftWidth / containerWidth) * 100;
      const minRightPercent = 100 - (minRightWidth / containerWidth) * 100;

      newLeftPercent = Math.max(minLeftPercent, Math.min(minRightPercent, newLeftPercent));

      setLeftPercent(newLeftPercent);
    },
    [isDragging, minLeftWidth, minRightWidth]
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleTouchStart = useCallback(() => {
    setIsDragging(true);
  }, []);

  const handleTouchMove = useCallback(
    (e: TouchEvent) => {
      if (!isDragging || !containerRef.current) return;

      const container = containerRef.current;
      const containerRect = container.getBoundingClientRect();
      const containerWidth = containerRect.width;
      
      const touch = e.touches[0];
      const touchX = touch.clientX - containerRect.left;
      let newLeftPercent = (touchX / containerWidth) * 100;

      // Apply min width constraints
      const minLeftPercent = (minLeftWidth / containerWidth) * 100;
      const minRightPercent = 100 - (minRightWidth / containerWidth) * 100;

      newLeftPercent = Math.max(minLeftPercent, Math.min(minRightPercent, newLeftPercent));

      setLeftPercent(newLeftPercent);
    },
    [isDragging, minLeftWidth, minRightWidth]
  );

  const handleTouchEnd = useCallback(() => {
    setIsDragging(false);
  }, []);

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

      // Apply min width constraints
      const minLeftPercent = (minLeftWidth / containerWidth) * 100;
      const minRightPercent = 100 - (minRightWidth / containerWidth) * 100;

      newLeftPercent = Math.max(minLeftPercent, Math.min(minRightPercent, newLeftPercent));

      if (newLeftPercent !== leftPercent) {
        setLeftPercent(newLeftPercent);
      }
    },
    [leftPercent, minLeftWidth, minRightWidth]
  );

  // Mouse event listeners
  useEffect(() => {
    if (isDragging) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      
      return () => {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  // Touch event listeners
  useEffect(() => {
    if (isDragging) {
      document.addEventListener("touchmove", handleTouchMove);
      document.addEventListener("touchend", handleTouchEnd);
      
      return () => {
        document.removeEventListener("touchmove", handleTouchMove);
        document.removeEventListener("touchend", handleTouchEnd);
      };
    }
  }, [isDragging, handleTouchMove, handleTouchEnd]);

  const transitionStyle = prefersReducedMotion || isDragging ? {} : { transition: "width 0.1s ease" };

  return (
    <div ref={containerRef} className="flex h-full w-full">
      {/* Left Pane */}
      <div
        style={{
          width: `${leftPercent}%`,
          ...transitionStyle,
        }}
        className="overflow-hidden"
      >
        {leftPane}
      </div>

      {/* Splitter */}
      <div
        ref={splitterRef}
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize workspace panels"
        tabIndex={0}
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
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
          width: `${100 - leftPercent}%`,
          ...transitionStyle,
        }}
        className="overflow-hidden"
      >
        {rightPane}
      </div>
    </div>
  );
}
