export function schedulerLogPath(
  logsFolder: string,
  date: Date,
  skill: string,
  isError: boolean,
): string {
  const yyyy = date.getFullYear().toString();
  const mm = (date.getMonth() + 1).toString().padStart(2, '0');
  const dd = date.getDate().toString().padStart(2, '0');
  const skillSafe = skill.replace(/^\//, '');
  const suffix = isError ? '.err.md' : '.md';
  return `${logsFolder}/scheduler/${yyyy}/${mm}/${yyyy}-${mm}-${dd}-${skillSafe}${suffix}`;
}
