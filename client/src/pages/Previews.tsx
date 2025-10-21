import PreviewsList from "@/components/previews/PreviewsList";

export default function Previews() {
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-2">Previews</h1>
      <p className="text-sm text-zinc-600 mb-6">Open, export, or deploy your forks.</p>
      <PreviewsList />
    </div>
  );
}
