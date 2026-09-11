'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Search,
  Loader,
  ChevronLeft,
  ChevronRight,
  X,
  AlertCircle,
  CheckCircle2,
  Check,
  UserCheck,
  Filter,
  BellRing,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useSession } from '@/lib/auth-client';
import { toast } from 'sonner';
import { InspectorContent, RoleBadge, TierBadge } from './InspectorContent';

interface UserRow {
  id: string;
  publicId: string;
  email: string;
  phone: string | null;
  role: 'USER' | 'ADMIN' | 'SUPER_ADMIN';
  membershipTier: 'FREE' | 'SILVER' | 'GOLD';
  isVerified: boolean;
  isPhoneVerified: boolean;
  emailVerified: boolean;
  createdAt: string;
  rankBoost: number | null;
  profile: { firstName: string | null; gender: string | null; ethnicity: string | null } | null;
}

interface UserListResponse {
  data: UserRow[];
  meta: { total: number; page: number; limit: number; pages: number };
}

const LIMIT = 20;

type FilterType = 'all' | 'verified' | 'admins' | 'incomplete' | 'free' | 'silver' | 'gold';

// Email signup with no verified phone and no profile — the account never
// finished onboarding. Phone-first placeholder emails are excluded server-side.
const isIncomplete = (u: UserRow) =>
  !u.profile && !u.isPhoneVerified && !u.email.includes('@phone.attayyibun.invalid');

export default function AdminUsersPage() {
  const { data: session } = useSession();
  const myRole = (session?.user as any)?.role as string | undefined;
  const isSuper = myRole === 'SUPER_ADMIN';

  const [list, setList] = useState<UserListResponse | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const [action, setAction] = useState<{ type: 'info' | 'error'; msg: string } | null>(null);
  const [updatingBoost, setUpdatingBoost] = useState(false);
  const [nudging, setNudging] = useState<'one' | 'all' | null>(null);

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
    setUpdatingBoost(true);
    setAction(null);
    try {
      await api.put(`/admin/users/${userId}/boost`, { boost });
      const msg = `Rank boost updated to ${boost}`;
      setAction({ type: 'info', msg });
      toast.success(msg);
      setDetail((d: any) => (d ? { ...d, rankBoost: boost } : d));
      setList((prev) =>
        prev
          ? {
              ...prev,
              data: prev.data.map((u) => (u.id === userId ? { ...u, rankBoost: boost } : u)),
            }
          : prev
      );
    } catch (e: any) {
      const msg = e.message || 'Boost update failed';
      setAction({ type: 'error', msg });
      toast.error(msg);
    } finally {
      setUpdatingBoost(false);
    }
  };

  const setTier = async (userId: string, membershipTier: 'FREE' | 'SILVER' | 'GOLD') => {
    setAction(null);
    try {
      await api.put(`/admin/users/${userId}`, { membershipTier });
      const msg = `Membership tier changed to ${membershipTier}`;
      setAction({ type: 'info', msg });
      toast.success(msg);
      setDetail((d: any) => (d ? { ...d, membershipTier } : d));
      setList((prev) =>
        prev
          ? {
              ...prev,
              data: prev.data.map((u) => (u.id === userId ? { ...u, membershipTier } : u)),
            }
          : prev
      );
    } catch (e: any) {
      const msg = e.message || 'Failed to update tier';
      setAction({ type: 'error', msg });
      toast.error(msg);
    }
  };

  const toggleVerified = async (userId: string, currentStatus: boolean) => {
    setAction(null);
    const nextStatus = !currentStatus;
    try {
      await api.put(`/admin/users/${userId}`, { isVerified: nextStatus });
      const msg = nextStatus ? 'User marked as Verified' : 'User verification removed';
      setAction({ type: 'info', msg });
      toast.success(msg);
      setDetail((d: any) => (d ? { ...d, isVerified: nextStatus } : d));
      setList((prev) =>
        prev
          ? {
              ...prev,
              data: prev.data.map((u) => (u.id === userId ? { ...u, isVerified: nextStatus } : u)),
            }
          : prev
      );
    } catch (e: any) {
      const msg = e.message || 'Failed to update verification status';
      setAction({ type: 'error', msg });
      toast.error(msg);
    }
  };

  const promote = async (userId: string) => {
    setAction(null);
    try {
      await api.post('/admin/admins', { userId });
      const msg = 'User promoted to ADMIN';
      setAction({ type: 'info', msg });
      toast.success(msg);
      setDetail((d: any) => (d ? { ...d, role: 'ADMIN' } : d));
      setList((prev) =>
        prev
          ? {
              ...prev,
              data: prev.data.map((u) => (u.id === userId ? { ...u, role: 'ADMIN' } : u)),
            }
          : prev
      );
    } catch (e: any) {
      const msg = e.message || 'Promotion failed';
      setAction({ type: 'error', msg });
      toast.error(msg);
    }
  };

  const demote = async (userId: string) => {
    setAction(null);
    try {
      await api.delete(`/admin/admins/${userId}`);
      const msg = 'ADMIN demoted to USER';
      setAction({ type: 'info', msg });
      toast.success(msg);
      setDetail((d: any) => (d ? { ...d, role: 'USER' } : d));
      setList((prev) =>
        prev
          ? {
              ...prev,
              data: prev.data.map((u) => (u.id === userId ? { ...u, role: 'USER' } : u)),
            }
          : prev
      );
    } catch (e: any) {
      const msg = e.message || 'Demotion failed';
      setAction({ type: 'error', msg });
      toast.error(msg);
    }
  };

  const deleteUser = async (userId: string, label: string) => {
    if (
      !confirm(
        `Permanently delete ${label}? This removes their photos, profile, sessions, and pending requests. Cannot be undone.`
      )
    )
      return;
    setAction(null);
    try {
      await api.delete(`/admin/users/${userId}`);
      const msg = `Deleted ${label}`;
      setAction({ type: 'info', msg });
      toast.success(msg);
      setSelectedId(null);
      setDetail(null);
      load(page, search);
    } catch (e: any) {
      const msg = e.message || 'Delete failed';
      setAction({ type: 'error', msg });
      toast.error(msg);
    }
  };

  const nudgeOne = async (userId: string, label: string) => {
    setNudging('one');
    setAction(null);
    try {
      await api.post(`/admin/users/${userId}/nudge`);
      const msg = `Verification reminder sent to ${label}`;
      setAction({ type: 'info', msg });
      toast.success(msg);
      setDetail((d: any) => (d ? { ...d, nudgedAt: new Date().toISOString() } : d));
    } catch (e: any) {
      const msg = e.message || 'Nudge failed';
      setAction({ type: 'error', msg });
      toast.error(msg);
    } finally {
      setNudging(null);
    }
  };

  const nudgeAll = async () => {
    const count = list?.data.filter(isIncomplete).length ?? 0;
    if (
      !confirm(
        `Send a verification reminder to every incomplete signup? This emails all accounts with no verified phone and no profile (across all pages, not just the ${count} on this one).`
      )
    )
      return;
    setNudging('all');
    setAction(null);
    try {
      const res: { total: number; sent: number; failed: { email: string; error: string }[] } = await api.post(
        '/admin/users/nudge-unverified'
      );
      const msg =
        res.failed.length > 0
          ? `Sent ${res.sent}/${res.total} reminders. Failed: ${res.failed.map((f) => f.email).join(', ')}`
          : `Sent ${res.sent} verification reminder${res.sent === 1 ? '' : 's'}`;
      setAction({ type: res.failed.length > 0 ? 'error' : 'info', msg });
      if (res.failed.length > 0) toast.error(`${res.failed.length} send(s) failed`);
      else toast.success(msg);
    } catch (e: any) {
      const msg = e.message || 'Bulk nudge failed';
      setAction({ type: 'error', msg });
      toast.error(msg);
    } finally {
      setNudging(null);
    }
  };

  const copyToClipboard = (text: string, label = 'Copied') => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard`);
  };

  // Filter list locally for quick filter pills
  const filteredUsers = list?.data.filter((u) => {
    if (activeFilter === 'verified') return u.isVerified;
    if (activeFilter === 'admins') return u.role === 'ADMIN' || u.role === 'SUPER_ADMIN';
    if (activeFilter === 'incomplete') return isIncomplete(u);
    if (activeFilter === 'free') return u.membershipTier === 'FREE';
    if (activeFilter === 'silver') return u.membershipTier === 'SILVER';
    if (activeFilter === 'gold') return u.membershipTier === 'GOLD';
    return true;
  });

  return (
    <div className="p-3 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl sm:text-3xl font-bold mb-1" style={{ color: 'var(--color-text)' }}>
            User Management
          </h1>
          <p className="text-xs sm:text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            Search, inspect, adjust rank boost, manage tiers, and update roles.
          </p>
        </div>
        <button
          onClick={nudgeAll}
          disabled={nudging !== null}
          className="btn-primary px-4 py-2 text-xs sm:text-sm font-semibold flex items-center gap-2 disabled:opacity-60 flex-shrink-0"
        >
          {nudging === 'all' ? <Loader className="w-4 h-4 animate-spin" /> : <BellRing className="w-4 h-4" />}
          Remind All Incomplete
        </button>
      </header>

      {/* Search & Filter Controls */}
      <div className="space-y-3">
        <form onSubmit={onSearchSubmit} className="relative max-w-lg">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search email, publicId, or name..."
            className="input pl-10 pr-20 w-full text-sm h-11"
          />
          {search && (
            <button
              type="button"
              onClick={() => {
                setSearch('');
                setPage(1);
                load(1, '');
              }}
              className="absolute right-14 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <button
            type="submit"
            className="absolute right-2 top-1/2 -translate-y-1/2 btn-primary px-3 py-1 text-xs font-semibold"
          >
            Search
          </button>
        </form>

        {/* Quick Filter Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs">
          <span className="text-muted flex items-center gap-1 pr-1 font-medium">
            <Filter className="w-3 h-3" /> Filter:
          </span>
          {(
            [
              { id: 'all', label: 'All Users' },
              { id: 'verified', label: 'Verified' },
              { id: 'incomplete', label: 'Incomplete' },
              { id: 'admins', label: 'Admins' },
              { id: 'gold', label: 'Gold' },
              { id: 'silver', label: 'Silver' },
              { id: 'free', label: 'Free' },
            ] as const
          ).map(({ id, label }) => {
            const active = activeFilter === id;
            return (
              <button
                key={id}
                onClick={() => setActiveFilter(id)}
                className={`px-3 py-1.5 rounded-full whitespace-nowrap transition font-medium border ${
                  active
                    ? 'bg-gold-500 text-black border-gold-500 font-semibold shadow-sm'
                    : 'border-theme text-secondary hover:bg-gold-500/10'
                }`}
                style={!active ? { backgroundColor: 'var(--color-surface)' } : undefined}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {action && (
        <div
          className={`flex items-center gap-2 p-3 rounded-lg text-sm ${
            action.type === 'info'
              ? 'bg-green-500/10 border border-green-500/20 text-green-400'
              : 'bg-red-500/10 border border-red-500/20 text-red-400'
          }`}
        >
          {action.type === 'info' ? <CheckCircle2 className="w-4 h-4 flex-shrink-0" /> : <AlertCircle className="w-4 h-4 flex-shrink-0" />}
          <span className="text-xs sm:text-sm font-medium">{action.msg}</span>
        </div>
      )}

      {/* Main Grid: User List & Desktop Sticky Inspector */}
      <div className="grid lg:grid-cols-[1fr_420px] gap-6">
        <div className="card overflow-hidden">
          {loading ? (
            <div className="p-12 flex flex-col items-center justify-center gap-3" style={{ color: 'var(--color-text-secondary)' }}>
              <Loader className="w-8 h-8 animate-spin text-gold-500" />
              <span className="text-sm font-medium">Loading users roster…</span>
            </div>
          ) : error ? (
            <div className="p-6 text-red-400 text-sm">{error}</div>
          ) : !filteredUsers || filteredUsers.length === 0 ? (
            <div className="p-12 text-center" style={{ color: 'var(--color-text-secondary)' }}>
              <p className="text-base font-semibold mb-1" style={{ color: 'var(--color-text)' }}>No users found</p>
              <p className="text-xs">Try adjusting your search query or filter</p>
            </div>
          ) : (
            <>
              {/* Mobile Card List View (<lg) */}
              <div className="lg:hidden divide-y" style={{ borderColor: 'var(--color-border)' }}>
                {filteredUsers.map((u) => {
                  const isSelected = selectedId === u.id;
                  const name = u.profile?.firstName || 'User';
                  const initial = name[0]?.toUpperCase() || 'U';

                  return (
                    <div
                      key={u.id}
                      onClick={() => setSelectedId(u.id)}
                      className={`p-4 transition cursor-pointer flex flex-col gap-2.5 ${
                        isSelected ? 'bg-gold-500/15' : 'hover:bg-gold-500/5 active:bg-gold-500/10'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm bg-gradient-gold text-black shadow-sm flex-shrink-0"
                          >
                            {initial}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-semibold text-sm leading-tight" style={{ color: 'var(--color-text)' }}>
                                {u.profile?.firstName || 'Unnamed Profile'}
                              </span>
                              {u.isVerified && (
                                <span className="inline-flex items-center gap-0.5 text-[10px] bg-blue-500/15 text-blue-400 font-semibold px-1.5 py-0.2 rounded">
                                  <UserCheck className="w-3 h-3" /> Verified
                                </span>
                              )}
                              {isIncomplete(u) && (
                                <span className="text-[10px] bg-amber-500/15 text-amber-400 font-semibold px-1.5 py-0.2 rounded">
                                  Phone pending
                                </span>
                              )}
                            </div>
                            <div className="text-xs truncate" style={{ color: 'var(--color-text-secondary)' }}>
                              {u.email}
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-col items-end gap-1 flex-shrink-0">
                          <RoleBadge role={u.role} />
                          <TierBadge tier={u.membershipTier} />
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-1 text-xs border-t border-dashed" style={{ borderColor: 'var(--color-border)' }}>
                        <div className="flex items-center gap-2" style={{ color: 'var(--color-text-secondary)' }}>
                          <span className="font-mono text-[11px]">{u.publicId}</span>
                          <span>•</span>
                          <span>{new Date(u.createdAt).toLocaleDateString()}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[11px] font-semibold text-gold-500">
                            Boost: +{u.rankBoost ?? 0}
                          </span>
                          <span className="btn-primary text-[11px] py-0.5 px-2 font-medium">
                            Manage
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Desktop Table View (lg+) */}
              <div className="hidden lg:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left border-b" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface-hover)' }}>
                      <th className="px-4 py-3 font-medium" style={{ color: 'var(--color-text-secondary)' }}>Name / Email</th>
                      <th className="px-4 py-3 font-medium" style={{ color: 'var(--color-text-secondary)' }}>Role</th>
                      <th className="px-4 py-3 font-medium" style={{ color: 'var(--color-text-secondary)' }}>Tier</th>
                      <th className="px-4 py-3 font-medium" style={{ color: 'var(--color-text-secondary)' }}>Verified</th>
                      <th className="px-4 py-3 font-medium" style={{ color: 'var(--color-text-secondary)' }}>Boost</th>
                      <th className="px-4 py-3 font-medium" style={{ color: 'var(--color-text-secondary)' }}>Joined</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map((u) => (
                      <tr
                        key={u.id}
                        onClick={() => setSelectedId(u.id)}
                        className={`border-t cursor-pointer transition ${
                          selectedId === u.id ? 'bg-gold-500/10' : 'hover:bg-gold-500/5'
                        }`}
                        style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
                      >
                        <td className="px-4 py-3">
                          <div className="font-semibold">{u.profile?.firstName || '—'}</div>
                          <div className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                            {u.email}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <RoleBadge role={u.role} />
                        </td>
                        <td className="px-4 py-3">
                          <TierBadge tier={u.membershipTier} />
                        </td>
                        <td className="px-4 py-3">
                          {u.isVerified ? (
                            <span className="inline-flex items-center gap-1 text-xs text-green-400 font-medium">
                              <Check className="w-3.5 h-3.5" /> Yes
                            </span>
                          ) : (
                            <span className="text-xs text-muted">No</span>
                          )}
                        </td>
                        <td className="px-4 py-3 font-semibold text-gold-500">+{u.rankBoost ?? 0}</td>
                        <td className="px-4 py-3 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                          {new Date(u.createdAt).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination bar */}
              <div
                className="flex items-center justify-between p-3 sm:p-4 border-t"
                style={{ borderColor: 'var(--color-border)' }}
              >
                <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                  Page {list?.meta.page} of {list?.meta.pages} ({list?.meta.total} total)
                </span>
                <div className="flex gap-1.5">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={!list || list.meta.page <= 1}
                    className="p-1.5 sm:px-3 sm:py-1.5 rounded border disabled:opacity-40 flex items-center gap-1 text-xs hover:bg-gold-500/10 transition"
                    style={{ borderColor: 'var(--color-border)' }}
                  >
                    <ChevronLeft className="w-4 h-4" />
                    <span className="hidden sm:inline">Prev</span>
                  </button>
                  <button
                    onClick={() => setPage((p) => p + 1)}
                    disabled={!list || list.meta.page >= list.meta.pages}
                    className="p-1.5 sm:px-3 sm:py-1.5 rounded border disabled:opacity-40 flex items-center gap-1 text-xs hover:bg-gold-500/10 transition"
                    style={{ borderColor: 'var(--color-border)' }}
                  >
                    <span className="hidden sm:inline">Next</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Desktop Sticky Side Inspector (Hidden on Mobile) */}
        <aside className="hidden lg:block card p-5 h-fit sticky top-6">
          <InspectorContent
            selectedId={selectedId}
            detail={detail}
            detailLoading={detailLoading}
            detailError={detailError}
            isSuper={isSuper}
            updatingBoost={updatingBoost}
            onClose={() => setSelectedId(null)}
            onSetBoost={setBoost}
            onSetTier={setTier}
            onToggleVerified={toggleVerified}
            onPromote={promote}
            onDemote={demote}
            onDelete={deleteUser}
            onCopy={copyToClipboard}
            onNudge={nudgeOne}
            nudging={nudging === 'one'}
          />
        </aside>
      </div>

      {/* Mobile Slide-Up Bottom Sheet Modal (<lg) */}
      {selectedId && (
        <div className="lg:hidden fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div
            className="w-full max-h-[85vh] overflow-y-auto rounded-t-3xl border-t shadow-2xl p-5 pb-8 space-y-4 animate-in slide-in-from-bottom duration-300"
            style={{
              backgroundColor: 'var(--color-surface)',
              borderColor: 'var(--color-border)',
            }}
          >
            {/* Drawer handle */}
            <div className="w-12 h-1.5 bg-gray-400/40 rounded-full mx-auto mb-1" />

            <InspectorContent
              selectedId={selectedId}
              detail={detail}
              detailLoading={detailLoading}
              detailError={detailError}
              isSuper={isSuper}
              updatingBoost={updatingBoost}
              onClose={() => setSelectedId(null)}
              onSetBoost={setBoost}
              onSetTier={setTier}
              onToggleVerified={toggleVerified}
              onPromote={promote}
              onDemote={demote}
              onDelete={deleteUser}
              onCopy={copyToClipboard}
              onNudge={nudgeOne}
              nudging={nudging === 'one'}
            />
          </div>
        </div>
      )}
    </div>
  );
}

