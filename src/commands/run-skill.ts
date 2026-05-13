import { type SpawnOptions, spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { constants as osConstants } from 'node:os';
import { join } from 'node:path';
import pc from 'picocolors';

export interface RunSkillOptions {
  vault: string;
  skill: string;
  args?: Record<string, string>;
  // Test seams — production callers omit these
  claudeBin?: string;
  spawnFn?: typeof spawn;
}

const HOME = process.env['HOME'] ?? '';

// launchd jobs inherit `/usr/bin:/bin:/usr/sbin:/sbin`, which excludes the
// directories where `claude` is typically installed. Probe known prefixes
// before falling back to bare `claude` (PATH lookup) so the scheduler works
// out-of-the-box without env tweaks.
const CLAUDE_FALLBACK_PATHS: string[] = [
  ...(HOME ? [join(HOME, '.local/bin/claude')] : []),
  '/opt/homebrew/bin/claude',
  '/usr/local/bin/claude',
];

function resolveClaudeBin(override?: string): string {
  // Explicit caller override (used by tests for dependency injection) is
  // trusted as-is; production callers omit this argument.
  if (override) return override;
  const fromEnv = process.env['CLAUDE_BIN'];
  if (fromEnv) {
    if (existsSync(fromEnv)) return fromEnv;
    // Surface typos rather than silently falling through — a missing
    // CLAUDE_BIN override is almost always user intent + path mistake, not
    // "please probe the fallback list."
    console.error(
      pc.yellow(`CLAUDE_BIN points to a missing file: ${fromEnv} — ignoring and probing defaults`),
    );
  }
  for (const candidate of CLAUDE_FALLBACK_PATHS) {
    if (existsSync(candidate)) return candidate;
  }
  return 'claude';
}

// Build the slash-command prompt for `claude -p`. Skill names are namespaced
// under the OneBrain plugin (`/onebrain:<name>`) so claude resolves them
// unambiguously even when other plugins ship a same-named command. Skill args
// become `key=value` tokens appended after the skill name — matching how
// Claude Code's slash-command ARGUMENTS slot receives positional arguments.
export function buildPrompt(skill: string, args?: Record<string, string>): string {
  // Normalize: strip leading slash so we can rebuild with the plugin namespace.
  const bare = skill.replace(/^\//, '');
  if (!bare) {
    throw new Error('skill name must not be empty (got "/" or "")');
  }
  // If the caller already namespaced (e.g. `/onebrain:daily` or `other:foo`),
  // preserve the namespace. Otherwise default to the OneBrain plugin.
  const namespaced = bare.includes(':') ? bare : `onebrain:${bare}`;
  const slash = `/${namespaced}`;
  if (!args) return slash;
  const tokens = Object.entries(args).map(([k, v]) => `${k}=${v}`);
  return tokens.length ? `${slash} ${tokens.join(' ')}` : slash;
}

export async function runSkillCommand(opts: RunSkillOptions): Promise<number> {
  const vault = opts.vault;

  if (!existsSync(join(vault, 'vault.yml'))) {
    console.error(pc.red(`Vault not found at ${vault} (no vault.yml present)`));
    return 78; // EX_CONFIG (sysexits.h)
  }

  const claudeBin = resolveClaudeBin(opts.claudeBin);
  const prompt = buildPrompt(opts.skill, opts.args);
  const spawnFn = opts.spawnFn ?? spawn;

  const spawnOpts: SpawnOptions = {
    cwd: vault,
    stdio: 'inherit',
  };

  const child = spawnFn(claudeBin, ['-p', prompt, '--add-dir', vault], spawnOpts);

  return await new Promise<number>((resolve) => {
    child.on('exit', (code, signal) => {
      if (signal) {
        console.error(pc.red(`claude terminated by signal: ${signal}`));
        // POSIX convention: 128 + signal number. Falls back to a flat 128
        // when the signal name isn't in the constants table (very rare).
        resolve(128 + signalNumber(signal));
        return;
      }
      resolve(code ?? 1);
    });
    child.on('error', (err) => {
      console.error(pc.red(`Failed to spawn claude (${claudeBin}): ${(err as Error).message}`));
      resolve(127);
    });
  });
}

function signalNumber(signal: NodeJS.Signals): number {
  const sigs = osConstants.signals as unknown as Record<string, number>;
  return sigs[signal] ?? 0;
}
