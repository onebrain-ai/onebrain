import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { readFile, unlink, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { isAbsolute, join, resolve as pathResolve } from 'node:path';
import pc from 'picocolors';
import { parse as parseYaml } from 'yaml';
import { validateAt, validateCron } from '../lib/scheduler/cron-parse.js';
import { isCommandMode, isOneShot, isSkillMode, validateEntry } from '../lib/scheduler/entry.js';
import { generatePlist, labelForEntry, plistPath } from '../lib/scheduler/launchd.js';
import type { ScheduleConfig, ScheduleEntry, SkillFrontmatter } from '../lib/scheduler/types.js';

export interface RegisterScheduleOptions {
  vault: string;
  dryRun?: boolean;
  remove?: boolean;
  refresh?: boolean;
  resume?: string;
  status?: boolean;
  test?: string;
}

export async function registerSchedule(opts: RegisterScheduleOptions): Promise<void> {
  if (opts.remove) return await removeAll(opts.vault);
  if (opts.status) return await printStatus(opts.vault);
  if (opts.test) return await testRun(opts.vault, opts.test);
  if (opts.resume) return await resumeSkill(opts.vault, opts.resume);

  if (opts.refresh) {
    console.log(pc.dim('(--refresh: re-emitting plists with current vault path)'));
  }

  const config = await readVaultConfig(opts.vault);
  const entries = config.schedule ?? [];

  if (entries.length === 0) {
    console.log(pc.yellow('No schedule entries in vault.yml. Nothing to register.'));
    return;
  }

  // Validate each entry (exactly-one-of cron/at + skill/command, plus format
  // checks). This pass does NOT mutate input — `registerSchedule` is exported,
  // and a caller-supplied entry array must round-trip unchanged.
  for (const entry of entries) {
    const ve = validateEntry(entry);
    if (!ve.valid) throw new Error(`Invalid schedule entry: ${ve.reason}`);

    if (isOneShot(entry)) {
      const va = validateAt(entry.at);
      if (!va.valid) throw new Error(`Invalid at "${entry.at}": ${va.reason}`);
      sanitizeArgsForOneShot(entry);
    } else if (entry.cron !== undefined) {
      const vc = validateCron(entry.cron);
      if (!vc.valid) throw new Error(`Invalid cron "${entry.cron}": ${vc.reason}`);
    }

    if (isSkillMode(entry)) {
      await validateSchedulable(opts.vault, entry);
    }
    // Command mode: binary resolution happens below when we build the
    // launchd-bound entries (so the original `entry.command` stays
    // user-friendly for status/collision reporting).
  }

  // Build the list of entries that actually flow into the plist generator:
  // command-mode entries are shallow-cloned with `command` rewritten to an
  // absolute path so launchd's restricted PATH can find the binary.
  const resolvedEntries: ScheduleEntry[] = entries.map((entry) =>
    isCommandMode(entry)
      ? { ...entry, command: resolveCommandBinary(entry.command as string, opts.vault) }
      : entry,
  );

  // The skill-mode plist invokes `<onebrain> run-skill --vault X --skill /name`.
  // process.argv[1] is the running onebrain script — in production this is the
  // Bun-compiled binary at an absolute path that launchd can exec. In dev
  // (`bun run src/index.ts`), argv[1] is a `.ts` source path that launchd
  // can't exec — that case will surface via the planned `/doctor` stale-plist
  // check rather than blocking `--dry-run` here (which would break CI/test
  // runs where global `onebrain` isn't installed). The `?? 'onebrain'`
  // fallback covers the very-rare case where argv[1] is undefined.
  const skillCliPath = process.argv[1] ?? 'onebrain';

  const ctx = {
    vaultPath: opts.vault,
    skillCliPath,
    // TODO: read folders.logs from vault.yml instead of hardcoding '07-logs'
    // — for vaults using a non-default logs folder. Tracked for follow-up.
    logBasePath: join(opts.vault, '07-logs/scheduler'),
    // process.getuid is undefined on Windows; fall back to 501 (default macOS UID).
    // TODO: surface an error if running on a non-POSIX platform where getuid is absent.
    uid: process.getuid?.() ?? 501,
    homedir: homedir(),
  };

  // Collision detection: two entries normalizing to the same plist path
  // conflict. Use `resolvedEntries` so the basename-driven label sees the
  // already-resolved command name.
  const seen = new Map<string, ScheduleEntry>();
  for (const entry of resolvedEntries) {
    const target = plistPath(labelForEntry(entry), ctx.homedir);
    if (seen.has(target)) {
      const existing = seen.get(target);
      if (existing) {
        const existingLabel = isCommandMode(existing)
          ? `command:${existing.command}`
          : `skill:${existing.skill}`;
        const newLabel = isCommandMode(entry) ? `command:${entry.command}` : `skill:${entry.skill}`;
        throw new Error(
          `Conflict: ${newLabel} and ${existingLabel} normalize to the same plist path ${target}`,
        );
      }
    }
    seen.set(target, entry);
  }

  for (const entry of resolvedEntries) {
    const plistContent = generatePlist(entry, ctx);
    const targetPath = plistPath(labelForEntry(entry), ctx.homedir);

    if (opts.dryRun) {
      console.log(pc.cyan(`---  ${targetPath}  ---`));
      console.log(plistContent);
      continue;
    }

    await writeFile(targetPath, plistContent, 'utf8');
    console.log(pc.green(`✓ Wrote ${targetPath}`));
  }

  console.log(pc.green(`\nRegistered ${entries.length} schedule entries.`));
  console.log(pc.dim('Use launchctl to load (or restart launchd):'));
  for (const entry of resolvedEntries) {
    const target = plistPath(labelForEntry(entry), ctx.homedir);
    console.log(pc.dim(`  launchctl load ${target}`));
  }
}

async function readVaultConfig(vault: string): Promise<ScheduleConfig> {
  const yamlPath = join(vault, 'vault.yml');
  if (!existsSync(yamlPath)) return {};
  const raw = await readFile(yamlPath, 'utf8');
  return (parseYaml(raw) ?? {}) as ScheduleConfig;
}

function sanitizeArgsForOneShot(entry: ScheduleEntry): void {
  const values: string[] = isCommandMode(entry)
    ? ((entry.args as string[] | undefined) ?? [])
    : Object.values((entry.args as Record<string, string> | undefined) ?? {});
  for (const v of values) {
    if (/["$`\\]/.test(v)) {
      throw new Error(`Arg value must not contain shell-special chars (", $, \`, \\): ${v}`);
    }
  }
}

async function validateSchedulable(vault: string, entry: ScheduleEntry): Promise<void> {
  if (!entry.skill) {
    throw new Error('validateSchedulable invoked on non-skill entry — caller bug');
  }
  const skillName = entry.skill.replace(/^\//, '');
  const skillPath = join(vault, '.claude/plugins/onebrain/skills', skillName, 'SKILL.md');
  if (!existsSync(skillPath)) {
    throw new Error(`Skill ${entry.skill} not found at ${skillPath}`);
  }
  const raw = await readFile(skillPath, 'utf8');
  const match = raw.match(/^---\n([\s\S]*?)\n---/);
  if (!match) {
    throw new Error(`Skill ${entry.skill} has no YAML frontmatter`);
  }
  // biome-ignore lint/style/noNonNullAssertion: regex has a capture group; match[1] is present when match is non-null
  const fm = parseYaml(match[1]!) as SkillFrontmatter;

  if (fm.schedulable === false) {
    throw new Error(`Skill ${entry.skill} requires user input — cannot schedule`);
  }
  if (fm.schedulable_with_args) {
    const required = fm.required_args ?? [];
    const provided = Object.keys((entry.args as Record<string, string> | undefined) ?? {});
    const missing = required.filter((r) => !provided.includes(r));
    if (missing.length > 0) {
      throw new Error(`Skill ${entry.skill} requires args: [${missing.join(', ')}]`);
    }
  } else if (!fm.schedulable) {
    throw new Error(`Skill ${entry.skill} does not declare schedulable: true in frontmatter`);
  }

  // Reject shell-special chars in args values for recurring skill mode: the plist generator
  // embeds arg values as --key=value strings inside a sh -c "..." wrapper. One-shot entries
  // are checked earlier by sanitizeArgsForOneShot before generatePlist is called.
  if (entry.args) {
    for (const [k, v] of Object.entries(entry.args as Record<string, string>)) {
      if (/["$`\\]/.test(v)) {
        throw new Error(
          `Arg "${k}" value must not contain shell-special chars (", $, \`, \\): ${v}`,
        );
      }
    }
  }
}

async function removeAll(vault: string): Promise<void> {
  const config = await readVaultConfig(vault);
  const entries = config.schedule ?? [];
  for (const entry of entries) {
    const target = plistPath(labelForEntry(entry), homedir());
    if (existsSync(target)) {
      await unlink(target);
      console.log(pc.green(`✓ Removed ${target}`));
    }
  }
}

async function printStatus(vault: string): Promise<void> {
  const config = await readVaultConfig(vault);
  const entries = config.schedule ?? [];
  console.log(pc.cyan(`Registered schedules: ${entries.length}`));
  for (const entry of entries) {
    const target = plistPath(labelForEntry(entry), homedir());
    const installed = existsSync(target) ? '✓' : '✗';
    const when = entry.at ?? entry.cron ?? '?';
    const tag = entry.at ? pc.magenta('[once]') : pc.dim('[cron]');

    let targetLabel: string;
    if (isCommandMode(entry)) {
      const argv = (entry.args as string[] | undefined) ?? [];
      const argStr = argv.length ? ` ${argv.join(' ')}` : '';
      targetLabel = `${pc.yellow('cmd:')} ${entry.command}${argStr}`;
    } else {
      const argsMap = (entry.args as Record<string, string> | undefined) ?? {};
      const argStr = Object.keys(argsMap).length
        ? ` (${Object.entries(argsMap)
            .map(([k, v]) => `${k}=${v}`)
            .join(', ')})`
        : '';
      targetLabel = `${pc.green('skill:')} ${entry.skill}${argStr}`;
    }
    console.log(`  ${installed} ${tag} ${when}  ${targetLabel}`);
  }
}

async function testRun(vault: string, skill: string): Promise<void> {
  console.log(pc.cyan(`Testing scheduled invocation of ${skill}...`));
  console.log(pc.dim('(Spawns `onebrain run-skill` which shells out to Claude Code.)'));
  const { runSkillCommand } = await import('./run-skill.js');
  const code = await runSkillCommand({ vault, skill });
  if (code !== 0) {
    console.error(pc.red(`Test run exited with code ${code}`));
    process.exit(code);
  }
}

// `which` works on every POSIX system we support; macOS ships `/usr/bin/which`
// and Linux ships it via debianutils or coreutils. Hard-coding `/usr/bin/which`
// keeps the binary lookup itself out of PATH (which is exactly the problem
// we're trying to solve here).
const WHICH_BIN = '/usr/bin/which';

/**
 * Resolve a command-mode binary name to an absolute path. launchd's
 * ProgramArguments[0] needs to be findable in launchd's restricted PATH
 * (`/usr/bin:/bin:/usr/sbin:/sbin`), which excludes Homebrew, Bun, and
 * ~/.local/bin prefixes. Users keep the friendly `command: onebrain` form
 * in vault.yml; this returns the absolute path that goes into the plist.
 *
 * @param name  Binary name or path from `vault.yml` `command:`
 * @param vaultRoot  Vault root directory — relative paths (`./foo`) resolve
 *                   against this, not the caller's `process.cwd()`, so
 *                   running `onebrain register-schedule` from anywhere
 *                   produces the same plist content.
 *
 * Behavior:
 * - Absolute path → checked for existence, returned as-is (so a typo in
 *   vault.yml fails at register time, not silently at run time)
 * - Relative path (`./foo`, `../foo`) → resolved against `vaultRoot`,
 *   existence-checked
 * - Bare name → looked up via `/usr/bin/which` against the caller's PATH
 *
 * Throws on miss so the failure surfaces at register time rather than at
 * run time (when launchd would silently exit ENOENT with no stderr).
 */
export function resolveCommandBinary(name: string, vaultRoot?: string): string {
  if (isAbsolute(name)) {
    if (!existsSync(name)) {
      throw new Error(
        `Command not found at absolute path: ${name}. Check the path in vault.yml — launchd will silently fail at run time if the binary is missing.`,
      );
    }
    return name;
  }
  if (name.startsWith('./') || name.startsWith('../')) {
    // Resolve relative to the vault root when supplied; otherwise fall back
    // to process.cwd() for callers that didn't pass it (e.g. unit tests).
    const base = vaultRoot ?? process.cwd();
    const resolved = pathResolve(base, name);
    if (!existsSync(resolved)) {
      throw new Error(`Command not found at relative path: ${name} (resolved: ${resolved})`);
    }
    return resolved;
  }
  try {
    // execFileSync with argv array is shell-injection-safe — `name` is a
    // single positional arg, never interpreted by /bin/sh.
    const out = execFileSync(WHICH_BIN, [name], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    if (out && existsSync(out)) return out;
  } catch {
    // `which` exits non-zero when not found — fall through to throw below.
  }
  throw new Error(
    `Command "${name}" not found in PATH. Use an absolute path in vault.yml (launchd's PATH is restricted to /usr/bin:/bin:/usr/sbin:/sbin and won't find ${name}).`,
  );
}

async function resumeSkill(vault: string, skill: string): Promise<void> {
  // TODO: read folders.logs from vault.yml instead of hardcoding '07-logs'
  // — for vaults using a non-default logs folder. Tracked for follow-up.
  const marker = join(vault, '07-logs/scheduler/.paused', `${skill.replace(/^\//, '')}.txt`);
  if (existsSync(marker)) {
    await unlink(marker);
    console.log(pc.green(`✓ Resumed ${skill}`));
  } else {
    console.log(pc.yellow(`${skill} is not paused.`));
  }
}
