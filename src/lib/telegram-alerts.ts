import type { ResolvedAppSettings } from './app-settings';
import type { TelegramCallError, TelegramCallOk } from './telegram-client';
import { telegramSendMessageHtml } from './telegram-client';
import { formatBytes, percent } from './utils';

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function isTelegramAlertsConfigured(settings: ResolvedAppSettings): boolean {
  return Boolean(settings.telegramBotToken && settings.telegramChatId);
}

export type HeartbeatForAlert = {
  cpuPercent: number;
  memUsedBytes: number;
  memTotalBytes: number;
  diskUsedBytes: number;
  diskTotalBytes: number;
};

export function evaluateOverload(
  m: HeartbeatForAlert,
  thresholds: { cpu: number; ram: number; disk: number }
): {
  ramPct: number;
  diskPct: number;
  cpuHigh: boolean;
  ramHigh: boolean;
  diskHigh: boolean;
} {
  const ramPct = percent(m.memUsedBytes, m.memTotalBytes);
  const diskPct = percent(m.diskUsedBytes, m.diskTotalBytes);
  return {
    ramPct,
    diskPct,
    cpuHigh: m.cpuPercent >= thresholds.cpu,
    ramHigh: ramPct >= thresholds.ram,
    diskHigh: diskPct >= thresholds.disk,
  };
}

/**
 * Sends one Telegram message if any metric is over threshold and cooldown elapsed.
 * Does not throw — logs failures only.
 */
export async function sendTelegramOverloadIfNeeded(
  agent: {
    agentId: string;
    hostname: string;
    label?: string | null;
    publicIp?: string | null;
    lastTelegramAlertAt?: Date | null;
  },
  m: HeartbeatForAlert,
  settings: ResolvedAppSettings,
  appUrl: string
): Promise<boolean> {
  if (!isTelegramAlertsConfigured(settings)) return false;

  const thresholds = {
    cpu: settings.alertCpuPercent,
    ram: settings.alertRamPercent,
    disk: settings.alertDiskPercent,
  };
  const ev = evaluateOverload(m, thresholds);
  if (!ev.cpuHigh && !ev.ramHigh && !ev.diskHigh) return false;

  const cooldownMs = settings.telegramCooldownSeconds * 1000;
  const last = agent.lastTelegramAlertAt ? new Date(agent.lastTelegramAlertAt).getTime() : 0;
  if (last && Date.now() - last < cooldownMs) return false;

  const displayName = (agent.label?.trim() || agent.hostname || agent.agentId).slice(0, 200);
  const lines: string[] = [
    `<b>⚠️ VPS Monitor — tài nguyên vượt ngưỡng</b>`,
    `<b>Máy:</b> ${escapeHtml(displayName)}`,
    `<code>${escapeHtml(agent.agentId)}</code>`,
  ];
  if (agent.publicIp) lines.push(`<b>IP:</b> <code>${escapeHtml(agent.publicIp)}</code>`);

  if (ev.cpuHigh) {
    lines.push(`<b>CPU:</b> ${m.cpuPercent.toFixed(1)}% <i>(≥ ${thresholds.cpu}%)</i>`);
  }
  if (ev.ramHigh) {
    lines.push(
      `<b>RAM:</b> ${ev.ramPct.toFixed(1)}% — ${formatBytes(m.memUsedBytes)} / ${formatBytes(
        m.memTotalBytes
      )} <i>(≥ ${thresholds.ram}%)</i>`
    );
  }
  if (ev.diskHigh) {
    lines.push(
      `<b>Ổ đĩa (/):</b> ${ev.diskPct.toFixed(1)}% — ${formatBytes(m.diskUsedBytes)} / ${formatBytes(
        m.diskTotalBytes
      )} <i>(≥ ${thresholds.disk}%)</i>`
    );
  }

  const base = appUrl.replace(/\/$/, '');
  const url = `${base}/servers/${encodeURIComponent(agent.agentId)}`;
  const href = url.replace(/&/g, '&amp;');
  lines.push(`<a href="${href}">Mở chi tiết trên dashboard</a>`);

  const result = await telegramSendMessageHtml(
    settings.telegramBotToken!,
    settings.telegramChatId!,
    lines.join('\n')
  );
  if (!result.ok) {
    console.error('[telegram] sendMessage failed:', result.httpStatus, result.description);
    return false;
  }
  return true;
}

/** Sends a short test message (Settings → “Gửi tin thử”). */
export async function sendTelegramSettingsTest(settings: ResolvedAppSettings): Promise<boolean> {
  const r = await sendTelegramSettingsTestResult(settings);
  return r.ok;
}

export async function sendTelegramSettingsTestResult(
  settings: ResolvedAppSettings
): Promise<TelegramCallOk | TelegramCallError> {
  if (!isTelegramAlertsConfigured(settings)) {
    return { ok: false, httpStatus: 400, description: 'Chưa cấu hình bot token + chat id.' };
  }
  return telegramSendMessageHtml(
    settings.telegramBotToken!,
    settings.telegramChatId!,
    `<b>VPS Monitor</b>\n${escapeHtml(
      'Thử nghiệm — nếu bạn thấy tin này, bot và chat id đã đúng.'
    )}`
  );
}
