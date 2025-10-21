import { io, Socket } from "socket.io-client";
import { useEffect, useMemo, useState } from "react";

type LogRow = {
  ts: number;
  kind: "request" | "client";
  level: "info" | "warn" | "error" | string;
  reqId?: string;
  method?: string;
  path?: string;
  status?: number;
  ms?: number;
  message?: string;
};

export default function LogsPane() {
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [filter, setFilter] = useState("");

  const sock: Socket = useMemo(() => io("/logs"), []);
  useEffect(() => {
    const onServer = (p: LogRow) =>
      setLogs((L) => [p, ...L].slice(0, 500));
    const onClient = (p: LogRow) =>
      setLogs((L) => [p, ...L].slice(0, 500));

    sock.on("log:server", onServer);
    sock.on("log:client", onClient);
    return () => {
      sock.off("log:server", onServer);
      sock.off("log:client", onClient);
      sock.close();
    };
  }, [sock]);

  const shown = logs.filter((l) => {
    const q = filter.trim().toLowerCase();
    if (!q) return true;
    return (
      (l.path || "").toLowerCase().includes(q) ||
      (l.reqId || "").toLowerCase().includes(q) ||
      (l.message || "").toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <input
          className="border rounded px-2 py-1 text-sm w-full max-w-md"
          placeholder="Filter by path, request id, or text…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        <button
          className="text-xs px-2 py-1 border rounded"
          onClick={() => setLogs([])}
        >
          Clear
        </button>
      </div>

      <div className="overflow-auto border rounded">
        <table className="min-w-full text-sm">
          <thead className="bg-zinc-50">
            <tr className="text-left">
              <th className="p-2">Time</th>
              <th className="p-2">Lvl</th>
              <th className="p-2">Kind</th>
              <th className="p-2">ReqID</th>
              <th className="p-2">Method</th>
              <th className="p-2">Path / Message</th>
              <th className="p-2">Status</th>
              <th className="p-2">ms</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((l, i) => (
              <tr key={i} className="border-t">
                <td className="p-2 whitespace-nowrap">
                  {new Date(l.ts).toLocaleTimeString()}
                </td>
                <td className="p-2">
                  <span
                    className={
                      l.level === "error" ? "text-red-600" :
                      l.level === "warn"  ? "text-amber-600" :
                      "text-zinc-700"
                    }
                  >
                    {l.level}
                  </span>
                </td>
                <td className="p-2">{l.kind}</td>
                <td className="p-2 font-mono text-xs">{l.reqId || "—"}</td>
                <td className="p-2">{l.method || "—"}</td>
                <td className="p-2 break-all">
                  {l.kind === "request" ? (l.path || "—") : (l.message || "—")}
                </td>
                <td className="p-2">{l.status ?? "—"}</td>
                <td className="p-2">{l.ms ?? "—"}</td>
              </tr>
            ))}
            {shown.length === 0 && (
              <tr>
                <td className="p-6 text-zinc-500" colSpan={8}>
                  No logs yet. Hit the site, open pages, trigger a 404, etc.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
