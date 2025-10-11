import PreviewCard from '../PreviewCard'

export default function PreviewCardExample() {
  return (
    <div className="p-8 bg-background grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl">
      <PreviewCard
        id={1}
        title="Modern Portfolio"
        description="A sleek portfolio website with smooth animations and dark mode support."
        category="Portfolio"
        onClick={() => console.log('Preview 1 clicked')}
      />
      <PreviewCard
        id={2}
        title="SaaS Landing"
        description="Professional landing page for SaaS products with pricing tables and features."
        category="Landing Page"
        onClick={() => console.log('Preview 2 clicked')}
      />
    </div>
  )
}
