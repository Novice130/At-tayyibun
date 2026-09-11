'use client';

import React from 'react';
import {
  Shield,
  ShieldOff,
  X,
  Trash2,
  Crown,
  Sparkles,
  UserCheck,
  UserX,
  Copy,
  Sliders,
  Loader,
  BellRing,
} from 'lucide-react';

export interface InspectorContentProps {
  selectedId: string | null;
  detail: any;
  detailLoading: boolean;
  detailError: string | null;
  isSuper: boolean;
  updatingBoost: boolean;
  onClose: () => void;
  onSetBoost: (userId: string, boost: number) => Promise<void>;
  onSetTier: (userId: string, tier: 'FREE' | 'SILVER' | 'GOLD') => Promise<void>;
  onToggleVerified: (userId: string, current: boolean) => Promise<void>;
  onPromote: (userId: string) => Promise<void>;
  onDemote: (userId: string) => Promise<void>;
  onDelete: (userId: string, label: string) => Promise<void>;
  onCopy: (text: string, label?: string) => void;
  onNudge?: (userId: string, label: string) => Promise<void>;
  nudging?: boolean;
}

export function InspectorContent({
  selectedId,
  detail,
  detailLoading,
  detailError,
  isSuper,
  updatingBoost,
  onClose,
  onSetBoost,
  onSetTier,
  onToggleVerified,
  onPromote,
  onDemote,
  onDelete,
  onCopy,
  onNudge,
  nudging,
}: InspectorContentProps) {
  if (!selectedId) {
    return (
      <div className="text-sm text-center py-10" style={{ color: 'var(--color-text-secondary)' }}>
        <Sliders className="w-8 h-8 mx-auto mb-2 opacity-30 text-gold-500" />
        <p className="font-medium">Select a user to view interactive operations.</p>
        <p className="text-xs text-muted mt-1">Adjust boost, change tier, or promote/demote</p>
      </div>
    );
  }

  if (detailLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-2" style={{ color: 'var(--color-text-secondary)' }}>
        <Loader className="w-6 h-6 animate-spin text-gold-500" />
        <span className="text-xs font-medium">Loading user details…</span>
      </div>
    );
  }

  if (detailError) {
    return (
      <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg text-sm">
        {detailError}
      </div>
    );
  }

  if (!detail) return null;

  const currentBoost = detail.rankBoost ?? 0;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between pb-3 border-b" style={{ borderColor: 'var(--color-border)' }}>
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-heading text-lg font-bold" style={{ color: 'var(--color-text)' }}>
              {detail.profile?.firstName || detail.name || 'User Profile'}
            </h2>
            <RoleBadge role={detail.role} />
          </div>
          <button
            onClick={() => onCopy(detail.publicId, 'Public ID')}
            className="flex items-center gap-1.5 text-xs font-mono text-gold-500 hover:underline mt-0.5"
          >
            {detail.publicId} <Copy className="w-3 h-3" />
          </button>
        </div>
        <button
          onClick={onClose}
          aria-label="Close inspector"
          className="p-1.5 rounded-lg hover:bg-gold-500/10 text-muted transition"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Quick Details Roster */}
      <dl className="grid grid-cols-2 gap-2.5 text-xs p-3 rounded-xl" style={{ backgroundColor: 'var(--color-surface-hover)' }}>
        <div>
          <dt style={{ color: 'var(--color-text-secondary)' }}>Email</dt>
          <dd className="font-medium truncate mt-0.5" style={{ color: 'var(--color-text)' }} title={detail.email}>
            {detail.email}
          </dd>
        </div>
        <div>
          <dt style={{ color: 'var(--color-text-secondary)' }}>Phone</dt>
          <dd className="font-medium mt-0.5" style={{ color: 'var(--color-text)' }}>
            {detail.phone || '—'}
            {detail.phone && (
              <span
                className={`ml-1.5 text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                  detail.isPhoneVerified
                    ? 'bg-green-500/15 text-green-400'
                    : 'bg-amber-500/15 text-amber-400'
                }`}
              >
                {detail.isPhoneVerified ? 'verified' : 'unverified'}
              </span>
            )}
          </dd>
        </div>
        <div>
          <dt style={{ color: 'var(--color-text-secondary)' }}>Photos Uploaded</dt>
          <dd className="font-medium mt-0.5" style={{ color: 'var(--color-text)' }}>
            {detail.photos?.length ?? 0} photos
          </dd>
        </div>
        <div>
          <dt style={{ color: 'var(--color-text-secondary)' }}>Member Since</dt>
          <dd className="font-medium mt-0.5" style={{ color: 'var(--color-text)' }}>
            {detail.createdAt ? new Date(detail.createdAt).toLocaleDateString() : '—'}
          </dd>
        </div>
      </dl>

      {/* Nudge: incomplete email signup with no verified phone and no profile */}
      {onNudge && !detail.isPhoneVerified && !detail.profile && !detail.emailIsPlaceholder && (
        <button
          onClick={() => onNudge(detail.id, detail.profile?.firstName || detail.email)}
          disabled={nudging}
          className="w-full py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition border border-amber-500/30 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 disabled:opacity-60"
        >
          {nudging ? <Loader className="w-4 h-4 animate-spin" /> : <BellRing className="w-4 h-4" />}
          Send Verification Reminder
        </button>
      )}

      {/* Interactive Rank Boost Section */}
      <section className="p-3.5 rounded-xl border" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-bold uppercase tracking-wider text-gold-500 flex items-center gap-1.5">
            <Sliders className="w-3.5 h-3.5" /> Rank Boost
          </label>
          <span className="text-xs font-bold px-2 py-0.5 rounded bg-gold-500/15 text-gold-400">
            +{currentBoost} pts
          </span>
        </div>

        <input
          type="range"
          min={0}
          max={100}
          step={5}
          value={currentBoost}
          disabled={updatingBoost}
          onChange={(e) => onSetBoost(detail.id, Number(e.target.value))}
          className="w-full accent-gold-500 h-2 bg-gray-300 dark:bg-gray-700 rounded-lg cursor-pointer my-2"
        />

        {/* Quick Preset Chips */}
        <div className="flex items-center justify-between gap-1 mt-2">
          {[0, 25, 50, 75, 100].map((preset) => (
            <button
              key={preset}
              type="button"
              disabled={updatingBoost}
              onClick={() => onSetBoost(detail.id, preset)}
              className={`flex-1 py-1 rounded text-[11px] font-semibold transition border ${
                currentBoost === preset
                  ? 'bg-gold-500 text-black border-gold-500'
                  : 'border-theme hover:bg-gold-500/10 text-secondary'
              }`}
            >
              {preset === 0 ? '0' : `+${preset}`}
            </button>
          ))}
        </div>
      </section>

      {/* Interactive Membership Tier & Verification Control */}
      <section className="space-y-3">
        <div>
          <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>
            Membership Tier
          </label>
          <div className="grid grid-cols-3 gap-2">
            {(['FREE', 'SILVER', 'GOLD'] as const).map((t) => {
              const active = detail.membershipTier === t;
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => onSetTier(detail.id, t)}
                  className={`py-2 px-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 transition border ${
                    active
                      ? t === 'GOLD'
                        ? 'bg-gold-500 text-black border-gold-500 shadow'
                        : t === 'SILVER'
                          ? 'bg-gray-300 text-gray-900 border-gray-400 font-bold'
                          : 'bg-surface-hover text-primary border-primary font-bold'
                      : 'border-theme text-secondary hover:bg-gold-500/10'
                  }`}
                >
                  {t === 'GOLD' && <Crown className="w-3.5 h-3.5" />}
                  {t === 'SILVER' && <Sparkles className="w-3.5 h-3.5" />}
                  {t}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>
            Verification Status
          </label>
          <button
            type="button"
            onClick={() => onToggleVerified(detail.id, detail.isVerified)}
            className={`w-full py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition border ${
              detail.isVerified
                ? 'bg-green-500/15 text-green-400 border-green-500/30 hover:bg-green-500/20'
                : 'bg-surface-hover text-secondary border-theme hover:bg-gold-500/10'
            }`}
          >
            {detail.isVerified ? (
              <>
                <UserCheck className="w-4 h-4 text-green-400" />
                Verified User (Click to Revoke)
              </>
            ) : (
              <>
                <UserX className="w-4 h-4 text-muted" />
                Unverified (Click to Mark Verified)
              </>
            )}
          </button>
        </div>
      </section>

      {/* Role Management */}
      <section className="pt-2 border-t" style={{ borderColor: 'var(--color-border)' }}>
        <h3 className="text-xs font-semibold mb-2" style={{ color: 'var(--color-text-secondary)' }}>
          Role Management
        </h3>
        {!isSuper ? (
          <div className="text-xs p-2.5 rounded-lg bg-surface-hover" style={{ color: 'var(--color-text-muted)' }}>
            Only SUPER_ADMINs can change admin privileges.
          </div>
        ) : detail.role === 'USER' ? (
          <button
            onClick={() => onPromote(detail.id)}
            className="btn-primary w-full py-2.5 text-xs font-semibold flex items-center justify-center gap-2 shadow-sm"
          >
            <Shield className="w-4 h-4" /> Promote to ADMIN
          </button>
        ) : detail.role === 'ADMIN' ? (
          <button
            onClick={() => onDemote(detail.id)}
            className="w-full py-2.5 text-xs font-semibold rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10 transition flex items-center justify-center gap-2"
          >
            <ShieldOff className="w-4 h-4" /> Demote to Regular USER
          </button>
        ) : (
          <div className="text-xs p-2.5 rounded-lg bg-surface-hover text-purple-400">
            SUPER_ADMIN role cannot be demoted via panel.
          </div>
        )}
      </section>

      {/* Danger Zone */}
      {detail.role !== 'SUPER_ADMIN' && (
        <section className="pt-3 border-t" style={{ borderColor: 'var(--color-border)' }}>
          <h3 className="text-xs font-bold uppercase tracking-wider text-red-400 mb-2">Danger Zone</h3>
          <button
            onClick={() => onDelete(detail.id, detail.profile?.firstName || detail.email)}
            className="w-full py-2 text-xs font-semibold rounded-lg border border-red-500/40 text-red-400 hover:bg-red-500/10 transition flex items-center justify-center gap-2"
          >
            <Trash2 className="w-4 h-4" /> Permanently Delete Account
          </button>
          <p className="text-[10px] mt-1.5 text-muted leading-tight">
            Permanently removes profile, uploaded photos, sessions, and connections.
          </p>
        </section>
      )}
    </div>
  );
}

export function RoleBadge({ role }: { role: string }) {
  const cls =
    role === 'SUPER_ADMIN'
      ? 'bg-purple-500/15 text-purple-400 border border-purple-500/30'
      : role === 'ADMIN'
        ? 'bg-gold-500/15 text-gold-400 border border-gold-500/30'
        : 'bg-gray-500/15 text-gray-400 border border-gray-500/30';
  return <span className={`px-2 py-0.5 rounded text-[11px] font-semibold leading-tight ${cls}`}>{role}</span>;
}

export function TierBadge({ tier }: { tier: string }) {
  const cls =
    tier === 'GOLD'
      ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
      : tier === 'SILVER'
        ? 'bg-slate-400/15 text-slate-300 border border-slate-400/30'
        : 'bg-zinc-500/15 text-zinc-400 border border-zinc-500/20';
  return <span className={`px-2 py-0.5 rounded text-[11px] font-medium leading-tight ${cls}`}>{tier}</span>;
}
