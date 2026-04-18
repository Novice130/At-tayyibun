"use client";

import { useEffect, useState } from "react";
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

  if (loading) return <div className="p-8">Loading...</div>;
  if (error) return <div className="p-8 text-red-500">{error}</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Coupons Management</h1>
        <Button onClick={handleOpenCreateModal}>Create Coupon</Button>
      </div>

      <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 border-b">
              <tr>
                <th className="p-4 font-medium">Code</th>
                <th className="p-4 font-medium">Partner</th>
                <th className="p-4 font-medium">Description</th>
                <th className="p-4 font-medium">Status</th>
                <th className="p-4 font-medium">Valid Dates</th>
                <th className="p-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {coupons.map((coupon) => (
                <tr key={coupon.id} className="hover:bg-slate-50 transition-colors">
                  <td className="p-4 font-semibold text-primary">{coupon.code}</td>
                  <td className="p-4 text-slate-600">{coupon.partnerName || coupon.partnerId}</td>
                  <td className="p-4 max-w-xs truncate text-slate-500">{coupon.description}</td>
                  <td className="p-4">
                    <Badge variant={coupon.isActive ? 'success' : 'destructive'}>
                      {coupon.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </td>
                  <td className="p-4">
                    <div className="text-xs text-slate-600">
                      <div>{coupon.validFrom ? format(new Date(coupon.validFrom), 'MMM d, yyyy') : 'No start date'}</div>
                      <div className="text-slate-400">{coupon.validUntil ? format(new Date(coupon.validUntil), 'MMM d, yyyy') : 'No end date'}</div>
                    </div>
                  </td>
                  <td className="p-4 text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" size="sm" onClick={() => handleOpenEditModal(coupon)}>
                        Edit
                      </Button>
                      <Button variant="destructive" size="sm" onClick={() => handleDelete(coupon.id)}>
                        Delete
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {coupons.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-12 text-center text-slate-500">
                    No coupons found.
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
