import { EmbedBuilder } from 'discord.js';
import { TIMEZONE } from '../config.js';
import { getLogsLastNDays, getSettings, getTodayLog, updateSettings } from '../database/database.js';

const ESCAPE_VELOCITY_GOAL = 150;

export function buildProgressBar(filled, total, width = 10) {
  if (total <= 0) return '░'.repeat(width);
  const ratio = Math.min(filled / total, 1);
  const filledCount = Math.round(ratio * width);
  return '█'.repeat(filledCount) + '░'.repeat(width - filledCount);
}

export function isSunday(dateStr = null, tz = TIMEZONE) {
  const date = dateStr ? new Date(`${dateStr}T12:00:00`) : new Date();
  const weekday = new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'short' }).format(date);
  return weekday === 'Sun';
}

export function calcWeeklyAdherence(logs, field, successValues = ['FULL', 'LOW_POWER', 'CLEANED', 'SUCCESS']) {
  if (logs.length === 0) return 0;
  const relevant = logs.filter((log) => log[field] != null);
  if (relevant.length === 0) return 0;
  const hits = relevant.filter((log) => successValues.includes(log[field])).length;
  return Math.round((hits / relevant.length) * 100);
}

export function calcEscapeVelocity(logs) {
  const score = logs.reduce((sum, log) => {
    if (log.career_status === 'FULL') return sum + 2;
    if (log.career_status === 'LOW_POWER') return sum + 1;
    return sum;
  }, 0);
  const percent = Math.min(Math.round((score / ESCAPE_VELOCITY_GOAL) * 100), 100);
  return {
    score,
    goal: ESCAPE_VELOCITY_GOAL,
    percent,
    bar: buildProgressBar(score, ESCAPE_VELOCITY_GOAL, 15),
  };
}

export function formatStatusLabel(status) {
  const labels = {
    FULL: 'Full Session',
    LOW_POWER: 'Low-Power',
    SKIPPED: 'Skipped',
    CLEANED: 'Cleaned',
    SUCCESS: 'Yes',
  };
  return labels[status] ?? status;
}

export function auditViolations(todayLog, yesterdayLog, isSundayToday) {
  const violations = [];

  if (yesterdayLog) {
    for (const [field, col] of [
      ['career', 'career_status'],
      ['fitness', 'fitness_status'],
      ['cleanliness', 'cleanliness_status'],
    ]) {
      if (todayLog[col] === 'SKIPPED' && yesterdayLog[col] === 'SKIPPED') {
        violations.push(field);
      }
    }
  }

  if (isSundayToday && todayLog.social_status === 'SKIPPED') {
    if (!violations.includes('social')) violations.push('social');
  }

  return violations;
}

export function updateStreakAfterLog(log, isSundayToday) {
  const settings = getSettings();
  const skipped =
    log.career_status === 'SKIPPED' ||
    log.fitness_status === 'SKIPPED' ||
    log.cleanliness_status === 'SKIPPED' ||
    (isSundayToday && log.social_status === 'SKIPPED');

  if (skipped) {
    updateSettings({ consecutive_days_perfect: 0 });
    return;
  }

  let consecutive = settings.consecutive_days_perfect + 1;
  let shields = settings.streak_shields;

  if (consecutive >= 10) {
    shields = Math.min(shields + 1, 2);
    consecutive = 0;
  }

  updateSettings({ consecutive_days_perfect: consecutive, streak_shields: shields });
}

export function buildStatsMessage() {
  const logs = getLogsLastNDays(7);
  const settings = getSettings();
  const escape = calcEscapeVelocity(logs);

  const careerPct = calcWeeklyAdherence(logs, 'career_status', ['FULL', 'LOW_POWER']);
  const fitnessPct = calcWeeklyAdherence(logs, 'fitness_status', ['FULL', 'LOW_POWER']);
  const cleanlinessPct = calcWeeklyAdherence(logs, 'cleanliness_status', ['CLEANED']);

  const socialLogs = logs.filter((l) => l.social_status != null);
  const socialPct = socialLogs.length
    ? Math.round((socialLogs.filter((l) => l.social_status === 'SUCCESS').length / socialLogs.length) * 100)
    : null;

  let text = `**Weekly Stats (Last 7 Days)**\n\n`;
  text += `💻 Career: ${careerPct}% ${buildProgressBar(careerPct, 100, 8)}\n`;
  text += `🏋️ Fitness: ${fitnessPct}% ${buildProgressBar(fitnessPct, 100, 8)}\n`;
  text += `🧹 Cleanliness: ${cleanlinessPct}% ${buildProgressBar(cleanlinessPct, 100, 8)}\n`;
  if (socialPct !== null) text += `🗽 Social: ${socialPct}% ${buildProgressBar(socialPct, 100, 8)}\n`;

  text += `\n**JPMC Escape Velocity**\n`;
  text += `${escape.bar} ${escape.score}/${escape.goal} (${escape.percent}%)\n\n`;
  text += `🛡️ Streak Shields: ${settings.streak_shields}/2\n`;
  text += `🔥 Perfect Day Streak: ${settings.consecutive_days_perfect}/10`;

  return text;
}

export function buildWeeklyReportEmbed() {
  const logs = getLogsLastNDays(7);
  const settings = getSettings();
  const escape = calcEscapeVelocity(logs);
  const todayLog = getTodayLog();

  const careerPct = calcWeeklyAdherence(logs, 'career_status', ['FULL', 'LOW_POWER']);
  const fitnessPct = calcWeeklyAdherence(logs, 'fitness_status', ['FULL', 'LOW_POWER']);
  const cleanlinessPct = calcWeeklyAdherence(logs, 'cleanliness_status', ['CLEANED']);

  const socialLogs = logs.filter((l) => l.social_status != null);
  const socialPct = socialLogs.length
    ? Math.round((socialLogs.filter((l) => l.social_status === 'SUCCESS').length / socialLogs.length) * 100)
    : null;

  const embed = new EmbedBuilder()
    .setTitle('📋 Weekly Report Card')
    .setColor(0x5865f2)
    .setDescription('Your accountability snapshot for the past 7 days.')
    .addFields(
      {
        name: '💻 Career',
        value: `${careerPct}% ${buildProgressBar(careerPct, 100, 10)}`,
        inline: false,
      },
      {
        name: '🏋️ Fitness',
        value: `${fitnessPct}% ${buildProgressBar(fitnessPct, 100, 10)}`,
        inline: false,
      },
      {
        name: '🧹 Cleanliness',
        value: `${cleanlinessPct}% ${buildProgressBar(cleanlinessPct, 100, 10)}`,
        inline: false,
      },
      {
        name: '🚀 JPMC Escape Velocity',
        value: `${escape.bar}\n${escape.score}/${escape.goal} points (${escape.percent}%)`,
        inline: false,
      },
      {
        name: '🔥 Streaks',
        value: `Perfect days: ${settings.consecutive_days_perfect}/10\nShields: ${settings.streak_shields}/2`,
        inline: true,
      }
    );

  if (socialPct !== null) {
    embed.addFields({
      name: '🗽 Social (Weekly)',
      value: `${socialPct}% ${buildProgressBar(socialPct, 100, 10)}`,
      inline: false,
    });
  }

  if (todayLog?.social_status) {
    embed.addFields({
      name: "🗽 Today's Social Check",
      value: formatStatusLabel(todayLog.social_status),
      inline: true,
    });
  }

  return embed;
}
