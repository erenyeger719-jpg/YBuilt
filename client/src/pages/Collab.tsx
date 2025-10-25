import React, { Suspense, lazy } from "react";
import { useSearch } from "wouter";

const ProjectChat = lazy(() => import("@/components/collab/ProjectChat"));
const CommentsPanel = lazy(() => import("@/components/collab/CommentsPanel"));
const LogsPanel = lazy(() => import("@/components/collab/LogsPanel"));
const FilePresence = lazy(() => import("@/components/collab/FilePresence"));

/** Kept for compatibility: other code imports this from the Collab page. */
export function collabUrlForPreview(previewPath: string) {
  // put the previewPath into projectId; server rooms are strings, this is fine
  const q = new URLSearchParams({ projectId: previewPath }).toString();
  return `/Collab?${q}`;
}

function useQueryParam(key: string) {
  const [search] = useSearch(); // e.g. "?projectId=demo&file=src/app/page.tsx"
  const params = new URLSearchParams(search || "");
  return params.get(key) || undefined;
}

export default function CollabPage() {
  const projectId = useQueryParam("projectId") || "demo";
  const currentFilePath = useQueryParam("file");

  return (
    <div className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h1 className="text-sm font-medium">Collaboration</h1>
        {currentFilePath && (
          <Suspense fallback={null}>
            <FilePresence projectId={projectId} filePath={currentFilePath} />
          </Suspense>
        )}
      </div>

      <div className="grid md:grid-cols-3 gap-3">
        <Suspense fallback={<div className="text-xs text-muted-foreground">Loading…</div>}>
          <ProjectChat projectId={projectId} />
        </Suspense>

        <Suspense fallback={<div className="text-xs text-muted-foreground">Loading…</div>}>
          <CommentsPanel projectId={projectId} currentFile={currentFilePath} />
        </Suspense>

        <Suspense fallback={<div className="text-xs text-muted-foreground">Loading…</div>}>
          <LogsPanel />
        </Suspense>
      </div>
    </div>
  );
}
