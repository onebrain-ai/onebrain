import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import type { spawn as nodeSpawn } from 'node:child_process';
import { EventEmitter } from 'node:events';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildPrompt, runSkillCommand } from './run-skill.js';

// runSkillCommand only consumes `child.on('exit' | 'error', ...)`. Casting the
// EventEmitter through `unknown` to the spawn signature lets us keep test
// mocks focused on event emission without modelling stdio streams.
// biome-ignore lint/suspicious/noExplicitAny: deliberate spawn test seam
type SpawnLike = (...args: any[]) => unknown;
const asSpawn = (fn: SpawnLike) => fn as unknown as typeof nodeSpawn;

describe('buildPrompt', () => {
  test('namespaces bare skill name under onebrain plugin', () => {
    expect(buildPrompt('/daily')).toBe('/onebrain:daily');
  });

  test('namespaces when leading slash is omitted', () => {
    expect(buildPrompt('daily')).toBe('/onebrain:daily');
  });

  test('preserves an explicit namespace prefix', () => {
    expect(buildPrompt('/other-plugin:foo')).toBe('/other-plugin:foo');
    expect(buildPrompt('onebrain:weekly')).toBe('/onebrain:weekly');
  });

  test('appends args as key=value tokens', () => {
    expect(buildPrompt('/distill', { topic: 'this-week' })).toBe(
      '/onebrain:distill topic=this-week',
    );
  });

  test('preserves arg insertion order', () => {
    // Object.entries preserves insertion order for string keys, so the
    // prompt is deterministic across runs and the test can assert exact text.
    expect(buildPrompt('/echo', { first: '1', second: '2', third: '3' })).toBe(
      '/onebrain:echo first=1 second=2 third=3',
    );
  });

  test('empty args object returns bare slash command', () => {
    expect(buildPrompt('/daily', {})).toBe('/onebrain:daily');
  });
});

// Minimal mock for ChildProcess — only needs the event surface that
// runSkillCommand uses. We don't model stdio streams (the production code
// uses `stdio: 'inherit'` and never touches `.stdin`/`.stdout`).
function makeMockChild(): EventEmitter {
  return new EventEmitter();
}

describe('runSkillCommand', () => {
  let testVault: string;

  beforeEach(() => {
    testVault = mkdtempSync(join(tmpdir(), 'onebrain-run-skill-test-'));
    writeFileSync(join(testVault, 'vault.yml'), 'folders:\n  inbox: 00-inbox\n');
  });

  afterEach(() => rmSync(testVault, { recursive: true, force: true }));

  test('rejects when vault.yml is missing', async () => {
    const bogusVault = join(testVault, 'does-not-exist');
    const code = await runSkillCommand({
      vault: bogusVault,
      skill: '/daily',
      claudeBin: '/bin/true',
      spawnFn: asSpawn(() => makeMockChild()),
    });
    expect(code).toBe(78); // EX_CONFIG
  });

  test('spawns claudeBin with -p prompt + --add-dir vault', async () => {
    let recordedBin = '';
    let recordedArgs: readonly string[] = [];
    let recordedCwd: string | undefined;

    const fakeSpawn = asSpawn((bin: string, args: readonly string[], opts: { cwd?: string }) => {
      recordedBin = bin;
      recordedArgs = args;
      recordedCwd = opts.cwd;
      const child = makeMockChild();
      setImmediate(() => child.emit('exit', 0, null));
      return child;
    });

    const code = await runSkillCommand({
      vault: testVault,
      skill: '/daily',
      claudeBin: '/bin/true',
      spawnFn: fakeSpawn,
    });

    expect(code).toBe(0);
    expect(recordedBin).toBe('/bin/true');
    expect(recordedArgs).toEqual(['-p', '/onebrain:daily', '--add-dir', testVault]);
    expect(recordedCwd).toBe(testVault);
  });

  test('args are appended to the prompt as key=value tokens', async () => {
    let recordedPrompt = '';
    const fakeSpawn = asSpawn((_bin: string, args: readonly string[]) => {
      // args = ['-p', '<prompt>', '--add-dir', '<vault>']
      recordedPrompt = args[1] ?? '';
      const child = makeMockChild();
      setImmediate(() => child.emit('exit', 0, null));
      return child;
    });

    await runSkillCommand({
      vault: testVault,
      skill: '/distill',
      args: { topic: 'this-week' },
      claudeBin: '/bin/true',
      spawnFn: fakeSpawn,
    });

    expect(recordedPrompt).toBe('/onebrain:distill topic=this-week');
  });

  test('propagates child exit code', async () => {
    const fakeSpawn = asSpawn(() => {
      const child = makeMockChild();
      setImmediate(() => child.emit('exit', 42, null));
      return child;
    });

    const code = await runSkillCommand({
      vault: testVault,
      skill: '/daily',
      claudeBin: '/bin/true',
      spawnFn: fakeSpawn,
    });
    expect(code).toBe(42);
  });

  test('maps signal termination to POSIX-conventional 128 + signal number', async () => {
    const fakeSpawn = asSpawn(() => {
      const child = makeMockChild();
      setImmediate(() => child.emit('exit', null, 'SIGTERM'));
      return child;
    });

    const code = await runSkillCommand({
      vault: testVault,
      skill: '/daily',
      claudeBin: '/bin/true',
      spawnFn: fakeSpawn,
    });
    // SIGTERM = signal 15 on POSIX → exit 143. Resolves to a distinct value
    // so `/doctor` and humans can tell signals apart (vs the flat-128 collapse
    // before this fix).
    expect(code).toBe(143);
  });

  test('SIGKILL maps to 137 (POSIX 128 + 9)', async () => {
    const fakeSpawn = asSpawn(() => {
      const child = makeMockChild();
      setImmediate(() => child.emit('exit', null, 'SIGKILL'));
      return child;
    });
    const code = await runSkillCommand({
      vault: testVault,
      skill: '/daily',
      claudeBin: '/bin/true',
      spawnFn: fakeSpawn,
    });
    expect(code).toBe(137);
  });

  test('maps spawn error to exit 127', async () => {
    const fakeSpawn = asSpawn(() => {
      const child = makeMockChild();
      setImmediate(() => child.emit('error', new Error('ENOENT')));
      return child;
    });

    const code = await runSkillCommand({
      vault: testVault,
      skill: '/daily',
      claudeBin: '/bin/true',
      spawnFn: fakeSpawn,
    });
    expect(code).toBe(127);
  });

  test('does not override parent env — child inherits PATH naturally', async () => {
    let recordedEnv: NodeJS.ProcessEnv | undefined;
    const fakeSpawn = asSpawn(
      (_bin: string, _args: readonly string[], opts: { env?: NodeJS.ProcessEnv }) => {
        recordedEnv = opts.env;
        const child = makeMockChild();
        setImmediate(() => child.emit('exit', 0, null));
        return child;
      },
    );

    await runSkillCommand({
      vault: testVault,
      skill: '/daily',
      claudeBin: '/bin/true',
      spawnFn: fakeSpawn,
    });

    // We deliberately don't pass `env` — the spawn defaults to the parent env,
    // so PATH/HOME/etc. survive without explicit allowlisting. Regression
    // guard: if someone reintroduces `env: { ... }` and forgets to spread
    // `process.env`, child PATH would collapse and break Homebrew lookups.
    expect(recordedEnv).toBeUndefined();
  });

  test('throws on empty skill name', async () => {
    await expect(
      runSkillCommand({
        vault: testVault,
        skill: '/',
        claudeBin: '/bin/true',
        spawnFn: asSpawn(() => makeMockChild()),
      }),
    ).rejects.toThrow(/skill name must not be empty/);
  });

  test('honors CLAUDE_BIN env override when path exists', async () => {
    const originalBin = process.env['CLAUDE_BIN'];
    process.env['CLAUDE_BIN'] = '/bin/sh'; // exists on every POSIX box
    try {
      let recordedBin = '';
      const fakeSpawn = asSpawn((bin: string) => {
        recordedBin = bin;
        const child = makeMockChild();
        setImmediate(() => child.emit('exit', 0, null));
        return child;
      });
      await runSkillCommand({
        vault: testVault,
        skill: '/daily',
        // No explicit claudeBin — forces the resolver to consult CLAUDE_BIN.
        spawnFn: fakeSpawn,
      });
      expect(recordedBin).toBe('/bin/sh');
    } finally {
      if (originalBin === undefined) {
        // biome-ignore lint/performance/noDelete: env-var teardown needs true removal, not undefined-assignment
        delete process.env['CLAUDE_BIN'];
      } else process.env['CLAUDE_BIN'] = originalBin;
    }
  });

  test('warns + falls through when CLAUDE_BIN points to a missing path', async () => {
    const originalBin = process.env['CLAUDE_BIN'];
    process.env['CLAUDE_BIN'] = '/definitely/not/a/real/binary/xyz';
    const originalErr = console.error;
    let warned = false;
    console.error = (msg: unknown) => {
      if (String(msg).includes('CLAUDE_BIN points to a missing file')) warned = true;
    };
    try {
      let recordedBin = '';
      const fakeSpawn = asSpawn((bin: string) => {
        recordedBin = bin;
        const child = makeMockChild();
        setImmediate(() => child.emit('exit', 0, null));
        return child;
      });
      await runSkillCommand({
        vault: testVault,
        skill: '/daily',
        spawnFn: fakeSpawn,
      });
      expect(warned).toBe(true);
      // Falls through to fallback list or bare `claude` — either way, NOT
      // the bogus CLAUDE_BIN value.
      expect(recordedBin).not.toBe('/definitely/not/a/real/binary/xyz');
    } finally {
      if (originalBin === undefined) {
        // biome-ignore lint/performance/noDelete: env-var teardown needs true removal, not undefined-assignment
        delete process.env['CLAUDE_BIN'];
      } else process.env['CLAUDE_BIN'] = originalBin;
      console.error = originalErr;
    }
  });
});
