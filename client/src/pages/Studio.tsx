import Header from "@/components/Header";
import Hero from "@/components/Hero";
import Showcase from "@/components/Showcase";
import ChatDock from "@/components/ChatDock";

export default function Studio() {
  return (
    <div className="min-h-screen bg-background">
      {/* Sticky global header */}
      <Header />

      {/* Main content */}
      <main className="pt-0">
        <Hero />
        <Showcase />
      </main>

      {/* Right-edge chat dock on Home */}
      <ChatDock />
    </div>
  );
}
