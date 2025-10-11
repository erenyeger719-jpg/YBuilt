import { motion } from "framer-motion";
import { Play } from "lucide-react";

interface PreviewCardProps {
  id: number;
  title: string;
  description: string;
  category: string;
  onClick: () => void;
}

export default function PreviewCard({ id, title, description, category, onClick }: PreviewCardProps) {
  return (
    <motion.div
      className="card-glass group cursor-pointer overflow-visible relative"
      onClick={onClick}
      data-testid={`card-preview-${id}`}
      whileHover={{ y: -8 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="gloss-sheen" />
      
      <div className="relative p-6 space-y-4">
        <div className="aspect-video bg-gradient-to-br from-neutral-800 to-neutral-900 dark:from-neutral-900 dark:to-black rounded-md overflow-hidden border border-border/30 relative group">
          <img 
            src={`/previews/${id}/thumbnail.jpg`}
            alt={title}
            className="w-full h-full object-cover"
            loading="lazy"
          />
          
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-all duration-300 flex items-center justify-center">
            <motion.div
              className="glass-cta-border p-3 rounded-full"
              whileHover={{ scale: 1.1 }}
              transition={{ type: "spring", stiffness: 400, damping: 10 }}
            >
              <Play className="h-6 w-6 text-white" fill="white" />
            </motion.div>
          </div>
          
          <div className="absolute top-2 left-2 glass-cta-border px-3 py-1 rounded-md">
            <span className="text-xs font-medium text-white uppercase tracking-wider">
              {category}
            </span>
          </div>
        </div>

        <div className="space-y-2">
          <h3 className="text-lg font-semibold text-foreground metal-text">{title}</h3>
          <p className="text-sm text-muted-foreground line-clamp-2">{description}</p>
        </div>
      </div>
    </motion.div>
  );
}
