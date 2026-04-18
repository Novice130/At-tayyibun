'use client';

import { useEffect, useState } from 'react';
import { Crown, Loader, AlertCircle, CheckCircle2, Shield, ShieldOff } from 'lucide-react';
import { api } from '@/lib/api';
import { useSession } from '@/lib/auth-client';

interface AdminUser {
  id: string;
  publicId: string;
  email: string;
  role: 'USER' | 'ADMIN' | 'SUPER_ADMIN';
  profile: { firstName: string | null } | null;
}

export default function AdminSettingsPage() {
  const { data: session } = useSession();
  const myRole = (session?.user as any)?.role as string | undefined;
  const isSuper = myRole === 'SUPER_ADMIN';

  const [membership, setMembership] = useState<boolean | null>(null);
  const [toggling, setToggling] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: 'info' | 'error'; msg: string } | null>(null);

  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [adminsLoading, setAdminsLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.get('/admin/settings'), api.get('/admin/users?page=1&limit=200')])
      .then(([config, userList]) => {
        setMembership(Boolean(config.membership_enabled));
        setAdmins(
          (userList.data as AdminUser[]).filter((u) => u.role === 'ADMIN' || u.role === 'SUPER_ADMIN')
        );
      })
      .catch((e) => setError(e.message || 'Failed to load settings'))
      .finally(() => {
        setLoading(false);
        setAdminsLoading(false);
      });
  }, []);

  const toggleMembership = async () => {
    if (!isSuper) return;
    const next = !membership;
    setToggling(true);
    setToast(null);
    try {
      await api.put('/admin/settings/membership', { enabled: next });
      setMembership(next);
      setToast({ type: 'info', msg: `Memberships ${next ? 'enabled' : 'disabled'}` });
    } catch (e: any) {
      setToast({ type: 'error', msg: e.message || 'Toggle failed' });
    } finally {
      setToggling(false);
    }
  };

  const demote = async (userId: string) => {
    setToast(null);
    try {
      await api.delete(`/admin/admins/${userId}`);
      setAdmins((a) => a.filter((u) => u.id !== userId));
      setToast({ type: 'info', msg: 'ADMIN demoted' });
    } catch (e: any) {
      setToast({ type: 'error', msg: e.message || 'Demote failed' });
    }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <header className="mb-6">
        <h1 className="font-heading text-3xl font-bold mb-1" style={{ color: 'var(--color-text)' }}>
          Settings
        </h1>
        <p style={{ color: 'var(--color-text-secondary)' }}>System toggles and admin roster.</p>
      </header>

      {toast && (
        <div
          className={`flex items-center gap-2 p-3 rounded-lg mb-4 text-sm ${
            toast.type === 'info'
              ? 'bg-green-500/10 border border-green-500/20 text-green-400'
              : 'bg-red-500/10 border border-red-500/20 text-red-400'
          }`}
        >
          {toast.type === 'info' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          {toast.msg}
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2" style={{ color: 'var(--color-text-secondary)' }}>
          <Loader className="w-4 h-4 animate-spin" /> Loading…
        </div>
      ) : error ? (
        <div className="text-red-400">{error}</div>
      ) : (
        <div className="space-y-6">
          <section className="card p-6">
            <div className="flex items-start justify-between gap-4 mb-2">
              <div>
                <h2 className="font-heading text-lg font-bold mb-1 flex items-center gap-2" style={{ color: 'var(--color-text)' }}>
                  <Crown className="w-5 h-5 text-gold-500" /> Paid memberships
                </h2>
                <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                  When enabled, Silver and Gold tiers are purchasable. Turn off to make all features free while
                  onboarding early users.
                </p>
              </div>
              <button
                onClick={toggleMembership}
                disabled={!isSuper || toggling}
                className={`relative w-12 h-7 rounded-full transition disabled:opacity-50 disabled:cursor-not-allowed ${
                  membership ? 'bg-gold-500' : 'bg-gray-500'
                }`}
                aria-label="Toggle memberships"
              >
                <span
                  className={`absolute top-1 left-1 w-5 h-5 rounded-full bg-white transition-transform ${
                    membership ? 'translate-x-5' : ''
                  }`}
                />
              </button>
            </div>
            {!isSuper && (
              <p className="text-xs mt-2" style={{ color: 'var(--color-text-muted)' }}>
                SUPER_ADMIN only.
              </p>
            )}
          </section>

          <section className="card p-6">
            <h2 className="font-heading text-lg font-bold mb-4 flex items-center gap-2" style={{ color: 'var(--color-text)' }}>
              <Shield className="w-5 h-5 text-gold-500" /> Admin roster
            </h2>
            {adminsLoading ? (
              <div className="flex items-center gap-2" style={{ color: 'var(--color-text-secondary)' }}>
                <Loader className="w-4 h-4 animate-spin" /> Loading…
              </div>
            ) : admins.length === 0 ? (
              <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                No admins yet.
              </p>
            ) : (
              <ul className="divide-y" style={{ borderColor: 'var(--color-border)' }}>
                {admins.map((a) => (
                  <li
                    key={a.id}
                    className="flex items-center justify-between py-3"
                    style={{ borderColor: 'var(--color-border)' }}
                  >
                    <div>
                      <div className="font-medium" style={{ color: 'var(--color-text)' }}>
                        {a.profile?.firstName || '—'}
                      </div>
                      <div className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                        {a.email}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span
                        className={`px-2 py-0.5 rounded text-xs font-medium ${
                          a.role === 'SUPER_ADMIN' ? 'bg-purple-500/15 text-purple-400' : 'bg-gold-500/15 text-gold-400'
                        }`}
                      >
                        {a.role}
                      </span>
                      {isSuper && a.role === 'ADMIN' && (
                        <button
                          onClick={() => demote(a.id)}
                          className="text-xs px-2 py-1 rounded border border-red-500/30 text-red-400 hover:bg-red-500/10 flex items-center gap-1"
                        >
                          <ShieldOff className="w-3 h-3" /> Demote
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <p className="text-xs mt-4" style={{ color: 'var(--color-text-muted)' }}>
              To promote a USER to ADMIN, go to the Users page, select the user, and use the role controls in the
              detail panel.
            </p>
          </section>
        </div>
      )}
    </div>
  );
}
