"use client";

import { useEffect, useState } from "react";
import { Loader, Plus, Edit2, Trash2, Ticket, AlertCircle } from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

type Coupon = {
  id: string;
  partnerId: string;
  partnerName?: string | null;
  code: string;
  description: string | null;
  redirectUrl: string;
  isActive: boolean;
  validFrom: string | null;
  validUntil: string | null;
};

export default function AdminCouponsPage() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [currentCoupon, setCurrentCoupon] = useState<Partial<Coupon>>({
    isActive: true,
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchCoupons();
  }, []);

  const fetchCoupons = async () => {
    try {
      setLoading(true);
      const res = await api.get("/admin/coupons");
      setCoupons(res.data || []);
    } catch (err: any) {
      setError(err.message || "Failed to load coupons");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCreateModal = () => {
    setIsEditing(false);
    setCurrentCoupon({ isActive: true });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (coupon: Coupon) => {
    setIsEditing(true);
    setCurrentCoupon(coupon);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setCurrentCoupon({});
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      if (isEditing) {
        await api.patch(`/admin/coupons/${currentCoupon.id}`, currentCoupon);
      } else {
        await api.post("/admin/coupons", currentCoupon);
      }
      handleCloseModal();
      fetchCoupons();
    } catch (err: any) {
      alert(err.message || "Failed to save coupon");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this coupon?")) return;
    try {
      await api.delete(`/admin/coupons/${id}`);
      fetchCoupons();
    } catch (err: any) {
      alert(err.message || "Failed to delete coupon");
    }
  };

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-3xl font-bold mb-1" style={{ color: 'var(--color-text)' }}>
            Coupons
          </h1>
          <p style={{ color: 'var(--color-text-secondary)' }}>
            Partner discount codes that funnel users to external signups.
          </p>
        </div>
        <Button onClick={handleOpenCreateModal} className="flex items-center gap-2">
          <Plus className="w-4 h-4" /> Create Coupon
        </Button>
      </header>

      {error ? (
        <div className="card p-4 flex items-center gap-3 text-red-400 border-red-500/30 bg-red-500/5">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span className="text-sm">{error}</span>
        </div>
      ) : (
        <div className="card overflow-hidden">
          {loading ? (
            <div className="p-10 sm:p-20 flex flex-col items-center justify-center" style={{ color: 'var(--color-text-secondary)' }}>
              <Loader className="w-8 h-8 animate-spin mb-4 text-gold-500" />
              <p className="font-medium">Loading coupons…</p>
            </div>
          ) : coupons.length === 0 ? (
            <div className="flex flex-col items-center p-10 sm:p-20 text-center">
              <div className="w-20 h-20 rounded-full flex items-center justify-center mb-6" style={{ backgroundColor: 'var(--color-gold-100)' }}>
                <Ticket className="w-10 h-10 text-gold-500" />
              </div>
              <h3 className="font-heading text-xl font-bold mb-2" style={{ color: 'var(--color-text)' }}>No coupons yet</h3>
              <p className="max-w-sm mx-auto text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                Create your first coupon to give partners a redirected, branded landing experience.
              </p>
              <Button onClick={handleOpenCreateModal} className="mt-6 flex items-center gap-2">
                <Plus className="w-4 h-4" /> Create coupon
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="border-b" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface-hover)' }}>
                  <tr>
                    <th className="px-6 py-4 font-medium" style={{ color: 'var(--color-text-secondary)' }}>Code</th>
                    <th className="px-6 py-4 font-medium" style={{ color: 'var(--color-text-secondary)' }}>Partner</th>
                    <th className="px-6 py-4 font-medium" style={{ color: 'var(--color-text-secondary)' }}>Description</th>
                    <th className="px-6 py-4 font-medium" style={{ color: 'var(--color-text-secondary)' }}>Status</th>
                    <th className="px-6 py-4 font-medium" style={{ color: 'var(--color-text-secondary)' }}>Valid window</th>
                    <th className="px-6 py-4 font-medium text-right" style={{ color: 'var(--color-text-secondary)' }}>Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y" style={{ borderColor: 'var(--color-border)' }}>
                  {coupons.map((coupon) => (
                    <tr key={coupon.id} className="hover:bg-gold-500/5 transition-colors">
                      <td className="px-6 py-4">
                        <span className="font-mono font-semibold text-gold-500">{coupon.code}</span>
                      </td>
                      <td className="px-6 py-4" style={{ color: 'var(--color-text)' }}>
                        {coupon.partnerName || (
                          <span className="font-mono text-xs" style={{ color: 'var(--color-text-muted)' }}>{coupon.partnerId}</span>
                        )}
                      </td>
                      <td className="px-6 py-4 max-w-xs truncate" style={{ color: 'var(--color-text-secondary)' }}>
                        {coupon.description || <span className="italic" style={{ color: 'var(--color-text-muted)' }}>No description</span>}
                      </td>
                      <td className="px-6 py-4">
                        <Badge variant={coupon.isActive ? 'success' : 'secondary'}>
                          {coupon.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 text-xs">
                        <div style={{ color: 'var(--color-text-secondary)' }}>
                          {coupon.validFrom ? format(new Date(coupon.validFrom), 'MMM d, yyyy') : 'No start date'}
                        </div>
                        <div style={{ color: 'var(--color-text-muted)' }}>
                          {coupon.validUntil ? `→ ${format(new Date(coupon.validUntil), 'MMM d, yyyy')}` : 'No end date'}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={() => handleOpenEditModal(coupon)} title="Edit">
                            <Edit2 className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDelete(coupon.id)} title="Delete" className="hover:text-red-400">
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 sm:p-8 shadow-2xl animate-in fade-in zoom-in duration-200 max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold mb-6 text-slate-900">
              {isEditing ? "Edit Coupon" : "Create New Coupon"}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-5">
              {!isEditing && (
                <div>
                  <label className="block text-sm font-semibold mb-1.5 text-slate-700">Partner ID</label>
                  <Input
                    type="text"
                    required
                    placeholder="partner-123"
                    value={currentCoupon.partnerId || ""}
                    onChange={(e) => setCurrentCoupon({ ...currentCoupon, partnerId: e.target.value })}
                  />
                </div>
              )}
              
              <div>
                <label className="block text-sm font-semibold mb-1.5 text-slate-700">Coupon Code</label>
                <Input
                  type="text"
                  required
                  placeholder="SAVE50"
                  value={currentCoupon.code || ""}
                  onChange={(e) => setCurrentCoupon({ ...currentCoupon, code: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1.5 text-slate-700">Description (Optional)</label>
                <Textarea
                  placeholder="Offer details..."
                  value={currentCoupon.description || ""}
                  onChange={(e) => setCurrentCoupon({ ...currentCoupon, description: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1.5 text-slate-700">Redirect URL</label>
                <Input
                  type="url"
                  required
                  placeholder="https://partner.com/signup"
                  value={currentCoupon.redirectUrl || ""}
                  onChange={(e) => setCurrentCoupon({ ...currentCoupon, redirectUrl: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold mb-1.5 text-slate-700">Valid From</label>
                  <Input
                    type="datetime-local"
                    value={currentCoupon.validFrom ? new Date(currentCoupon.validFrom).toISOString().slice(0, 16) : ""}
                    onChange={(e) => setCurrentCoupon({ ...currentCoupon, validFrom: e.target.value ? new Date(e.target.value).toISOString() : null })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1.5 text-slate-700">Valid Until</label>
                  <Input
                    type="datetime-local"
                    value={currentCoupon.validUntil ? new Date(currentCoupon.validUntil).toISOString().slice(0, 16) : ""}
                    onChange={(e) => setCurrentCoupon({ ...currentCoupon, validUntil: e.target.value ? new Date(e.target.value).toISOString() : null })}
                  />
                </div>
              </div>

              <div className="flex items-center gap-3 py-2">
                <input
                  type="checkbox"
                  id="isActive"
                  className="w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary"
                  checked={currentCoupon.isActive || false}
                  onChange={(e) => setCurrentCoupon({ ...currentCoupon, isActive: e.target.checked })}
                />
                <label htmlFor="isActive" className="text-sm font-semibold text-slate-700 cursor-pointer">Active and Visible</label>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <Button type="button" variant="ghost" onClick={handleCloseModal}>
                  Cancel
                </Button>
                <Button type="submit" disabled={submitting} className="min-w-[100px]">
                  {submitting ? "Saving..." : "Save Coupon"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
