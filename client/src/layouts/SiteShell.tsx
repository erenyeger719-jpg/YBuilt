import { Link, useLocation } from "wouter";
import React from "react";

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  const [loc] = useLocation();
  const active = loc === href;
  return (
    <Link href={href}>
      <a
        className={[
          "text-sm px-2 py-1 rounded-md transition-colors",
          active
            ? "bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-white"
            : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white",
        ].join(" ")}
      >
        {children}
      </a>
    </Link>
  );
}

export default function SiteShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-white text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <header className="sticky top-0 z-10 border-b bg-white/70 dark:bg-zinc-950/70 backdrop-blur supports-[backdrop-filter]:bg-white/60">
        <div className="mx-auto max-w-6xl px-4 h-14 flex items-center gap-4">
          <a href="/" className="font-semibold tracking-tight">ybuilt</a>
          <nav className="flex items-center gap-1">
            <NavLink href="/">Studio</NavLink>
            <NavLink href="/templates">Templates</NavLink>
            <NavLink href="/previews">Previews</NavLink>
            <NavLink href="/docs">Docs</NavLink>
          </nav>
          <div className="ml-auto text-xs text-zinc-500">v1</div>
        </div>
      </header>

      <main className="flex-1 mx-auto max-w-6xl w-full px-4 py-6 md:py-10">
        {children}
      </main>

      <footer className="border-t text-xs text-zinc-500">
        <div className="mx-auto max-w-6xl px-4 py-6">© {new Date().getFullYear()} ybuilt</div>
      </footer>
    </div>
  );
}
