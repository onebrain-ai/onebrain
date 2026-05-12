export interface ScheduleEntry {
  cron: string;
  skill: string;
  args?: Record<string, string>;
}

export interface ScheduleConfig {
  schedule?: ScheduleEntry[];
}

export interface SkillFrontmatter {
  name: string;
  schedulable?: boolean;
  schedulable_with_args?: boolean;
  required_args?: string[];
}
