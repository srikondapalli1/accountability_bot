import http from 'http';
import {
  Client,
  GatewayIntentBits,
  Partials,
  REST,
  Routes,
  Collection,
} from 'discord.js';
import { DISCORD_TOKEN, USER_ID } from './config.js';
import { startScheduler } from './cron/scheduler.js';
import { startKeepAlive } from './services/keepAlive.js';
import { handleButtonInteraction, isCheckinButton } from './handlers/checkinFlow.js';
import * as stats from './commands/stats.js';
import * as lowpower from './commands/lowpower.js';
import * as vacation from './commands/vacation.js';
import * as milestone from './commands/milestone.js';
import * as checkin from './commands/checkin.js';

const commands = [stats, lowpower, vacation, milestone, checkin];

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.DirectMessages],
  partials: [Partials.Channel],
});

client.commands = new Collection();
for (const cmd of commands) {
  client.commands.set(cmd.data.name, cmd);
}

async function registerCommands() {
  const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);
  const body = commands.map((cmd) => cmd.data.toJSON());
  await rest.put(Routes.applicationCommands(client.user.id), { body });
  console.log('Slash commands registered.');
}

client.once('ready', async () => {
  console.log(`Logged in as ${client.user.tag}`);
  await registerCommands();
  startScheduler(client);
});

client.on('interactionCreate', async (interaction) => {
  if (interaction.user.id !== USER_ID) {
    if (interaction.isRepliable()) {
      await interaction.reply({ content: 'Not authorized.', ephemeral: true }).catch(() => {});
    }
    return;
  }

  if (interaction.isChatInputCommand()) {
    const command = client.commands.get(interaction.commandName);
    if (!command) return;

    try {
      await command.execute(interaction, client);
    } catch (err) {
      console.error(`Command /${interaction.commandName} failed:`, err);
      const reply = { content: 'Something went wrong.', ephemeral: true };
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(reply).catch(() => {});
      } else {
        await interaction.reply(reply).catch(() => {});
      }
    }
    return;
  }

  if (interaction.isButton() && isCheckinButton(interaction.customId)) {
    try {
      await handleButtonInteraction(interaction);
    } catch (err) {
      console.error('Button interaction failed:', err);
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({ content: 'Something went wrong.', ephemeral: true }).catch(() => {});
      }
    }
  }
});

if (!DISCORD_TOKEN || !USER_ID) {
  console.error('Missing DISCORD_TOKEN or USER_ID in .env');
  process.exit(1);
}

const PORT = process.env.PORT || 3000;
http
  .createServer((req, res) => {
    if (req.url === '/health' || req.url === '/') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          status: 'ok',
          bot: client.isReady() ? client.user.tag : 'starting',
        })
      );
      return;
    }
    res.writeHead(404);
    res.end();
  })
  .listen(PORT, () => {
    console.log(`Health server listening on port ${PORT}`);
    startKeepAlive();
  });

client.login(DISCORD_TOKEN);
