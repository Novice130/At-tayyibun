"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

type Campaign = {
  id: string;
  name: string;
  subject: string;
  status: string;
  scheduledFor: string | null;
  sentAt: string | null;
  targetAudience: any;
};

export default function AdminCampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentCampaign, setCurrentCampaign] = useState<Partial<Campaign>>({
    status: 'draft',
    targetAudience: []
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchCampaigns();
  }, []);

  const fetchCampaigns = async () => {
    try {
      setLoading(true);
      const res = await api.get("/admin/campaigns");
      setCampaigns(res.data.data);
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to load campaigns");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCreateModal = () => {
    setCurrentCampaign({ status: 'draft', targetAudience: [] });
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setCurrentCampaign({});
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      await api.post("/admin/campaigns", currentCampaign);
      handleCloseModal();
      fetchCampaigns();
    } catch (err: any) {
      alert(err.response?.data?.message || "Failed to save campaign");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDispatch = async (id: string) => {
    if (!confirm("Are you sure you want to dispatch this campaign now? This will queue the emails to be sent.")) return;
    try {
      await api.post(`/admin/campaigns/${id}/dispatch`);
      alert("Campaign queued for dispatch successfully!");
      fetchCampaigns();
    } catch (err: any) {
      alert(err.response?.data?.message || "Failed to dispatch campaign");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this campaign?")) return;
    try {
      await api.delete(`/admin/campaigns/${id}`);
      fetchCampaigns();
    } catch (err: any) {
      alert(err.response?.data?.message || "Failed to delete campaign");
    }
  };

  if (loading) return <div className="p-8 text-slate-500">Loading campaigns...</div>;
  if (error) return <div className="p-8 text-red-500">{error}</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Email Campaigns</h1>
          <p className="text-slate-500 mt-1 text-sm">Manage and dispatch automated email campaigns via BullMQ.</p>
        </div>
        <Button onClick={handleOpenCreateModal}>Create Campaign</Button>
      </div>

      <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 border-b">
              <tr>
                <th className="p-4 font-medium text-slate-700">Name</th>
                <th className="p-4 font-medium text-slate-700">Subject</th>
                <th className="p-4 font-medium text-slate-700">Status</th>
                <th className="p-4 font-medium text-slate-700">Scheduled / Sent At</th>
                <th className="p-4 font-medium text-right text-slate-700">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {campaigns.map((camp) => (
                <tr key={camp.id} className="hover:bg-slate-50 transition-colors">
                  <td className="p-4 font-semibold text-primary">{camp.name}</td>
                  <td className="p-4 text-slate-600">{camp.subject}</td>
                  <td className="p-4">
                    <Badge variant={
                      camp.status === 'sent' ? 'success' : 
                      camp.status === 'sending' ? 'default' : 
                      'warning'
                    }>
                      {camp.status.toUpperCase()}
                    </Badge>
                  </td>
                  <td className="p-4 text-xs text-slate-500">
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5 font-medium">
                        <span className="text-slate-400">Sched:</span> 
                        {camp.scheduledFor ? format(new Date(camp.scheduledFor), 'MMM d, yyyy HH:mm') : 'N/A'}
                      </div>
                      {camp.sentAt && (
                        <div className="flex items-center gap-1.5">
                          <span className="text-slate-400">Sent:</span> 
                          {format(new Date(camp.sentAt), 'MMM d, yyyy HH:mm')}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="p-4 text-right">
                    <div className="flex justify-end gap-2">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => handleDispatch(camp.id)}
                        disabled={camp.status === 'sending' || camp.status === 'sent'}
                      >
                        Dispatch Now
                      </Button>
                      <Button variant="destructive" size="sm" onClick={() => handleDelete(camp.id)}>
                        Delete
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {campaigns.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-12 text-center text-slate-500">
                    No active campaigns found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-8 shadow-2xl animate-in fade-in zoom-in duration-200">
            <h2 className="text-2xl font-bold mb-6 text-slate-900">New Email Campaign</h2>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-semibold mb-1.5 text-slate-700">Campaign Name</label>
                <Input
                  type="text"
                  required
                  placeholder="Ramadan Special"
                  value={currentCampaign.name || ""}
                  onChange={(e) => setCurrentCampaign({ ...currentCampaign, name: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1.5 text-slate-700">Email Subject</label>
                <Input
                  type="text"
                  required
                  placeholder="Don't miss our new update!"
                  value={currentCampaign.subject || ""}
                  onChange={(e) => setCurrentCampaign({ ...currentCampaign, subject: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1.5 text-slate-700">Target Tags (comma separated)</label>
                <Input
                  type="text"
                  placeholder="active_users, newsletter"
                  value={currentCampaign.targetAudience?.join(', ') || ""}
                  onChange={(e) => setCurrentCampaign({ ...currentCampaign, targetAudience: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
                />
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1.5 text-slate-700">Scheduled For</label>
                <Input
                  type="datetime-local"
                  value={currentCampaign.scheduledFor ? new Date(currentCampaign.scheduledFor).toISOString().slice(0, 16) : ""}
                  onChange={(e) => setCurrentCampaign({ ...currentCampaign, scheduledFor: e.target.value ? new Date(e.target.value).toISOString() : null })}
                />
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <Button type="button" variant="ghost" onClick={handleCloseModal}>
                  Cancel
                </Button>
                <Button type="submit" disabled={submitting} className="min-w-[100px]">
                  {submitting ? "Saving..." : "Create Campaign"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
