'use client';

import { useCallback, useEffect, useState } from 'react';
import { Search, Loader, ChevronLeft, ChevronRight, Shield, ShieldOff, X, AlertCircle, CheckCircle2 } from 'lucide-react';
import { api } from '@/lib/api';
import { useSession } from '@/lib/auth-client';

interface UserRow {
  id: string;
  publicId: string;
  email: string;
  phone: string | null;
  role: 'USER' | 'ADMIN' | 'SUPER_ADMIN';
  membershipTier: 'FREE' | 'SILVER' | 'GOLD';
  isVerified: boolean;
  createdAt: string;
  rankBoost: number | null;
  profile: { firstName: string | null; gender: string | null; ethnicity: string | null } | null;
}

interface UserListResponse {
  data: UserRow[];
  meta: { total: number; page: number; limit: number; pages: number };
}

const LIMIT = 20;

export default function AdminUsersPage() {
  const { data: session } = useSession();
  const myRole = (session?.user as any)?.role as string | undefined;
  const isSuper = myRole === 'SUPER_ADMIN';

  const [list, setList] = useState<UserListResponse | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const [action, setAction] = useState<{ type: 'info' | 'error'; msg: string } | null>(null);

  const load = useCallback(
    async (p = page, q = search) => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ page: String(p), limit: String(LIMIT) });
        if (q) params.set('search', q);
        const data: UserListResponse = await api.get(`/admin/users?${params}`);
        setList(data);
      } catch (e: any) {
        setError(e.message || 'Failed to load users');
      } finally {
        setLoading(false);
      }
    },
    [page, search]
  );

  useEffect(() => {
    load(page, search);
  }, [page]);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }
    setDetailLoading(true);
    setDetailError(null);
    api
      .get(`/admin/users/${selectedId}`)
      .then(setDetail)
      .catch((e) => setDetailError(e.message || 'Failed to load user'))
      .finally(() => setDetailLoading(false));
  }, [selectedId]);

  const onSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    load(1, search);
  };

  const setBoost = async (userId: string, boost: number) => {
    setAction(null);
    try {
      await api.put(`/admin/users/${userId}/boost`, { boost });
      setAction({ type: 'info', msg: `Rank boost updated to ${boost}` });
      setDetail((d: any) => (d ? { ...d, rankBoost: boost } : d));
      load(page, search);
    } catch (e: any) {
      setAction({ type: 'error', msg: e.message || 'Boost update failed' });
    }
  };

  const promote = async (userId: string) => {
    setAction(null);
    try {
      await api.post('/admin/admins', { userId });
      setAction({ type: 'info', msg: 'User promoted to ADMIN' });
      setDetail((d: any) => (d ? { ...d, role: 'ADMIN' } : d));
      load(page, search);
    } catch (e: any) {
      setAction({ type: 'error', msg: e.message || 'Promotion failed' });
    }
  };

  const demote = async (userId: string) => {
    setAction(null);
    try {
      await api.delete(`/admin/admins/${userId}`);
      setAction({ type: 'info', msg: 'ADMIN demoted to USER' });
      setDetail((d: any) => (d ? { ...d, role: 'USER' } : d));
      load(page, search);
    } catch (e: any) {
      setAction({ type: 'error', msg: e.message || 'Demotion failed' });
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <header className="mb-6">
        <h1 className="font-heading text-3xl font-bold mb-1" style={{ color: 'var(--color-text)' }}>
          Users
        </h1>
        <p style={{ color: 'var(--color-text-secondary)' }}>
          Search, inspect, adjust rank boost, and manage admin roles.
        </p>
      </header>

      <form onSubmit={onSearchSubmit} className="mb-5 relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="email, publicId, or first name"
          className="input pl-10"
        />
      </form>

      {action && (
        <div
          className={`flex items-center gap-2 p-3 rounded-lg mb-4 text-sm ${
            action.type === 'info'
              ? 'bg-green-500/10 border border-green-500/20 text-green-400'
              : 'bg-red-500/10 border border-red-500/20 text-red-400'
          }`}
        >
          {action.type === 'info' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          {action.msg}
        </div>
      )}

      <div className="grid lg:grid-cols-[1fr_400px] gap-6">
        <div className="card overflow-hidden">
          {loading ? (
            <div className="p-6 flex items-center gap-2" style={{ color: 'var(--color-text-secondary)' }}>
              <Loader className="w-4 h-4 animate-spin" /> Loading…
            </div>
          ) : error ? (
            <div className="p-6 text-red-400">{error}</div>
          ) : !list || list.data.length === 0 ? (
            <div className="p-6" style={{ color: 'var(--color-text-secondary)' }}>
              No users found.
            </div>
          ) : (
            <>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left" style={{ color: 'var(--color-text-secondary)' }}>
                    <th className="px-4 py-3 font-medium">Name / Email</th>
                    <th className="px-4 py-3 font-medium">Role</th>
                    <th className="px-4 py-3 font-medium">Tier</th>
                    <th className="px-4 py-3 font-medium">Boost</th>
                    <th className="px-4 py-3 font-medium">Joined</th>
                  </tr>
                </thead>
                <tbody>
                  {list.data.map((u) => (
                    <tr
                      key={u.id}
                      onClick={() => setSelectedId(u.id)}
                      className={`border-t cursor-pointer transition ${
                        selectedId === u.id ? 'bg-gold-500/10' : 'hover:bg-gold-500/5'
                      }`}
                      style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
                    >
                      <td className="px-4 py-3">
                        <div className="font-medium">{u.profile?.firstName || '—'}</div>
                        <div className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                          {u.email}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <RoleBadge role={u.role} />
                      </td>
                      <td className="px-4 py-3">{u.membershipTier}</td>
                      <td className="px-4 py-3">{u.rankBoost ?? 0}</td>
                      <td className="px-4 py-3 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                        {new Date(u.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div
                className="flex items-center justify-between p-3 border-t"
                style={{ borderColor: 'var(--color-border)' }}
              >
                <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                  Page {list.meta.page} of {list.meta.pages} — {list.meta.total} users
                </span>
                <div className="flex gap-1">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={list.meta.page <= 1}
                    className="p-1.5 rounded border disabled:opacity-40"
                    style={{ borderColor: 'var(--color-border)' }}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setPage((p) => p + 1)}
                    disabled={list.meta.page >= list.meta.pages}
                    className="p-1.5 rounded border disabled:opacity-40"
                    style={{ borderColor: 'var(--color-border)' }}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        <aside className="card p-5 h-fit sticky top-6">
          {!selectedId ? (
            <div className="text-sm text-center py-8" style={{ color: 'var(--color-text-secondary)' }}>
              Select a user to view details.
            </div>
          ) : detailLoading ? (
            <div className="flex items-center gap-2" style={{ color: 'var(--color-text-secondary)' }}>
              <Loader className="w-4 h-4 animate-spin" /> Loading…
            </div>
          ) : detailError ? (
            <div className="text-red-400 text-sm">{detailError}</div>
          ) : detail ? (
            <div>
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="font-heading text-lg font-bold" style={{ color: 'var(--color-text)' }}>
                    {detail.profile?.firstName || detail.name || '—'}
                  </div>
                  <div className="text-xs font-mono" style={{ color: 'var(--color-text-secondary)' }}>
                    {detail.publicId}
                  </div>
                </div>
                <button onClick={() => setSelectedId(null)} aria-label="Close">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <dl className="space-y-2 text-sm mb-5">
                <Row label="Email" value={detail.email} />
                <Row label="Phone" value={detail.phone || '—'} />
                <Row label="Role" value={<RoleBadge role={detail.role} />} />
                <Row label="Tier" value={detail.membershipTier} />
                <Row label="Verified" value={detail.isVerified ? 'Yes' : 'No'} />
                <Row label="Photos" value={(detail.photos?.length ?? 0).toString()} />
                <Row
                  label="Joined"
                  value={detail.createdAt ? new Date(detail.createdAt).toLocaleDateString() : '—'}
                />
              </dl>

              <section className="mb-5">
                <label className="block text-xs font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>
                  Rank boost ({detail.rankBoost ?? 0})
                </label>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  defaultValue={detail.rankBoost ?? 0}
                  onChange={(e) => (e.currentTarget.dataset.val = e.currentTarget.value)}
                  onMouseUp={(e) => setBoost(detail.id, Number(e.currentTarget.value))}
                  onTouchEnd={(e) => setBoost(detail.id, Number((e.currentTarget as HTMLInputElement).value))}
                  className="w-full accent-gold-500"
                />
                <div className="flex justify-between text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
                  <span>0</span>
                  <span>50</span>
                  <span>100</span>
                </div>
              </section>

              <section>
                <h3 className="text-xs font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>
                  Role management
                </h3>
                {!isSuper ? (
                  <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                    SUPER_ADMIN only.
                  </div>
                ) : detail.role === 'USER' ? (
                  <button
                    onClick={() => promote(detail.id)}
                    className="btn-primary w-full py-2 text-sm flex items-center justify-center gap-2"
                  >
                    <Shield className="w-4 h-4" /> Promote to ADMIN
                  </button>
                ) : detail.role === 'ADMIN' ? (
                  <button
                    onClick={() => demote(detail.id)}
                    className="w-full py-2 text-sm rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10 transition flex items-center justify-center gap-2"
                  >
                    <ShieldOff className="w-4 h-4" /> Demote to USER
                  </button>
                ) : (
                  <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                    SUPER_ADMIN cannot be demoted via this panel.
                  </div>
                )}
              </section>
            </div>
          ) : null}
        </aside>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
        {label}
      </dt>
      <dd style={{ color: 'var(--color-text)' }}>{value}</dd>
    </div>
  );
}

function RoleBadge({ role }: { role: string }) {
  const cls =
    role === 'SUPER_ADMIN'
      ? 'bg-purple-500/15 text-purple-400'
      : role === 'ADMIN'
        ? 'bg-gold-500/15 text-gold-400'
        : 'bg-gray-500/15 text-gray-400';
  return <span className={`px-2 py-0.5 rounded text-xs font-medium ${cls}`}>{role}</span>;
}
