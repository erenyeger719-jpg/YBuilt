import React from "react";

export default function ReportAbuseButton({ where }: { where: string }) {
  async function send() {
    const reason = prompt("Reason (spam, abuse, other)?") || "";
    const note = prompt("Any details? (optional)") || "";
    try {
      await fetch("/api/abuse/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ reason, where, meta: { note } }),
      });
      alert("Thanks. We logged it.");
    } catch {
      alert("Failed to send. Try again later.");
    }
  }
  return (
    <button className="text-[10px] px-2 py-0.5 border rounded" onClick={send}>
      Report abuse
    </button>
  );
}
