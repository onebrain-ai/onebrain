// Field regex: supports digits, `*`, ranges (`-`), and lists (`,`). Step syntax (`*/N`) is not supported.
const CRON_FIELD_RE = /^[\d*,\-/]+$/;

export function validateCron(cron: string): { valid: boolean; reason?: string } {
  const fields = cron.trim().split(/\s+/);
  if (fields.length !== 5) {
    return { valid: false, reason: `expected 5 fields, got ${fields.length}` };
  }
  for (const f of fields) {
    if (!CRON_FIELD_RE.test(f)) {
      return { valid: false, reason: `invalid field syntax: "${f}"` };
    }
  }
  return { valid: true };
}

/** Convert a 5-field cron string to a launchd `StartCalendarInterval` dict. Assumes `cron` already passed `validateCron`. */
export function cronFieldsToLaunchd(cron: string): {
  Minute?: number;
  Hour?: number;
  Day?: number;
  Month?: number;
  Weekday?: number;
} {
  const [m, h, dom, mon, dow] = cron.trim().split(/\s+/);
  const out: { Minute?: number; Hour?: number; Day?: number; Month?: number; Weekday?: number } =
    {};
  if (m !== '*') out.Minute = Number.parseInt(m, 10);
  if (h !== '*') out.Hour = Number.parseInt(h, 10);
  if (dom !== '*') out.Day = Number.parseInt(dom, 10);
  if (mon !== '*') out.Month = Number.parseInt(mon, 10);
  if (dow !== '*') out.Weekday = Number.parseInt(dow, 10);
  return out;
}
