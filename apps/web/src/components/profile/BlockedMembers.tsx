'use client';

import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { Loader } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { BlockedMember, blockedMemberLabel } from '@/lib/moderation';

/** The member's own block list, with unblock. Shows no email, even if one is sent. */
export function BlockedMembers() {
  const [members, setMembers] = useState<BlockedMember[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [unblocking, setUnblocking] = useState<string | null>(null);

  useEffect(() => {
    api
      .get('/blocks')
      .then((rows: unknown) => setMembers(Array.isArray(rows) ? (rows as BlockedMember[]) : []))
      .catch(() => setFailed(true));
  }, []);

  const handleUnblock = async (member: BlockedMember) => {
    const label = blockedMemberLabel(member);
    if (!confirm(`Unblock ${label}? You may see each other in browse again.`)) return;
    setUnblocking(member.targetPublicId);
    try {
      await api.delete(`/blocks/${encodeURIComponent(member.targetPublicId)}`);
      setMembers((prev) => prev?.filter((m) => m.targetPublicId !== member.targetPublicId) ?? null);
      toast.success(`${label} has been unblocked.`);
    } catch (err: any) {
      toast.error(err?.message || 'Could not unblock this member. Please try again.');
    } finally {
      setUnblocking(null);
    }
  };

  return (
    <div className="card p-6 sm:p-8">
      <h2 className="font-heading text-xl font-bold mb-4">Blocked Members</h2>
      {failed ? (
        <p className="text-sm text-red-400">Could not load your blocked members. Please refresh and try again.</p>
      ) : members === null ? (
        <Loader className="w-5 h-5 text-gold-500 animate-spin" aria-label="Loading" />
      ) : members.length === 0 ? (
        <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>You have not blocked anyone.</p>
      ) : (
        <ul className="space-y-3">
          {members.map((member) => (
            <li key={member.targetPublicId} className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="font-medium truncate">{blockedMemberLabel(member)}</p>
                {member.createdAt && (
                  <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                    Blocked {format(new Date(member.createdAt), 'MMM d, yyyy')}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => handleUnblock(member)}
                disabled={unblocking === member.targetPublicId}
                className="btn-secondary flex-shrink-0"
              >
                {unblocking === member.targetPublicId ? <Loader className="w-4 h-4 animate-spin" /> : 'Unblock'}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
