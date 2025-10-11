import { motion } from "framer-motion";
import { ExternalLink } from "lucide-react";

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
      className="card-glass group cursor-pointer overflow-visible"
      onClick={onClick}
      data-testid={`card-preview-${id}`}
      whileHover={{ y: -8 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="gloss-sheen" />
      
      <div className="relative p-6 space-y-4">
        {/* Preview thumbnail area */}
        <div className="aspect-video bg-gradient-to-br from-neutral-800 to-neutral-900 dark:from-neutral-900 dark:to-black rounded-md overflow-hidden border border-border/30">
          <div className="w-full h-full flex items-center justify-center">
            <div className="text-6xl font-bold opacity-10">{id}</div>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              {category}
            </span>
            <ExternalLink className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
          
          <h3 className="text-lg font-semibold text-foreground">{title}</h3>
          <p className="text-sm text-muted-foreground line-clamp-2">{description}</p>
        </div>
      </div>
    </motion.div>
  );
}
