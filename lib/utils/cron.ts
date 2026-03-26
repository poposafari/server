export type CronField = number | string;

export interface CronScheduleOptions {
  minute?: CronField;
  hour?: CronField;
  dayOfMonth?: CronField;
  month?: CronField;
  dayOfWeek?: CronField;
}

export function cronSchedule(options: CronScheduleOptions = {}): string {
  const parts = [
    options.minute ?? '*',
    options.hour ?? '*',
    options.dayOfMonth ?? '*',
    options.month ?? '*',
    options.dayOfWeek ?? '*',
  ];
  return parts.map(String).join(' ');
}

/** 매분 */
export function everyMinute(): string {
  return cronSchedule();
}

/** N분마다 (1~59) */
export function everyMinutes(interval: number): string {
  if (interval < 1 || interval > 59) {
    throw new Error('everyMinutes: interval must be 1-59');
  }
  return cronSchedule({ minute: `*/${interval}` });
}

/** 매시 0분 */
export function everyHour(): string {
  return cronSchedule({ minute: 0 });
}

/** N시간마다 (1~23), 시 0분 */
export function everyHours(interval: number): string {
  if (interval < 1 || interval > 23) {
    throw new Error('everyHours: interval must be 1-23');
  }
  return cronSchedule({ minute: 0, hour: `*/${interval}` });
}

/** 매일 특정 시:분 (기본 0:00) */
export function daily(hour: number = 0, minute: number = 0): string {
  return cronSchedule({ minute, hour });
}
