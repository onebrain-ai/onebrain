import { cronFieldsToLaunchd } from './cron-parse';
import type { ScheduleEntry } from './types';

const xmlEscape = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

interface LaunchdContext {
  vaultPath: string;
  skillCliPath: string;
  logBasePath: string;
}

export function generatePlist(entry: ScheduleEntry, ctx: LaunchdContext): string {
  const labelSafe = entry.skill.replace(/^\//, '').replace(/[^a-zA-Z0-9-]/g, '-');
  const label = `com.onebrain.${labelSafe}`;
  const calendar = cronFieldsToLaunchd(entry.cron);
  const calendarXml = Object.entries(calendar)
    .map(([k, v]) => `        <key>${k}</key>\n        <integer>${v}</integer>`)
    .join('\n');

  const argsBlock = entry.args
    ? `\n${Object.entries(entry.args)
        .map(([k, v]) => `        <string>--${k}=${xmlEscape(v)}</string>`)
        .join('\n')}`
    : '';

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>${xmlEscape(label)}</string>
    <key>ProgramArguments</key>
    <array>
        <string>${xmlEscape(ctx.skillCliPath)}</string>
        <string>--vault</string>
        <string>${xmlEscape(ctx.vaultPath)}</string>
        <string>--skill</string>
        <string>${xmlEscape(entry.skill)}</string>
        <string>--headless</string>${argsBlock}
    </array>
    <key>StartCalendarInterval</key>
    <dict>
${calendarXml}
    </dict>
    <key>StandardOutPath</key>
    <string>${xmlEscape(ctx.logBasePath)}/onebrain-${labelSafe}.stdout</string>
    <key>StandardErrorPath</key>
    <string>${xmlEscape(ctx.logBasePath)}/onebrain-${labelSafe}.stderr</string>
    <key>RunAtLoad</key>
    <false/>
</dict>
</plist>`;
}

export function plistPath(skill: string, homedir: string): string {
  const labelSafe = skill.replace(/^\//, '').replace(/[^a-zA-Z0-9-]/g, '-');
  return `${homedir}/Library/LaunchAgents/com.onebrain.${labelSafe}.plist`;
}
