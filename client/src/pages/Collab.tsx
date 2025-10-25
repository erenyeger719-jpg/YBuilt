import dynamic from "next/dynamic";
import { useRouter } from "next/router";

const ProjectChat = dynamic(() => import("@/components/collab/ProjectChat"), { ssr: false });
const CommentsPanel = dynamic(() => import("@/components/collab/CommentsPanel"), { ssr: false });
const LogsPanel = dynamic(() => import("@/components/collab/LogsPanel"), { ssr: false });
const FilePresence = dynamic(() => import("@/components/collab/FilePresence"), { ssr: false });

export default function CollabPage() {
  const { query } = useRouter();
  const projectId = (query.projectId as string) || "demo";
  const currentFilePath = (query.file as string) || undefined;

  return (
    <div className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h1 className="text-sm font-medium">Collaboration</h1>
        {currentFilePath && (
          <FilePresence projectId={projectId} filePath={currentFilePath} />
        )}
      </div>

      <div className="grid md:grid-cols-3 gap-3">
        <ProjectChat projectId={projectId} />
        <CommentsPanel projectId={projectId} currentFile={currentFilePath} />
        <LogsPanel />
      </div>
    </div>
  );
}
