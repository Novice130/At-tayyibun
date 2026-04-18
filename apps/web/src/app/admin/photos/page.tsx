'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader, CheckCircle2, XCircle, AlertCircle, Image as ImageIcon } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface PhotoRow {
  id: string;
  type: 'AI_AVATAR' | 'REAL_PHOTO';
  dataUri: string | null;
  gcsDisplayPath: string | null;
  createdAt: string;
  adminApproved: boolean;
}

export default function AdminPhotosPage() {
  const [photos, setPhotos] = useState<PhotoRow[]>([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState<{ type: 'info' | 'error'; msg: string } | null>(null);

  const load = useCallback(async (p = page) => {
    setLoading(true);
    setError(null);
    try {
      const data: PhotoRow[] = await api.get(`/admin/photos/pending?page=${p}&limit=20`);
      setPhotos(data || []);
    } catch (e: any) {
      setError(e.message || 'Failed to load pending photos');
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    load();
  }, [load]);

  const handleAction = async (id: string, isApprove: boolean) => {
    try {
      setActionMsg(null);
      await api.post(`/admin/photos/${id}/${isApprove ? 'approve' : 'reject'}`, {});
      setActionMsg({ type: 'info', msg: `Photo successfully ${isApprove ? 'approved' : 'rejected'}` });
      setPhotos((prev) => prev.filter((p) => p.id !== id));
    } catch (e: any) {
      setActionMsg({ type: 'error', msg: e.message || `Failed to ${isApprove ? 'approve' : 'reject'} photo` });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Photo Moderation</h1>
          <p className="text-slate-500 mt-1 text-sm">Review uploaded photos and AI-generated avatars for approval.</p>
        </div>
      </div>

      {actionMsg && (
        <div className={`p-4 rounded-xl flex items-center gap-3 animate-in slide-in-from-top-2 duration-300 ${actionMsg.type === 'error' ? 'bg-red-50 text-red-700 border border-red-100' : 'bg-emerald-50 text-emerald-700 border border-emerald-100'}`}>
          {actionMsg.type === 'error' ? <AlertCircle className="w-5 h-5 flex-shrink-0" /> : <CheckCircle2 className="w-5 h-5 flex-shrink-0" />}
          <p className="font-semibold">{actionMsg.msg}</p>
        </div>
      )}

      {error ? (
        <div className="p-4 bg-rose-50 text-rose-600 rounded-xl flex items-center gap-3 border border-rose-100">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <p className="font-medium">{error}</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
          {loading ? (
            <div className="flex flex-col items-center justify-center p-20 text-slate-500">
              <Loader className="w-8 h-8 animate-spin mb-4 text-primary" />
              <p className="font-medium">Fetching pending photos...</p>
            </div>
          ) : photos.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-20 text-center">
              <div className="w-20 h-20 bg-slate-50 text-slate-300 rounded-full flex items-center justify-center mb-6">
                <ImageIcon className="w-10 h-10" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">Queue is Empty</h3>
              <p className="text-slate-500 max-w-sm mx-auto">
                Excellent work! All pending photos have been processed.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 border-b">
                  <tr>
                    <th className="px-6 py-4 font-medium text-slate-700">Image Preview</th>
                    <th className="px-6 py-4 font-medium text-slate-700">Category</th>
                    <th className="px-6 py-4 font-medium text-slate-700">Uploaded Time</th>
                    <th className="px-6 py-4 font-medium text-right text-slate-700">Decision</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {photos.map((photo) => (
                    <tr key={photo.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="w-20 h-20 bg-slate-100 rounded-xl shadow-inner border border-slate-200 overflow-hidden group relative">
                          {photo.dataUri ? (
                            <img src={photo.dataUri} alt="Avatar" className="w-full h-full object-cover transition-transform group-hover:scale-110" />
                          ) : photo.gcsDisplayPath ? (
                            <img src={photo.gcsDisplayPath} alt="Photo" className="w-full h-full object-cover transition-transform group-hover:scale-110" />
                          ) : (
                            <ImageIcon className="w-8 h-8 text-slate-300 mx-auto my-6" />
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <Badge variant={photo.type === 'AI_AVATAR' ? 'default' : 'secondary'}>
                          {photo.type === 'AI_AVATAR' ? 'AI Avatar' : 'Member Photo'}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 text-slate-500">
                        {new Date(photo.createdAt).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-3">
                          <Button
                            variant="destructive"
                            size="icon"
                            onClick={() => handleAction(photo.id, false)}
                            title="Reject and Delete"
                            className="rounded-full w-10 h-10"
                          >
                            <XCircle className="w-5 h-5" />
                          </Button>
                          <Button
                            variant="default"
                            size="icon"
                            onClick={() => handleAction(photo.id, true)}
                            title="Approve and Publish"
                            className="bg-emerald-600 hover:bg-emerald-700 rounded-full w-10 h-10"
                          >
                            <CheckCircle2 className="w-5 h-5" />
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
    </div>
  );
}
