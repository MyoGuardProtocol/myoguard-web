"use client";
import { useState } from "react";

type Application = {
  id:          string;
  name:        string;
  email:       string;
  country:     string;
  specialty:   string;
  license:     string | null;
  npi:         string | null;
  status:      string;
  submittedAt: Date;
  reviewNote:  string | null;
};

export default function AdminPhysicianList({
  applications,
}: {
  applications: Application[];
}) {
  const [list,    setList]    = useState(applications);
  const [loading, setLoading] = useState<string | null>(null);
  const [notes,   setNotes]   = useState<Record<string, string>>({});

  async function handleAction(id: string, action: "APPROVE" | "REJECT") {
    setLoading(id + action);
    const res = await fetch("/api/admin/physician-review", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ id, action, note: notes[id] ?? "" }),
    });
    if (res.ok) {
      const updated = await res.json() as { status: string };
      setList(prev =>
        prev.map(a => a.id === id ? { ...a, status: updated.status } : a)
      );
    }
    setLoading(null);
  }

  const STATUS_STYLE: Record<string, string> = {
    PENDING:  "bg-amber-900 text-amber-300 border border-amber-700",
    APPROVED: "bg-teal-900 text-teal-300 border border-teal-700",
    REJECTED: "bg-red-900 text-red-300 border border-red-700",
  };

  return (
    <div className="flex flex-col gap-4">
      {list.map(app => (
        <div key={app.id} className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col gap-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex flex-col gap-1">
              <p className="text-sm font-semibold text-white">{app.name}</p>
              <p className="text-xs text-slate-400">{app.email}</p>
              <p className="text-xs text-slate-500">{app.specialty} · {app.country}</p>
              {app.npi && (
                <p className="text-xs text-slate-500">NPI: {app.npi}</p>
              )}
              <p className="text-xs text-slate-500">
                Licence: {app.license ?? "Not provided"}
              </p>
              <p className="text-xs text-slate-600 mt-1">
                Submitted: {new Date(app.submittedAt).toLocaleString()}
              </p>
            </div>
            <span className={`text-xs font-medium px-3 py-1 rounded-full whitespace-nowrap ${STATUS_STYLE[app.status] ?? ""}`}>
              {app.status}
            </span>
          </div>

          {app.status === "PENDING" && (
            <>
              <textarea
                placeholder="Optional review note (sent to physician on rejection)"
                value={notes[app.id] ?? ""}
                onChange={e => setNotes(prev => ({ ...prev, [app.id]: e.target.value }))}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-300 placeholder-slate-500 resize-none h-16 focus:outline-none focus:ring-1 focus:ring-teal-500"
              />
              <div className="flex gap-3">
                <button
                  onClick={() => handleAction(app.id, "APPROVE")}
                  disabled={loading === app.id + "APPROVE"}
                  className="flex-1 bg-teal-600 hover:bg-teal-500 text-white py-2.5 rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
                >
                  {loading === app.id + "APPROVE" ? "Approving…" : "Approve & Activate"}
                </button>
                <button
                  onClick={() => handleAction(app.id, "REJECT")}
                  disabled={loading === app.id + "REJECT"}
                  className="flex-1 border border-red-800 text-red-400 hover:bg-red-950 py-2.5 rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
                >
                  {loading === app.id + "REJECT" ? "Rejecting…" : "Reject"}
                </button>
              </div>
            </>
          )}
        </div>
      ))}

      {list.length === 0 && (
        <div className="text-center py-16 text-slate-500 text-sm">
          No physician applications yet.
        </div>
      )}
    </div>
  );
}
