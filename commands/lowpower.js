import { SlashCommandBuilder } from 'discord.js';
import { getSettings, updateSettings } from '../database/database.js';

export const data = new SlashCommandBuilder()
  .setName('lowpower')
  .setDescription('Toggle low-power mode for today');

export async function execute(interaction) {
  const settings = getSettings();
  const newValue = settings.is_lowpower_today ? 0 : 1;
  updateSettings({ is_lowpower_today: newValue });

  const state = newValue ? 'ON' : 'OFF';
  await interaction.reply({
    content: `⚡ Low-power mode is now **${state}** for today.`,
    ephemeral: true,
  });
}
