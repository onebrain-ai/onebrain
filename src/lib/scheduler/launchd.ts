import { basename } from 'node:path';
import { atToLaunchd, cronFieldsToLaunchd } from './cron-parse.js';
import { isCommandMode, isOneShot } from './entry.js';
import type { ScheduleEntry } from './types.js';

const xmlEscape = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

interface LaunchdContext {
  vaultPath: string;
  skillCliPath: string;
  logBasePath: string;
  homedir: string;
  uid: number;
}

export function labelForEntry(entry: ScheduleEntry): string {
  // For command mode, derive the label from the binary basename so that
  // `command: onebrain` and `command: /opt/homebrew/bin/onebrain` produce
  // the same plist file path — that consistency is what the collision
  // detector in register-schedule.ts relies on. For skill mode, strip the
  // leading slash.
  const raw = isCommandMode(entry)
    ? basename(entry.command as string)
    : (entry.skill ?? '').replace(/^\//, '');
  return raw.replace(/[^a-zA-Z0-9-]/g, '-');
}

export function generatePlist(entry: ScheduleEntry, ctx: LaunchdContext): string {
  const labelSafe = labelForEntry(entry);
  const label = `com.onebrain.${labelSafe}`;

  const calendar = isOneShot(entry)
    ? atToLaunchd(entry.at)
    : cronFieldsToLaunchd(entry.cron as string);
  const calendarXml = Object.entries(calendar)
    .map(([k, v]) => `        <key>${k}</key>\n        <integer>${v}</integer>`)
    .join('\n');

  let programArgumentsBlock: string;

  if (isOneShot(entry)) {
    if (isCommandMode(entry)) {
      // Args pre-validated by sanitizeArgsForOneShot in register-schedule.ts before reaching here.
      const argv = (entry.args as string[] | undefined) ?? [];
      const quotedArgs = argv.map((a) => `"${a}"`).join(' ');
      const innerCommand = `"${entry.command}"${quotedArgs ? ` ${quotedArgs}` : ''}`;
      const plistFilePath = `${ctx.homedir}/Library/LaunchAgents/${label}.plist`;
      const shellLine = xmlEscape(
        `${innerCommand}; launchctl bootout gui/${ctx.uid}/${label}; rm -f "${plistFilePath}"`,
      );
      programArgumentsBlock = `        <string>/bin/sh</string>
        <string>-c</string>
        <string>${shellLine}</string>`;
    } else {
      // Skill mode one-shot — invoke `onebrain run-skill ...`, which shells
      // out to Claude Code internally. Self-delete + bootout after the run.
      // Derive plistFilePath from `label` (same expression as the command-mode
      // branch above) so the cleanup path can never drift from the label used
      // in `launchctl bootout` and the actual on-disk filename.
      const plistFilePath = `${ctx.homedir}/Library/LaunchAgents/${label}.plist`;
      const argsFlags = entry.args
        ? ` ${Object.entries(entry.args as Record<string, string>)
            .map(([k, v]) => `--arg="${k}=${v}"`)
            .join(' ')}`
        : '';
      const shellLine = xmlEscape(
        `"${ctx.skillCliPath}" run-skill --vault="${ctx.vaultPath}" --skill="${entry.skill}"${argsFlags}; launchctl bootout gui/${ctx.uid}/${label}; rm -f "${plistFilePath}"`,
      );
      programArgumentsBlock = `        <string>/bin/sh</string>
        <string>-c</string>
        <string>${shellLine}</string>`;
    }
  } else if (isCommandMode(entry)) {
    // Recurring command mode — hook-style argv array
    const argv = (entry.args as string[] | undefined) ?? [];
    programArgumentsBlock = [
      `        <string>${xmlEscape(entry.command)}</string>`,
      ...argv.map((a) => `        <string>${xmlEscape(a)}</string>`),
    ].join('\n');
  } else {
    // Recurring skill mode — invoke `onebrain run-skill --vault X --skill /name
    // [--arg key=value ...]`. The CLI shells out to `claude -p` internally and
    // streams output through to launchd's stdout/stderr paths.
    const argsBlock = entry.args
      ? `\n${Object.entries(entry.args as Record<string, string>)
          .flatMap(([k, v]) => [
            '        <string>--arg</string>',
            `        <string>${xmlEscape(`${k}=${v}`)}</string>`,
          ])
          .join('\n')}`
      : '';

    programArgumentsBlock = `        <string>${xmlEscape(ctx.skillCliPath)}</string>
        <string>run-skill</string>
        <string>--vault</string>
        <string>${xmlEscape(ctx.vaultPath)}</string>
        <string>--skill</string>
        <string>${xmlEscape(entry.skill ?? '')}</string>${argsBlock}`;
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>${xmlEscape(label)}</string>
    <key>ProgramArguments</key>
    <array>
${programArgumentsBlock}
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

export function plistPath(skillOrLabel: string, homedir: string): string {
  const labelSafe = skillOrLabel.startsWith('/')
    ? skillOrLabel.replace(/^\//, '').replace(/[^a-zA-Z0-9-]/g, '-')
    : skillOrLabel.replace(/[^a-zA-Z0-9-]/g, '-');
  return `${homedir}/Library/LaunchAgents/com.onebrain.${labelSafe}.plist`;
}
