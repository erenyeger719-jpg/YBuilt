import { useState } from "react";
import { motion, type Variants } from "framer-motion";
import PreviewCard from "./PreviewCard";
import PreviewModal from "./PreviewModal";

const mockPreviews = [
  {
    id: 1,
    title: "Modern Portfolio",
    description: "A sleek portfolio website with smooth animations, project showcases, and dark mode support.",
    category: "Portfolio",
    url: "/previews/1/index.html"
  },
  {
    id: 2,
    title: "SaaS Landing Page",
    description: "Professional landing page for SaaS products with pricing tables, feature sections, and CTAs.",
    category: "Landing Page",
    url: "/previews/2/index.html"
  },
  {
    id: 3,
    title: "E-Commerce Store",
    description: "Full-featured online store with product listings, cart functionality, and checkout flow.",
    category: "E-Commerce",
    url: "/previews/3/index.html"
  },
  {
    id: 4,
    title: "Blog Platform",
    description: "Clean blog design with article listings, reading time estimates, and category filters.",
    category: "Blog",
    url: "/previews/4/index.html"
  },
  {
    id: 5,
    title: "Agency Website",
    description: "Creative agency site featuring case studies, team profiles, and contact forms.",
    category: "Agency",
    url: "/previews/5/index.html"
  },
  {
    id: 6,
    title: "Dashboard App",
    description: "Analytics dashboard with charts, metrics, and data visualization components.",
    category: "Dashboard",
    url: "/previews/6/index.html"
  },
  {
    id: 7,
    title: "Restaurant Menu",
    description: "Digital menu with food categories, images, pricing, and online ordering integration.",
    category: "Restaurant",
    url: "/previews/7/index.html"
  },
  {
    id: 8,
    title: "Event Landing",
    description: "Event promotion page with countdown timer, speaker profiles, and registration form.",
    category: "Event",
    url: "/previews/8/index.html"
  },
];

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 30 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.6,
      ease: [0.22, 1, 0.36, 1],
    },
  },
};

export default function Showcase() {
  const [selectedPreview, setSelectedPreview] = useState<typeof mockPreviews[0] | null>(null);

  return (
    <section id="showcase" className="relative py-24 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
        >
          <h2 className="text-4xl md:text-5xl font-bold mb-4 metal-text">
            AI-Generated Showcases
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Explore websites and apps created by our AI. Each one generated from a single prompt.
          </p>
        </motion.div>

        <motion.div
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
        >
          {mockPreviews.map((preview) => (
            <motion.div key={preview.id} variants={itemVariants}>
              <PreviewCard
                id={preview.id}
                title={preview.title}
                description={preview.description}
                category={preview.category}
                onClick={() => setSelectedPreview(preview)}
              />
            </motion.div>
          ))}
        </motion.div>
      </div>

      {selectedPreview && (
        <PreviewModal
          isOpen={!!selectedPreview}
          onClose={() => setSelectedPreview(null)}
          title={selectedPreview.title}
          previewUrl={selectedPreview.url}
        />
      )}
    </section>
  );
}
