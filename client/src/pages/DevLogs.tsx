import LogsPane from "@/components/dev/LogsPane";

export default function DevLogs() {
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-3">Live Logs</h1>
      <p className="text-sm text-zinc-600 mb-6">
        Server request logs and browser errors in real time.
      </p>
      <LogsPane />
    </div>
  );
}
