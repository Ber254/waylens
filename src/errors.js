// Turns raw SDK / browser errors into a small set of user-facing categories.
const rules = [
  ['camera', (m, e) => ['NotAllowedError', 'NotFoundError', 'NotReadableError', 'OverconstrainedError'].includes(e?.name)],
  ['timeout', (m) => /timeout has expired|timed out|aborterror/i.test(m)],
  ['quota', (m) => /\b429\b|quota|rate.?limit|resource.?exhausted/i.test(m)],
  ['modelNotFound', (m) => /\b404\b|no longer available|not found|is not supported/i.test(m)],
  ['overloaded', (m) => /\b(500|503)\b|high demand|overloaded|unavailable|internal/i.test(m)],
  ['appCheck', (m) => /app.?check|appcheck|\b401\b|\b403\b|permission|api key|api has not been used|not enabled/i.test(m)],
  ['blocked', (m) => /safety|blocked|prohibited|recitation/i.test(m)],
  ['network', (m) => /failed to fetch|networkerror|network request failed|load failed/i.test(m)],
];

/** @returns {{key:string, detail:string}} */
export function classifyError(e, { privacy = false, online = navigator.onLine } = {}) {
  const raw = String(e?.message ?? e ?? '');
  const detail = (e?.attempts?.length ? e.attempts.join(' | ') : raw).replace(/\s+/g, ' ').slice(0, 260);
  if (privacy && /on-device|local|api_not_enabled|not available/i.test(raw) && !/\b(401|403|429|500|503)\b/.test(raw)) {
    return { key: 'privateUnavailable', detail };
  }
  for (const [key, test] of rules) if (test(raw, e)) return { key: !online && (key === 'network' || key === 'timeout') ? 'offline' : key, detail };
  return { key: !online ? 'offline' : 'unknown', detail };
}
