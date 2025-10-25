import { useEffect, useMemo, useState } from "react";
import { getSocket } from "@/lib/socket";

export default function FilePresence({
  projectId,
  filePath,
}: {
  projectId: string;
  filePath: string | undefined;
}) {
  const [users, setUsers] = useState<{ userId: string; username: string }[]>([]);

  useEffect(() => {
    if (!projectId || !filePath) return;
    const s = getSocket();
    const onPresence = (p: {
      projectId: string;
      filePath: string;
      users: { userId: string; username: string }[];
    }) => {
      if (p.projectId === projectId && p.filePath === filePath) setUsers(p.users);
    };

    s.emit("file:join", { projectId, filePath });
    s.on("file:presence", onPresence);

    return () => {
      s.emit("file:leave", { projectId, filePath });
      s.off("file:presence", onPresence);
    };
  }, [projectId, filePath]);

  const handles = useMemo(
    () =>
      users
        .map((u) => (u.username || "").split("@")[0].replace(/[^a-z0-9_-]/gi, "-"))
        .slice(0, 6),
    [users]
  );

  if (!filePath) return null;

  return (
    <div className="text-[11px] text-muted-foreground flex gap-1 items-center">
      <span className="opacity-70">In this file:</span>
      {handles.length === 0 ? (
        <span>just you</span>
      ) : (
        <>
          {handles.map((h) => (
            <span key={h} className="px-1 rounded bg-muted">{h}</span>
          ))}
          {users.length > 6 && <span>+{users.length - 6}</span>}
        </>
      )}
    </div>
  );
}
