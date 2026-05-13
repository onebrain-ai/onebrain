import { describe, expect, test } from 'bun:test';
import { generatePlist, plistPath } from './launchd.js';

const ctx = {
  vaultPath: '/Users/test/vault',
  skillCliPath: '/opt/homebrew/bin/onebrain',
  logBasePath: '/Users/test/vault/07-logs/scheduler/2026/05',
  homedir: '/Users/test',
  uid: 501,
};

describe('generatePlist — recurring skill mode', () => {
  test('daily 9am /daily emits `run-skill` subcommand + --vault + --skill', () => {
    const out = generatePlist({ cron: '0 9 * * *', skill: '/daily' }, ctx);
    expect(out).toContain('<string>com.onebrain.daily</string>');
    expect(out).toContain('<key>Hour</key>\n        <integer>9</integer>');
    expect(out).toContain('<string>/opt/homebrew/bin/onebrain</string>');
    expect(out).toContain('<string>run-skill</string>');
    expect(out).toContain('<string>--vault</string>');
    expect(out).toContain('<string>/Users/test/vault</string>');
    expect(out).toContain('<string>--skill</string>');
    expect(out).toContain('<string>/daily</string>');
    // The pre-v2.3.3 shape used --headless; verify it's gone so we don't
    // accidentally regress to the broken contract.
    expect(out).not.toContain('<string>--headless</string>');
  });

  test('with args: --arg key=value emitted as two adjacent <string> elements', () => {
    const out = generatePlist(
      { cron: '0 12 * * 0', skill: '/distill', args: { topic: 'this-week' } },
      ctx,
    );
    expect(out).toContain('<string>--arg</string>');
    expect(out).toContain('<string>topic=this-week</string>');
  });

  test('escapes XML-sensitive chars in arg values', () => {
    const out = generatePlist(
      { cron: '0 9 * * *', skill: '/echo', args: { msg: 'a & b < c' } },
      ctx,
    );
    expect(out).toContain('<string>msg=a &amp; b &lt; c</string>');
    expect(out).not.toContain('<string>msg=a & b'); // raw chars must not appear
  });

  test('no blank line in <array> when args absent', () => {
    const out = generatePlist({ cron: '0 9 * * *', skill: '/daily' }, ctx);
    expect(out).not.toMatch(/<string>\/daily<\/string>\n\n\s*<\/array>/);
  });
});

describe('generatePlist — one-shot skill mode', () => {
  test('emits Year/Month/Day/Hour/Minute', () => {
    const out = generatePlist({ at: '2026-05-13 14:30', skill: '/reminder' }, ctx);
    expect(out).toContain('<key>Year</key>\n        <integer>2026</integer>');
    expect(out).toContain('<key>Month</key>\n        <integer>5</integer>');
    expect(out).toContain('<key>Day</key>\n        <integer>13</integer>');
    expect(out).toContain('<key>Hour</key>\n        <integer>14</integer>');
    expect(out).toContain('<key>Minute</key>\n        <integer>30</integer>');
  });

  test('shell wrapper invokes `run-skill` and self-deletes', () => {
    const out = generatePlist({ at: '2026-05-13 14:30', skill: '/reminder' }, ctx);
    expect(out).toContain('<string>/bin/sh</string>');
    expect(out).toContain('<string>-c</string>');
    expect(out).toContain('run-skill');
    expect(out).toContain('--vault=&quot;/Users/test/vault&quot;');
    expect(out).toContain('--skill=&quot;/reminder&quot;');
    expect(out).toContain('launchctl bootout gui/501/com.onebrain.reminder');
    expect(out).toContain('rm -f');
    expect(out).not.toContain('--headless');
  });

  test('one-shot args use --arg="key=value" form inside wrapper', () => {
    const out = generatePlist(
      { at: '2026-05-13 14:30', skill: '/echo', args: { msg: 'hello' } },
      ctx,
    );
    expect(out).toContain('--arg=&quot;msg=hello&quot;');
  });
});

describe('plistPath', () => {
  test('returns LaunchAgents path', () => {
    expect(plistPath('/daily', '/Users/test')).toBe(
      '/Users/test/Library/LaunchAgents/com.onebrain.daily.plist',
    );
  });
});

describe('generatePlist — command mode', () => {
  const cctx = { ...ctx, uid: 501, homedir: '/Users/test' };

  test('recurring command emits hook-style ProgramArguments', () => {
    const out = generatePlist(
      { cron: '0 3 * * 0', command: '/opt/homebrew/bin/onebrain', args: ['qmd-reindex'] },
      cctx,
    );
    expect(out).toContain('<string>/opt/homebrew/bin/onebrain</string>');
    expect(out).toContain('<string>qmd-reindex</string>');
    expect(out).not.toContain('<string>--skill</string>');
    expect(out).not.toContain('<string>--vault</string>');
    expect(out).not.toContain('<string>run-skill</string>');
  });

  test('label derives from command basename — absolute path and bare name produce same label', () => {
    const fromBare = generatePlist(
      { cron: '0 3 * * 0', command: 'onebrain', args: ['qmd-reindex'] },
      cctx,
    );
    const fromAbs = generatePlist(
      { cron: '0 3 * * 0', command: '/opt/homebrew/bin/onebrain', args: ['qmd-reindex'] },
      cctx,
    );
    expect(fromBare).toContain('<string>com.onebrain.onebrain</string>');
    expect(fromAbs).toContain('<string>com.onebrain.onebrain</string>');
  });

  test('one-shot command wraps in self-delete shell', () => {
    const out = generatePlist(
      { at: '2026-05-13 14:30', command: '/opt/homebrew/bin/onebrain', args: ['qmd-reindex'] },
      cctx,
    );
    expect(out).toContain('<string>/bin/sh</string>');
    expect(out).toContain('&quot;/opt/homebrew/bin/onebrain&quot; &quot;qmd-reindex&quot;');
    expect(out).toContain('launchctl bootout gui/501/com.onebrain.onebrain');
    expect(out).toContain('rm -f');
  });

  test('command with no args produces single-element argv', () => {
    const out = generatePlist({ cron: '0 3 * * 0', command: '/usr/bin/true' }, cctx);
    expect(out).toContain('<string>/usr/bin/true</string>');
  });

  test('command with non-onebrain binary works (rsync example)', () => {
    const out = generatePlist(
      { cron: '0 5 * * *', command: '/usr/bin/rsync', args: ['-av', '/src', '/dst'] },
      cctx,
    );
    expect(out).toContain('<string>/usr/bin/rsync</string>');
    expect(out).toContain('<string>-av</string>');
  });

  test('command-mode args containing XML-special chars are escaped', () => {
    const out = generatePlist(
      { cron: '0 5 * * *', command: '/usr/local/bin/rclone', args: ['--exclude', 'a & b'] },
      cctx,
    );
    expect(out).toContain('<string>--exclude</string>');
    expect(out).toContain('<string>a &amp; b</string>');
    expect(out).not.toContain('<string>a & b</string>'); // raw `&` must not appear
  });
});
