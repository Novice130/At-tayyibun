"use client";

import { useCallback, useEffect, useState } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { reportReasonLabel } from "@/lib/moderation";

type ReportStatus = "PENDING" | "REVIEWED" | "DISMISSED" | "ACTIONED";
type ResolveAction = "DISMISS" | "SUSPEND_USER" | "DELETE_USER";

type Report = {
  id: string;
  reason: string;
  details: string | null;
  status: ReportStatus;
  createdAt: string;
  reviewedAt: string | null;
  reporter: { publicId: string; email: string } | null;
  reported: { publicId: string; email: string; name: string | null; suspendedAt: string | null } | null;
};

const FILTERS: Array<{ value: ReportStatus | ""; label: string }> = [
  { value: "PENDING", label: "Pending" },
  { value: "ACTIONED", label: "Actioned" },
  { value: "DISMISSED", label: "Dismissed" },
  { value: "", label: "All" },
];

const CONFIRMATIONS: Record<ResolveAction, (who: string) => string> = {
  DISMISS: () => "Dismiss this report? No action is taken against the member.",
  SUSPEND_USER: (who) => `Suspend ${who}? They lose access and their profile is hidden. This can be lifted from Users.`,
  DELETE_USER: (who) => `Permanently delete ${who} and their data? This cannot be undone.`,
};

export default function AdminReportsPage() {
  const [filter, setFilter] = useState<ReportStatus | "">("PENDING");
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [resolving, setResolving] = useState<string | null>(null);

  const fetchReports = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await api.get(filter ? `/admin/reports?status=${filter}` : "/admin/reports");
      setReports(Array.isArray(res) ? res : []);
    } catch (err: any) {
      setError(err.message || "Failed to load reports");
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  const resolve = async (report: Report, action: ResolveAction) => {
    const who = report.reported?.publicId ?? "this member";
    if (!confirm(CONFIRMATIONS[action](who))) return;
    setResolving(report.id);
    try {
      const note = notes[report.id]?.trim();
      await api.post(`/admin/reports/${report.id}/resolve`, { action, ...(note ? { note } : {}) });
      toast.success("Report resolved");
      fetchReports();
    } catch (err: any) {
      toast.error(err.message || "Failed to resolve report");
    } finally {
      setResolving(null);
    }
  };

  const statusBadge = (s: ReportStatus) => {
    if (s === "PENDING") return <Badge variant="warning">PENDING</Badge>;
    if (s === "ACTIONED") return <Badge variant="success">ACTIONED</Badge>;
    return <Badge variant="default">{s}</Badge>;
  };

  return (
    <div className="space-y-6 p-4 sm:p-8">
      <div>
        <h1 className="text-3xl font-bold text-primary">Reports</h1>
        <p className="text-muted mt-1 text-sm">Member reports, newest first. Shows the latest 100.</p>
      </div>

      <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by status">
        {FILTERS.map((f) => (
          <Button
            key={f.label}
            variant={filter === f.value ? "default" : "outline"}
            size="sm"
            aria-pressed={filter === f.value}
            onClick={() => setFilter(f.value)}
          >
            {f.label}
          </Button>
        ))}
      </div>

      {loading ? (
        <div className="text-muted">Loading reports...</div>
      ) : error ? (
        <div className="text-red-500 dark:text-red-400">{error}</div>
      ) : reports.length === 0 ? (
        <div className="bg-surface rounded-xl border border-theme p-12 text-center text-muted">
          No reports to show.
        </div>
      ) : (
        <div className="space-y-4">
          {reports.map((r) => (
            <article key={r.id} className="bg-surface rounded-xl border border-theme shadow-sm p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-primary">{reportReasonLabel(r.reason)}</span>
                  {statusBadge(r.status)}
                </div>
                <span className="text-xs text-muted">{format(new Date(r.createdAt), "MMM d, yyyy HH:mm")}</span>
              </div>

              <dl className="grid gap-3 sm:grid-cols-2 text-sm">
                <div className="min-w-0">
                  <dt className="text-muted text-xs">Reported member</dt>
                  {r.reported ? (
                    <dd className="text-secondary break-words">
                      {r.reported.name || "Unnamed"} ({r.reported.publicId})
                      <br />
                      {r.reported.email}
                      {r.reported.suspendedAt && <span className="block text-red-500">Suspended</span>}
                    </dd>
                  ) : (
                    <dd className="text-secondary">Account deleted</dd>
                  )}
                </div>
                <div className="min-w-0">
                  <dt className="text-muted text-xs">Reported by</dt>
                  <dd className="text-secondary break-words">
                    {r.reporter ? `${r.reporter.publicId}, ${r.reporter.email}` : "Account deleted"}
                  </dd>
                </div>
              </dl>

              <div className="text-sm">
                <p className="text-muted text-xs">Details from the reporter</p>
                <p className="text-secondary whitespace-pre-line break-words">{r.details || "None given."}</p>
              </div>

              {r.status === "PENDING" ? (
                <div className="space-y-3">
                  <div>
                    <label htmlFor={`note-${r.id}`} className="block text-xs text-muted mb-1">
                      Moderation note (optional, kept in the audit log)
                    </label>
                    <Textarea
                      id={`note-${r.id}`}
                      rows={2}
                      maxLength={1000}
                      value={notes[r.id] ?? ""}
                      onChange={(e) => setNotes({ ...notes, [r.id]: e.target.value })}
                    />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" disabled={resolving === r.id} onClick={() => resolve(r, "DISMISS")}>
                      Dismiss
                    </Button>
                    {r.reported && (
                      <>
                        <Button variant="outline" size="sm" disabled={resolving === r.id} onClick={() => resolve(r, "SUSPEND_USER")}>
                          Suspend member
                        </Button>
                        <Button variant="destructive" size="sm" disabled={resolving === r.id} onClick={() => resolve(r, "DELETE_USER")}>
                          Delete member
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              ) : (
                r.reviewedAt && (
                  <p className="text-xs text-muted">Reviewed {format(new Date(r.reviewedAt), "MMM d, yyyy HH:mm")}</p>
                )
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
