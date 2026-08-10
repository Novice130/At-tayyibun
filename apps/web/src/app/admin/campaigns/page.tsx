"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

type CampaignStatus = "DRAFT" | "SENDING" | "SENT";

type TargetAudience = {
  roles?: Array<"USER" | "ADMIN" | "SUPER_ADMIN">;
  membershipTiers?: Array<"FREE" | "SILVER" | "GOLD">;
};

type Campaign = {
  id: string;
  name: string | null;
  subject: string;
  template: string;
  status: CampaignStatus;
  scheduledAt: string | null;
  sentAt: string | null;
  totalRecipients: number;
  sentCount: number;
  targetAudience: TargetAudience | null;
};

type Draft = {
  id?: string;
  name: string;
  subject: string;
  template: string;
  scheduledAt: string | null;
  targetAudience: TargetAudience;
};

const EMPTY_DRAFT: Draft = {
  name: "",
  subject: "",
  template: "",
  scheduledAt: null,
  targetAudience: {},
};

const ROLE_OPTIONS: Array<TargetAudience["roles"] extends Array<infer R> | undefined ? R : never> = [
  "USER",
  "ADMIN",
  "SUPER_ADMIN",
];
const TIER_OPTIONS: Array<"FREE" | "SILVER" | "GOLD"> = ["FREE", "SILVER", "GOLD"];

export default function AdminCampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchCampaigns();
  }, []);

  const fetchCampaigns = async () => {
    try {
      setLoading(true);
      const res = await api.get("/admin/campaigns");
      setCampaigns(res.data || []);
    } catch (err: any) {
      setError(err.message || "Failed to load campaigns");
    } finally {
      setLoading(false);
    }
  };

  const openCreate = () => {
    setDraft(EMPTY_DRAFT);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setDraft(EMPTY_DRAFT);
  };

  const toggleRole = (role: "USER" | "ADMIN" | "SUPER_ADMIN") => {
    const current = new Set(draft.targetAudience.roles ?? []);
    if (current.has(role)) current.delete(role);
    else current.add(role);
    setDraft({
      ...draft,
      targetAudience: { ...draft.targetAudience, roles: Array.from(current) },
    });
  };

  const toggleTier = (tier: "FREE" | "SILVER" | "GOLD") => {
    const current = new Set(draft.targetAudience.membershipTiers ?? []);
    if (current.has(tier)) current.delete(tier);
    else current.add(tier);
    setDraft({
      ...draft,
      targetAudience: { ...draft.targetAudience, membershipTiers: Array.from(current) },
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      await api.post("/admin/campaigns", draft);
      closeModal();
      fetchCampaigns();
    } catch (err: any) {
      alert(err.message || "Failed to save campaign");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDispatch = async (id: string) => {
    if (!confirm("Dispatch this campaign now? Emails are queued immediately and cannot be recalled.")) return;
    try {
      await api.post(`/admin/campaigns/${id}/dispatch`);
      fetchCampaigns();
    } catch (err: any) {
      alert(err.message || "Failed to dispatch campaign");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this campaign?")) return;
    try {
      await api.delete(`/admin/campaigns/${id}`);
      fetchCampaigns();
    } catch (err: any) {
      alert(err.message || "Failed to delete campaign");
    }
  };

  const statusBadge = (s: CampaignStatus) => {
    if (s === "SENT") return <Badge variant="success">SENT</Badge>;
    if (s === "SENDING") return <Badge variant="default">SENDING</Badge>;
    return <Badge variant="warning">DRAFT</Badge>;
  };

  if (loading) return <div className="p-8 text-slate-500">Loading campaigns...</div>;
  if (error) return <div className="p-8 text-red-500">{error}</div>;

  return (
    <div className="space-y-6 p-4 sm:p-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Email Campaigns</h1>
          <p className="text-slate-500 mt-1 text-sm">Create and dispatch campaigns. Queued for background send via BullMQ.</p>
        </div>
        <Button onClick={openCreate}>Create Campaign</Button>
      </div>

      <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 border-b">
              <tr>
                <th className="p-4 font-medium text-slate-700">Name</th>
                <th className="p-4 font-medium text-slate-700">Subject</th>
                <th className="p-4 font-medium text-slate-700">Status</th>
                <th className="p-4 font-medium text-slate-700">Recipients</th>
                <th className="p-4 font-medium text-slate-700">Scheduled / Sent</th>
                <th className="p-4 font-medium text-right text-slate-700">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {campaigns.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                  <td className="p-4 font-semibold text-primary">{c.name || "—"}</td>
                  <td className="p-4 text-slate-600">{c.subject}</td>
                  <td className="p-4">{statusBadge(c.status)}</td>
                  <td className="p-4 text-xs text-slate-600">
                    {c.status === "DRAFT" ? "—" : `${c.sentCount} / ${c.totalRecipients}`}
                  </td>
                  <td className="p-4 text-xs text-slate-500">
                    <div className="space-y-1">
                      <div>
                        <span className="text-slate-400">Sched:</span>{" "}
                        {c.scheduledAt ? format(new Date(c.scheduledAt), "MMM d, yyyy HH:mm") : "N/A"}
                      </div>
                      {c.sentAt && (
                        <div>
                          <span className="text-slate-400">Sent:</span>{" "}
                          {format(new Date(c.sentAt), "MMM d, yyyy HH:mm")}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="p-4 text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDispatch(c.id)}
                        disabled={c.status !== "DRAFT"}
                      >
                        Dispatch
                      </Button>
                      <Button variant="destructive" size="sm" onClick={() => handleDelete(c.id)}>
                        Delete
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {campaigns.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-12 text-center text-slate-500">
                    No campaigns yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-lg w-full p-8 shadow-2xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold mb-6 text-slate-900">New Email Campaign</h2>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-semibold mb-1.5 text-slate-700">Campaign Name</label>
                <Input
                  type="text"
                  required
                  placeholder="Ramadan Special"
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1.5 text-slate-700">Email Subject</label>
                <Input
                  type="text"
                  required
                  placeholder="Exciting update inside"
                  value={draft.subject}
                  onChange={(e) => setDraft({ ...draft, subject: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1.5 text-slate-700">HTML Template</label>
                <Textarea
                  required
                  rows={6}
                  placeholder="<p>Hello {{name}}...</p>"
                  value={draft.template}
                  onChange={(e) => setDraft({ ...draft, template: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-sm font-semibold mb-2 text-slate-700">Target Roles</label>
                <div className="flex flex-wrap gap-2">
                  {ROLE_OPTIONS.map((r) => {
                    const active = draft.targetAudience.roles?.includes(r) ?? false;
                    return (
                      <button
                        type="button"
                        key={r}
                        onClick={() => toggleRole(r!)}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium border transition ${
                          active
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                        }`}
                      >
                        {r}
                      </button>
                    );
                  })}
                </div>
                <p className="text-xs text-slate-400 mt-1">Empty = all roles</p>
              </div>

              <div>
                <label className="block text-sm font-semibold mb-2 text-slate-700">Target Membership Tiers</label>
                <div className="flex flex-wrap gap-2">
                  {TIER_OPTIONS.map((t) => {
                    const active = draft.targetAudience.membershipTiers?.includes(t) ?? false;
                    return (
                      <button
                        type="button"
                        key={t}
                        onClick={() => toggleTier(t)}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium border transition ${
                          active
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                        }`}
                      >
                        {t}
                      </button>
                    );
                  })}
                </div>
                <p className="text-xs text-slate-400 mt-1">Empty = all tiers</p>
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1.5 text-slate-700">Scheduled For (optional)</label>
                <Input
                  type="datetime-local"
                  value={draft.scheduledAt ? new Date(draft.scheduledAt).toISOString().slice(0, 16) : ""}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      scheduledAt: e.target.value ? new Date(e.target.value).toISOString() : null,
                    })
                  }
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button type="button" variant="ghost" onClick={closeModal}>
                  Cancel
                </Button>
                <Button type="submit" disabled={submitting} className="min-w-[100px]">
                  {submitting ? "Saving..." : "Create"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
