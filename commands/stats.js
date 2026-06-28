import { SlashCommandBuilder } from 'discord.js';
import { buildStatsMessage } from '../services/metrics.js';

export const data = new SlashCommandBuilder().setName('stats').setDescription('View weekly adherence and escape velocity');

export async function execute(interaction) {
  await interaction.reply({ content: buildStatsMessage(), ephemeral: true });
}
