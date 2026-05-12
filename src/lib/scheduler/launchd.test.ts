import { describe, expect, test } from 'bun:test';
import { generatePlist, plistPath } from './launchd';

const ctx = {
  vaultPath: '/Users/test/vault',
  skillCliPath: '/usr/local/bin/claude-code',
  logBasePath: '/Users/test/vault/07-logs/scheduler/2026/05',
};

describe('generatePlist', () => {
  test('daily 9am /daily', () => {
    const out = generatePlist({ cron: '0 9 * * *', skill: '/daily' }, ctx);
    expect(out).toContain('<string>com.onebrain.daily</string>');
    expect(out).toContain('<key>Hour</key>\n        <integer>9</integer>');
    expect(out).toContain('<string>--skill</string>');
    expect(out).toContain('<string>/daily</string>');
    expect(out).toContain('<string>--headless</string>');
  });

  test('with args', () => {
    const out = generatePlist(
      { cron: '0 12 * * 0', skill: '/distill', args: { topic: 'this-week' } },
      ctx,
    );
    expect(out).toContain('<string>--topic=this-week</string>');
  });

  test('escapes XML-sensitive chars in args', () => {
    const out = generatePlist(
      { cron: '0 9 * * *', skill: '/echo', args: { msg: 'a & b < c' } },
      ctx,
    );
    expect(out).toContain('<string>--msg=a &amp; b &lt; c</string>');
    expect(out).not.toContain('a & b'); // ensure raw chars are gone
  });

  test('no blank line in <array> when args absent', () => {
    const out = generatePlist({ cron: '0 9 * * *', skill: '/daily' }, ctx);
    expect(out).not.toMatch(/<string>--headless<\/string>\n\n\s*<\/array>/);
  });
});

describe('plistPath', () => {
  test('returns LaunchAgents path', () => {
    expect(plistPath('/daily', '/Users/test')).toBe(
      '/Users/test/Library/LaunchAgents/com.onebrain.daily.plist',
    );
  });
});
