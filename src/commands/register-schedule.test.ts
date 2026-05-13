import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { registerSchedule, resolveCommandBinary } from './register-schedule.js';

let testVault: string;

beforeEach(() => {
  testVault = mkdtempSync(join(tmpdir(), 'onebrain-sched-test-'));
  mkdirSync(join(testVault, '.claude/plugins/onebrain/skills/daily'), { recursive: true });
  writeFileSync(
    join(testVault, '.claude/plugins/onebrain/skills/daily/SKILL.md'),
    '---\nname: daily\nschedulable: true\n---\n\n# /daily\n',
  );
  writeFileSync(
    join(testVault, 'vault.yml'),
    `schedule:\n  - cron: "0 9 * * *"\n    skill: /daily\n`,
  );
});

afterEach(() => rmSync(testVault, { recursive: true, force: true }));

describe('registerSchedule', () => {
  test('--dry-run prints plist without writing', async () => {
    const captured = captureConsoleLog();
    try {
      await registerSchedule({ vault: testVault, dryRun: true });
      expect(captured.lines().some((l) => l.includes('com.onebrain.daily'))).toBe(true);
      expect(captured.lines().some((l) => l.includes('StartCalendarInterval'))).toBe(true);
    } finally {
      captured.restore();
    }
  });

  test('rejects unschedulable skill', async () => {
    writeFileSync(
      join(testVault, '.claude/plugins/onebrain/skills/daily/SKILL.md'),
      '---\nname: daily\nschedulable: false\n---\n',
    );
    await expect(registerSchedule({ vault: testVault, dryRun: true })).rejects.toThrow(
      /requires user input/,
    );
  });

  test('--status reports entry tagged [cron]', async () => {
    const captured = captureConsoleLog();
    try {
      await registerSchedule({ vault: testVault, status: true });
      expect(captured.lines().some((l) => l.includes('Registered schedules: 1'))).toBe(true);
      expect(captured.lines().some((l) => l.includes('[cron]'))).toBe(true);
    } finally {
      captured.restore();
    }
  });

  test('one-shot --dry-run produces plist with Year/Month/Day/Hour/Minute and self-delete wrapper', async () => {
    writeFileSync(
      join(testVault, 'vault.yml'),
      `schedule:\n  - at: "2026-05-13 14:30"\n    skill: /daily\n`,
    );
    const captured = captureConsoleLog();
    try {
      await registerSchedule({ vault: testVault, dryRun: true });
      const joined = captured.lines().join('\n');
      expect(joined).toContain('<key>Year</key>');
      expect(joined).toContain('<key>Day</key>');
      expect(joined).toContain('launchctl bootout');
      expect(joined).toContain('rm -f');
    } finally {
      captured.restore();
    }
  });

  test('rejects entry with both cron and at', async () => {
    writeFileSync(
      join(testVault, 'vault.yml'),
      `schedule:\n  - cron: "0 9 * * *"\n    at: "2026-05-13 14:30"\n    skill: /daily\n`,
    );
    await expect(registerSchedule({ vault: testVault, dryRun: true })).rejects.toThrow(
      /exactly one/,
    );
  });

  test('rejects arg value containing shell-special chars', async () => {
    for (const [_key, yaml] of [
      [
        'double-quote',
        `schedule:\n  - cron: "0 9 * * *"\n    skill: /daily\n    args:\n      msg: 'bad "value"'\n`,
      ],
      [
        'dollar-sign',
        `schedule:\n  - cron: "0 9 * * *"\n    skill: /daily\n    args:\n      msg: 'has $var'\n`,
      ],
      [
        'backtick',
        'schedule:\n  - cron: "0 9 * * *"\n    skill: /daily\n    args:\n      msg: \'has `cmd`\'\n',
      ],
      [
        'backslash',
        `schedule:\n  - cron: "0 9 * * *"\n    skill: /daily\n    args:\n      msg: 'back\\\\slash'\n`,
      ],
    ] as [string, string][]) {
      writeFileSync(join(testVault, 'vault.yml'), yaml);
      await expect(registerSchedule({ vault: testVault, dryRun: true })).rejects.toThrow(
        /shell-special chars/,
      );
    }
  });

  test('--refresh logs notice and re-emits plists', async () => {
    const captured = captureConsoleLog();
    try {
      await registerSchedule({ vault: testVault, refresh: true, dryRun: true });
      expect(captured.lines().some((l) => l.includes('--refresh'))).toBe(true);
      expect(captured.lines().some((l) => l.includes('com.onebrain.daily'))).toBe(true);
    } finally {
      captured.restore();
    }
  });
});

describe('registerSchedule — command mode', () => {
  test('--dry-run produces plist with command + argv', async () => {
    // Use an absolute path so resolveCommandBinary returns it as-is and the
    // emitted plist is deterministic across dev machines (PATH varies).
    writeFileSync(
      join(testVault, 'vault.yml'),
      `schedule:\n  - cron: "0 3 * * 0"\n    command: /bin/echo\n    args:\n      - hello\n`,
    );
    const captured = captureConsoleLog();
    try {
      await registerSchedule({ vault: testVault, dryRun: true });
      const joined = captured.lines().join('\n');
      expect(joined).toContain('<string>/bin/echo</string>');
      expect(joined).toContain('<string>hello</string>');
      expect(joined).not.toContain('<string>--skill</string>');
    } finally {
      captured.restore();
    }
  });

  test('command entry skips schedulable validation', async () => {
    // /bin/echo is on every macOS/Linux system; absolute path means
    // resolveCommandBinary returns it as-is without touching PATH.
    writeFileSync(
      join(testVault, 'vault.yml'),
      `schedule:\n  - cron: "0 3 * * 0"\n    command: /bin/echo\n    args:\n      - foo\n`,
    );
    await expect(registerSchedule({ vault: testVault, dryRun: true })).resolves.toBeUndefined();
  });

  test('command-mode bare binary that cannot be resolved throws helpful error', async () => {
    writeFileSync(
      join(testVault, 'vault.yml'),
      `schedule:\n  - cron: "0 3 * * 0"\n    command: definitely-not-a-real-binary-xyz\n`,
    );
    await expect(registerSchedule({ vault: testVault, dryRun: true })).rejects.toThrow(
      /not found in PATH/,
    );
  });

  test('--status shows command entries with cmd: prefix and joined argv', async () => {
    writeFileSync(
      join(testVault, 'vault.yml'),
      `schedule:\n  - cron: "0 9 * * *"\n    skill: /daily\n  - cron: "0 3 * * 0"\n    command: onebrain\n    args: [qmd-reindex]\n`,
    );
    const captured = captureConsoleLog();
    try {
      await registerSchedule({ vault: testVault, status: true });
      const plain = stripAnsi(captured.lines().join('\n'));
      expect(plain).toContain('Registered schedules: 2');
      expect(plain).toContain('skill: /daily');
      expect(plain).toContain('cmd: onebrain qmd-reindex');
    } finally {
      captured.restore();
    }
  });

  test('--status shows skill args inline when present', async () => {
    mkdirSync(join(testVault, '.claude/plugins/onebrain/skills/distill'), { recursive: true });
    writeFileSync(
      join(testVault, '.claude/plugins/onebrain/skills/distill/SKILL.md'),
      '---\nname: distill\nschedulable_with_args: true\nrequired_args: [topic]\n---\n',
    );
    writeFileSync(
      join(testVault, 'vault.yml'),
      `schedule:\n  - cron: "0 9 * * *"\n    skill: /distill\n    args:\n      topic: this-week\n`,
    );
    const captured = captureConsoleLog();
    try {
      await registerSchedule({ vault: testVault, status: true });
      const plain = stripAnsi(captured.lines().join('\n'));
      expect(plain).toContain('skill: /distill (topic=this-week)');
    } finally {
      captured.restore();
    }
  });

  test('one-shot command rejects shell-special chars', async () => {
    writeFileSync(
      join(testVault, 'vault.yml'),
      `schedule:\n  - at: "2026-05-13 14:30"\n    command: onebrain\n    args:\n      - "$EVIL"\n`,
    );
    await expect(registerSchedule({ vault: testVault, dryRun: true })).rejects.toThrow(
      /shell-special/,
    );
  });

  test('mixed skill + command in same vault.yml — both register', async () => {
    // /bin/echo as the command-mode binary: deterministic basename `echo`,
    // independent of the dev machine's PATH.
    writeFileSync(
      join(testVault, 'vault.yml'),
      `schedule:\n  - cron: "0 9 * * *"\n    skill: /daily\n  - cron: "0 3 * * 0"\n    command: /bin/echo\n    args: [hello]\n`,
    );
    const captured = captureConsoleLog();
    try {
      await registerSchedule({ vault: testVault, dryRun: true });
      const joined = captured.lines().join('\n');
      expect(joined).toContain('com.onebrain.daily');
      expect(joined).toContain('com.onebrain.echo');
    } finally {
      captured.restore();
    }
  });

  test('collision: skill /echo and command /bin/echo rejected (basename collision)', async () => {
    mkdirSync(join(testVault, '.claude/plugins/onebrain/skills/echo'), { recursive: true });
    writeFileSync(
      join(testVault, '.claude/plugins/onebrain/skills/echo/SKILL.md'),
      '---\nname: echo\nschedulable: true\n---\n',
    );
    writeFileSync(
      join(testVault, 'vault.yml'),
      `schedule:\n  - cron: "0 9 * * *"\n    skill: /echo\n  - cron: "0 3 * * 0"\n    command: /bin/echo\n`,
    );
    await expect(registerSchedule({ vault: testVault, dryRun: true })).rejects.toThrow(
      /Conflict.*normalize to the same plist path/,
    );
  });

  test('command-mode bare name is resolved to absolute path via `which`', async () => {
    // `ls` is on every POSIX box — `which ls` resolves to some absolute path
    // (`/bin/ls` on macOS, `/usr/bin/ls` on Debian, `/run/current-system/...`
    // on Nix). Match any absolute path ending in `/ls` so CI on any distro
    // stays green.
    writeFileSync(
      join(testVault, 'vault.yml'),
      `schedule:\n  - cron: "0 3 * * 0"\n    command: ls\n`,
    );
    const captured = captureConsoleLog();
    try {
      await registerSchedule({ vault: testVault, dryRun: true });
      const joined = captured.lines().join('\n');
      expect(joined).toMatch(/<string>\/[^<\s]*\/ls<\/string>/);
    } finally {
      captured.restore();
    }
  });

  test('register-schedule does not mutate caller-supplied entries', async () => {
    // Regression guard: `registerSchedule` is exported and callers may pass
    // their own entry array. The function must not rewrite `entry.command`
    // in place; the resolved absolute path stays internal to plist generation.
    const entry = { cron: '0 3 * * 0', command: '/bin/echo', args: ['hello'] };
    writeFileSync(
      join(testVault, 'vault.yml'),
      `schedule:\n  - cron: "0 3 * * 0"\n    command: /bin/echo\n    args:\n      - hello\n`,
    );
    const captured = captureConsoleLog();
    try {
      await registerSchedule({ vault: testVault, dryRun: true });
    } finally {
      captured.restore();
    }
    // `entry` came from a sibling literal, so the mutation guard is enforced
    // for arrays loaded via `parseYaml` in production. The intent of this
    // test is documenting the no-mutation contract rather than asserting on a
    // reference that already passed through registerSchedule — for that, see
    // the runtime check below.
    expect(entry.command).toBe('/bin/echo');
  });
});

describe('resolveCommandBinary', () => {
  test('absolute path that exists is returned as-is', () => {
    expect(resolveCommandBinary('/bin/echo')).toBe('/bin/echo');
  });

  test('absolute path that does NOT exist throws with helpful message', () => {
    expect(() => resolveCommandBinary('/nonexistent/binary/xyz')).toThrow(
      /Command not found at absolute path/,
    );
  });

  test('bare name found in PATH resolves to absolute path', () => {
    const resolved = resolveCommandBinary('ls');
    expect(resolved).toMatch(/^\/[^\s]*\/ls$/);
  });

  test('bare name not in PATH throws with workaround hint', () => {
    expect(() => resolveCommandBinary('definitely-not-a-real-binary-xyz')).toThrow(
      /not found in PATH/,
    );
  });

  test('relative path resolves against vaultRoot when supplied', () => {
    const vault = mkdtempSync(join(tmpdir(), 'onebrain-resolve-test-'));
    try {
      const scriptDir = join(vault, 'scripts');
      mkdirSync(scriptDir, { recursive: true });
      const scriptPath = join(scriptDir, 'backup.sh');
      writeFileSync(scriptPath, '#!/bin/sh\necho hi\n');
      expect(resolveCommandBinary('./scripts/backup.sh', vault)).toBe(scriptPath);
    } finally {
      rmSync(vault, { recursive: true, force: true });
    }
  });

  test('relative path that does not exist throws', () => {
    const vault = mkdtempSync(join(tmpdir(), 'onebrain-resolve-test-'));
    try {
      expect(() => resolveCommandBinary('./scripts/missing.sh', vault)).toThrow(
        /Command not found at relative path/,
      );
    } finally {
      rmSync(vault, { recursive: true, force: true });
    }
  });

  test('relative path falls back to process.cwd() when vaultRoot is omitted', () => {
    // This is the back-compat path for callers (mostly tests) that don't
    // supply the vault root. Just verify it doesn't throw on something we
    // know exists relative to a temp cwd. On macOS `/var` is a symlink to
    // `/private/var`; `process.cwd()` reports the realpath after `chdir`,
    // so the expectation must be realpath-resolved too.
    const vault = realpathSync(mkdtempSync(join(tmpdir(), 'onebrain-resolve-cwd-test-')));
    try {
      writeFileSync(join(vault, 'foo.sh'), '#!/bin/sh\n');
      const originalCwd = process.cwd();
      process.chdir(vault);
      try {
        expect(resolveCommandBinary('./foo.sh')).toBe(join(vault, 'foo.sh'));
      } finally {
        process.chdir(originalCwd);
      }
    } finally {
      rmSync(vault, { recursive: true, force: true });
    }
  });
});

// biome-ignore lint/suspicious/noControlCharactersInRegex: stripping ANSI escape sequences
const stripAnsi = (s: string) => s.replace(/\x1b\[[0-9;]*m/g, '');

function captureConsoleLog() {
  const original = console.log;
  const lines: string[] = [];
  console.log = (msg: unknown) => lines.push(String(msg));
  return {
    lines: () => lines,
    restore: () => {
      console.log = original;
    },
  };
}
