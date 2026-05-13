'use client';

import useSWR from 'swr';
import { useState } from 'react';
import { Check, Copy, KeyRound, Loader2, Monitor, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { ThemeToggle } from '@/components/ThemeToggle';

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function SettingsClient({
  appUrl,
  offlineAfterSeconds,
}: {
  appUrl: string;
  offlineAfterSeconds: number;
}) {
  const { data } = useSWR<{ user: { username: string } | null }>('/api/auth/me', fetcher);

  const [oldPwd, setOldPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(appUrl);
    setCopied(true);
    toast.success('Copied');
    setTimeout(() => setCopied(false), 1500);
  };

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPwd.length < 8) return toast.error('New password must be at least 8 chars.');
    if (newPwd !== confirmPwd) return toast.error('Passwords do not match.');
    setSaving(true);
    const res = await fetch('/api/auth/password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ oldPassword: oldPwd, newPassword: newPwd }),
    });
    const out = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) return toast.error(out.error ?? 'Failed');
    toast.success('Password updated');
    setOldPwd('');
    setNewPwd('');
    setConfirmPwd('');
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">Settings</h1>
        <p className="mt-1 text-sm text-ink-muted">Manage your admin account and dashboard.</p>
      </div>

      <div className="card card-pad">
        <h2 className="flex items-center gap-2 text-base font-semibold text-ink">
          <Monitor className="h-4 w-4 text-ink-muted" />
          Appearance
        </h2>
        <p className="mt-1 text-sm text-ink-muted">
          Light or dark interface. Your choice is saved in this browser.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <span className="text-sm text-ink-soft">Theme</span>
          <ThemeToggle className="border border-border bg-bg-muted" />
        </div>
      </div>

      <div className="card card-pad">
        <h2 className="flex items-center gap-2 text-base font-semibold text-ink">
          <ShieldCheck className="h-4 w-4 text-success" />
          Account
        </h2>
        <dl className="mt-4 grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-3">
          <Row label="Username" value={data?.user?.username ?? '—'} />
          <Row label="Role" value="Administrator" />
          <Row label="Public sign-ups" value={<span className="chip-muted">Disabled</span>} />
        </dl>
      </div>

      <form onSubmit={changePassword} className="card card-pad">
        <h2 className="flex items-center gap-2 text-base font-semibold text-ink">
          <KeyRound className="h-4 w-4 text-ink-muted" />
          Change password
        </h2>
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
          <div>
            <label className="label">Current password</label>
            <input
              type="password"
              className="input"
              value={oldPwd}
              onChange={(e) => setOldPwd(e.target.value)}
              required
              autoComplete="current-password"
            />
          </div>
          <div>
            <label className="label">New password</label>
            <input
              type="password"
              className="input"
              value={newPwd}
              onChange={(e) => setNewPwd(e.target.value)}
              minLength={8}
              required
              autoComplete="new-password"
            />
          </div>
          <div>
            <label className="label">Confirm new password</label>
            <input
              type="password"
              className="input"
              value={confirmPwd}
              onChange={(e) => setConfirmPwd(e.target.value)}
              minLength={8}
              required
              autoComplete="new-password"
            />
          </div>
        </div>
        <div className="mt-4">
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Update password
          </button>
        </div>
      </form>

      <div className="card card-pad">
        <h2 className="text-base font-semibold text-ink">Dashboard</h2>
        <dl className="mt-4 grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-[11px] uppercase tracking-wider text-ink-soft">App URL</dt>
            <dd className="mt-1 flex items-center gap-2">
              <code className="truncate font-mono text-ink">{appUrl}</code>
              <button
                onClick={copy}
                className="rounded-md p-1.5 text-ink-soft hover:bg-bg-muted hover:text-ink"
              >
                {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
              </button>
            </dd>
            <p className="mt-1 text-[11px] text-ink-soft">
              Set via <code>NEXT_PUBLIC_APP_URL</code> in your environment.
            </p>
          </div>
          <Row
            label="Offline threshold"
            value={`${offlineAfterSeconds}s without heartbeat`}
          />
        </dl>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-[11px] uppercase tracking-wider text-ink-soft">{label}</dt>
      <dd className="truncate text-ink">{value}</dd>
    </div>
  );
}
