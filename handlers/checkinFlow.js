import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from 'discord.js';
import {
  getTodayLog,
  getLogByDate,
  saveDailyLog,
  getTodayDateStr,
  getYesterdayDateStr,
  isOnVacation,
  isInResurrectionMode,
  getSettings,
} from '../database/database.js';
import {
  isSunday,
  formatStatusLabel,
  auditViolations,
  updateStreakAfterLog,
} from '../services/metrics.js';
import { generateRoast } from '../services/roastEngine.js';

const sessions = new Map();

const STATUS_MAP = {
  career_full: 'FULL',
  career_low: 'LOW_POWER',
  career_skip: 'SKIPPED',
  fitness_full: 'FULL',
  fitness_low: 'LOW_POWER',
  fitness_skip: 'SKIPPED',
  cleanliness_cleaned: 'CLEANED',
  cleanliness_skip: 'SKIPPED',
  social_success: 'SUCCESS',
  social_skip: 'SKIPPED',
};

function careerRow() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('career_full').setLabel('Full Session').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('career_low').setLabel('Low-Power').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('career_skip').setLabel('Skipped').setStyle(ButtonStyle.Danger)
  );
}

function fitnessRow() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('fitness_full').setLabel('Workout + Diet').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('fitness_low').setLabel('Low-Power').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('fitness_skip').setLabel('Skipped').setStyle(ButtonStyle.Danger)
  );
}

function cleanlinessRow() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('cleanliness_cleaned').setLabel('Cleaned').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('cleanliness_skip').setLabel('Skipped').setStyle(ButtonStyle.Danger)
  );
}

function socialRow() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('social_success').setLabel('Yes').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('social_skip').setLabel('Skipped').setStyle(ButtonStyle.Danger)
  );
}

function resurrectionRow() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('resurrection_complete')
      .setLabel('Quest Complete')
      .setStyle(ButtonStyle.Success)
  );
}

function lowPowerBanner() {
  const settings = getSettings();
  return settings.is_lowpower_today ? '\n\n⚡ *Low-power mode is on today.*' : '';
}

function careerMessage() {
  return `💻 **Daily Check-In: Career**\nDid you do your LeetCode or System Design prep today?${lowPowerBanner()}`;
}

function fitnessMessage(career) {
  return `🏋️ **Daily Check-In: Fitness**\nCareer Logged: **${formatStatusLabel(career)}**\nDid you hit your gym and protein goals today?`;
}

function cleanlinessMessage(career, fitness) {
  return `🧹 **Daily Check-In: Cleanliness**\nCareer Logged: **${formatStatusLabel(career)}**\nFitness Logged: **${formatStatusLabel(fitness)}**\nDid you complete your 10-minute nightly organization reset?`;
}

function socialMessage(career, fitness, cleanliness) {
  return `🗽 **Weekly Check-In: NYC Social Life**\nCareer Logged: **${formatStatusLabel(career)}**\nFitness Logged: **${formatStatusLabel(fitness)}**\nCleanliness Logged: **${formatStatusLabel(cleanliness)}**\nDid you complete at least one active social outreach this week?`;
}

function completionMessage(log) {
  let text = `✅ **Check-In Complete**\n\n`;
  text += `💻 Career: **${formatStatusLabel(log.career_status)}**\n`;
  text += `🏋️ Fitness: **${formatStatusLabel(log.fitness_status)}**\n`;
  text += `🧹 Cleanliness: **${formatStatusLabel(log.cleanliness_status)}**\n`;
  if (log.social_status) text += `🗽 Social: **${formatStatusLabel(log.social_status)}**\n`;
  return text;
}

export async function sendResurrectionQuest(client, userId) {
  const user = await client.users.fetch(userId);
  await user.send({
    content:
      "Sri, you've been off the grid for 5 days. The standard program is paused. Let's not worry about SpaceX prep or heavy lifting today. To get back on track, you just need to complete one Resurrection Quest today: **Make your bed and wash your dishes right now.**",
    components: [resurrectionRow()],
  });
}

export async function startCheckin(client, userId) {
  if (isOnVacation()) {
    const user = await client.users.fetch(userId);
    await user.send('🏖️ Vacation mode active — no check-in today.');
    return { blocked: true, reason: 'vacation' };
  }

  if (isInResurrectionMode()) {
    await sendResurrectionQuest(client, userId);
    return { blocked: true, reason: 'resurrection' };
  }

  if (getTodayLog()) {
    const user = await client.users.fetch(userId);
    await user.send("You've already completed today's check-in.");
    return { blocked: true, reason: 'duplicate' };
  }

  const user = await client.users.fetch(userId);
  const msg = await user.send({ content: careerMessage(), components: [careerRow()] });
  sessions.set(msg.id, { step: 'career', career: null, fitness: null, cleanliness: null, isResurrection: false });
  return { blocked: false };
}

async function completeCheckin(interaction, session) {
  const today = getTodayDateStr();
  const isSundayToday = isSunday(today);
  const socialStatus = isSundayToday ? session.social : null;

  const log = {
    logDate: today,
    careerStatus: session.career,
    fitnessStatus: session.fitness,
    cleanlinessStatus: session.cleanliness,
    socialStatus,
  };

  saveDailyLog(log);
  updateStreakAfterLog(
    {
      career_status: session.career,
      fitness_status: session.fitness,
      cleanliness_status: session.cleanliness,
      social_status: socialStatus,
    },
    isSundayToday
  );

  const savedLog = {
    career_status: session.career,
    fitness_status: session.fitness,
    cleanliness_status: session.cleanliness,
    social_status: socialStatus,
  };

  await interaction.update({
    content: completionMessage(savedLog),
    components: [],
  });
  sessions.delete(interaction.message.id);

  if (session.skipAudit) return;

  const yesterday = getLogByDate(getYesterdayDateStr());
  const violations = auditViolations(
    {
      career_status: session.career,
      fitness_status: session.fitness,
      cleanliness_status: session.cleanliness,
      social_status: socialStatus,
    },
    yesterday,
    isSundayToday
  );

  if (violations.length && !isInResurrectionMode() && !isOnVacation()) {
    try {
      const roast = await generateRoast({ violations });
      if (roast) {
        await interaction.user.send(`🔥 **The Coach:**\n${roast}`);
      }
    } catch (err) {
      console.error('Roast engine failed:', err);
    }
  }
}

export async function handleButtonInteraction(interaction) {
  const customId = interaction.customId;

  if (customId === 'resurrection_complete') {
    if (getTodayLog()) {
      await interaction.update({ content: "Today's resurrection quest is already logged.", components: [] });
      return;
    }

    const today = getTodayDateStr();
    saveDailyLog({
      logDate: today,
      careerStatus: 'LOW_POWER',
      fitnessStatus: 'LOW_POWER',
      cleanlinessStatus: 'CLEANED',
      socialStatus: isSunday(today) ? 'SUCCESS' : null,
    });

    await interaction.update({
      content: '✅ **Resurrection Quest Complete.** Normal operations resume tomorrow.',
      components: [],
    });
    return;
  }

  const session = sessions.get(interaction.message.id);
  if (!session) {
    await interaction.reply({ content: 'This check-in session expired. Use /checkin to start again.', ephemeral: true });
    return;
  }

  if (customId.startsWith('career_')) {
    session.career = STATUS_MAP[customId];
    session.step = 'fitness';
    await interaction.update({
      content: fitnessMessage(session.career),
      components: [fitnessRow()],
    });
    return;
  }

  if (customId.startsWith('fitness_')) {
    session.fitness = STATUS_MAP[customId];
    session.step = 'cleanliness';
    await interaction.update({
      content: cleanlinessMessage(session.career, session.fitness),
      components: [cleanlinessRow()],
    });
    return;
  }

  if (customId.startsWith('cleanliness_')) {
    session.cleanliness = STATUS_MAP[customId];
    const today = getTodayDateStr();

    if (isSunday(today)) {
      session.step = 'social';
      await interaction.update({
        content: socialMessage(session.career, session.fitness, session.cleanliness),
        components: [socialRow()],
      });
      return;
    }

    await completeCheckin(interaction, session);
    return;
  }

  if (customId.startsWith('social_')) {
    session.social = STATUS_MAP[customId];
    await completeCheckin(interaction, session);
  }
}

export function isCheckinButton(customId) {
  return (
    customId.startsWith('career_') ||
    customId.startsWith('fitness_') ||
    customId.startsWith('cleanliness_') ||
    customId.startsWith('social_') ||
    customId === 'resurrection_complete'
  );
}
