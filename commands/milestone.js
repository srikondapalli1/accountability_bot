import { SlashCommandBuilder } from 'discord.js';
import { addMilestone } from '../database/database.js';

export const data = new SlashCommandBuilder()
  .setName('milestone')
  .setDescription('Log a milestone')
  .addStringOption((option) =>
    option.setName('category').setDescription('Milestone category').setRequired(true)
  )
  .addStringOption((option) =>
    option.setName('value').setDescription('Milestone value').setRequired(true)
  );

export async function execute(interaction) {
  const category = interaction.options.getString('category');
  const value = interaction.options.getString('value');
  addMilestone(category, value);

  await interaction.reply({
    content: `🏆 Milestone logged: **${category}** — ${value}`,
    ephemeral: true,
  });
}
