import { SlashCommandBuilder } from 'discord.js';
import { startCheckin } from '../handlers/checkinFlow.js';

export const data = new SlashCommandBuilder()
  .setName('checkin')
  .setDescription('Start your daily accountability check-in');

export async function execute(interaction, client) {
  await interaction.reply({ content: 'Starting check-in — check your DMs.', ephemeral: true });
  await startCheckin(client, interaction.user.id);
}
