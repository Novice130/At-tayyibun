'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader, Plus, Edit2, Trash2, Megaphone } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

interface AdRow {
  id: string;
  partnerId: string;
  partnerName: string | null;
  title: string;
  imageUrl: string;
  clickUrl: string;
  isActive: boolean;
  startDate: string | null;
  endDate: string | null;
}

export default function AdminAdsPage() {
  const [ads, setAds] = useState<AdRow[]>([]);
  const [partners, setPartners] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: '',
    partnerId: '',
    imageUrl: '',
    clickUrl: '',
    isActive: true,
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [adsRes, partnersRes] = await Promise.all([
        api.get('/admin/ads?limit=100'),
        api.get('/admin/ads/partners'),
      ]);
      setAds(adsRes.data || []);
      setPartners(partnersRes || []);
    } catch (e: any) {
      setError(e.message || 'Failed to load ads');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const openForm = (ad?: AdRow) => {
    if (ad) {
      setEditingId(ad.id);
      setForm({
        title: ad.title,
        partnerId: ad.partnerId,
        imageUrl: ad.imageUrl,
        clickUrl: ad.clickUrl,
        isActive: ad.isActive,
      });
    } else {
      setEditingId(null);
      setForm({ title: '', partnerId: partners[0]?.id || '', imageUrl: '', clickUrl: '', isActive: true });
    }
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingId) {
        await api.patch(`/admin/ads/${editingId}`, form);
      } else {
        await api.post('/admin/ads', form);
      }
      setShowModal(false);
      loadData();
    } catch (e: any) {
      alert(e.message || 'Failed to save ad');
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this ad?')) return;
    try {
      await api.delete(`/admin/ads/${id}`);
      loadData();
    } catch (e: any) {
      alert('Failed to delete ad');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Partner Advertisements</h1>
          <p className="text-slate-500 mt-1 text-sm">Manage banner ads and promotional campaigns from partners.</p>
        </div>
        <Button onClick={() => openForm()} className="flex items-center gap-2">
          <Plus className="w-4 h-4" /> Add Ad Campaign
        </Button>
      </div>

      {error ? (
        <div className="p-4 bg-rose-50 text-rose-600 rounded-xl border border-rose-100 italic">{error}</div>
      ) : (
        <div className="bg-white rounded-xl border shadow-sm overflow-hidden text-sm">
          {loading ? (
            <div className="p-20 flex flex-col items-center justify-center text-slate-500">
              <Loader className="w-8 h-8 animate-spin mb-4 text-primary" />
              <p className="font-medium">Loading advertisements...</p>
            </div>
          ) : ads.length === 0 ? (
            <div className="flex flex-col items-center p-20 text-center">
              <div className="w-20 h-20 bg-slate-50 text-slate-200 rounded-full flex items-center justify-center mb-6">
                <Megaphone className="w-10 h-10" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">No Ads Active</h3>
              <p className="text-slate-500 max-w-sm mx-auto">Create your first ad campaign to start showing promotions to users.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50 border-b">
                  <tr>
                    <th className="px-6 py-4 font-medium text-slate-700">Campaign Details</th>
                    <th className="px-6 py-4 font-medium text-slate-700">Status</th>
                    <th className="px-6 py-4 text-right font-medium text-slate-700">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {ads.map(ad => (
                    <tr key={ad.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-semibold text-slate-900">{ad.title}</div>
                        <div className="text-xs text-slate-500 mt-0.5">{ad.partnerName || 'Unknown Partner'}</div>
                      </td>
                      <td className="px-6 py-4">
                        <Badge variant={ad.isActive ? 'success' : 'secondary'}>
                          {ad.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button variant="ghost" size="icon" onClick={() => openForm(ad)} className="text-slate-400 hover:text-primary">
                            <Edit2 className="w-4 h-4"/>
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDelete(ad.id)} className="text-slate-400 hover:text-rose-600">
                            <Trash2 className="w-4 h-4"/>
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

      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-8 w-full max-w-md shadow-2xl border animate-in fade-in zoom-in duration-200">
            <h2 className="text-2xl font-bold mb-6 text-slate-900">{editingId ? 'Update Ad' : 'New Ad Campaign'}</h2>
            <form onSubmit={handleSave} className="space-y-5">
              <div>
                <label className="text-sm font-semibold mb-1.5 block text-slate-700">Campaign Title</label>
                <Input required type="text" value={form.title} onChange={e => setForm({...form, title: e.target.value})} placeholder="e.g. Ramadan Special 2024" />
              </div>
              <div>
                <label className="text-sm font-semibold mb-1.5 block text-slate-700">Associated Partner</label>
                <select required value={form.partnerId} onChange={e => setForm({...form, partnerId: e.target.value})} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
                  <option value="">Select a partner</option>
                  {partners.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-semibold mb-1.5 block text-slate-700">Banner Image URL</label>
                  <Input required type="text" value={form.imageUrl} onChange={e => setForm({...form, imageUrl: e.target.value})} placeholder="https://..." />
                </div>
                <div>
                  <label className="text-sm font-semibold mb-1.5 block text-slate-700">Destination URL</label>
                  <Input required type="text" value={form.clickUrl} onChange={e => setForm({...form, clickUrl: e.target.value})} placeholder="https://..." />
                </div>
              </div>
              <div className="flex items-center gap-3 py-2">
                <input type="checkbox" id="active" checked={form.isActive} onChange={e => setForm({...form, isActive: e.target.checked})} className="w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary"/>
                <label htmlFor="active" className="text-sm font-semibold text-slate-700 cursor-pointer">Active and Visible</label>
              </div>
              <div className="flex justify-end gap-3 pt-6 border-t mt-4">
                <Button type="button" variant="ghost" onClick={() => setShowModal(false)}>Cancel</Button>
                <Button type="submit">save Changes</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
