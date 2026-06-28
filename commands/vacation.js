import { SlashCommandBuilder } from 'discord.js';
import { getTodayDateStr, updateSettings, addDays } from '../database/database.js';

export const data = new SlashCommandBuilder()
  .setName('vacation')
  .setDescription('Set vacation mode for N days')
  .addIntegerOption((option) =>
    option.setName('days').setDescription('Number of vacation days').setRequired(true).setMinValue(1).setMaxValue(30)
  );

export async function execute(interaction) {
  const days = interaction.options.getInteger('days');
  const until = addDays(getTodayDateStr(), days);
  updateSettings({ is_vacation_until: until });

  await interaction.reply({
    content: `🏖️ Vacation mode active until **${until}**. No check-ins or roasts until then.`,
    ephemeral: true,
  });
}
