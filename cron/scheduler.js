import schedule from 'node-schedule';
import { USER_ID, TIMEZONE } from '../config.js';
import { startCheckin } from '../handlers/checkinFlow.js';
import { buildWeeklyReportEmbed } from '../services/metrics.js';
import { pickRandomChallenge } from '../data/socialChallenges.js';
import { isOnVacation, updateSettings } from '../database/database.js';

export function startScheduler(client) {
  schedule.scheduleJob({ rule: '30 21 * * *', tz: TIMEZONE }, async () => {
    if (isOnVacation()) return;
    try {
      await startCheckin(client, USER_ID);
    } catch (err) {
      console.error('Daily check-in scheduler failed:', err);
    }
  });

  schedule.scheduleJob({ rule: '0 22 * * 0', tz: TIMEZONE }, async () => {
    try {
      const user = await client.users.fetch(USER_ID);
      const embed = buildWeeklyReportEmbed();
      await user.send({ embeds: [embed] });
    } catch (err) {
      console.error('Weekly report scheduler failed:', err);
    }
  });

  schedule.scheduleJob({ rule: '30 12 * * 3', tz: TIMEZONE }, async () => {
    try {
      const user = await client.users.fetch(USER_ID);
      const challenge = pickRandomChallenge();
      await user.send(`📡 **Wednesday Social Radar**\n\nThis week's challenge:\n> ${challenge}`);
    } catch (err) {
      console.error('Social radar scheduler failed:', err);
    }
  });

  schedule.scheduleJob({ rule: '0 0 * * *', tz: TIMEZONE }, () => {
    updateSettings({ is_lowpower_today: 0 });
  });

  console.log(`Scheduler started (${TIMEZONE})`);
}
