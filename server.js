// ✅ discord.js v14対応 全機能統合型Botの骨組み（簡潔＆高機能ベース）

const { Client, GatewayIntentBits, Events } = require('discord.js');
const express = require('express');
const cron = require('node-cron');
const axios = require('axios');
const ical = require('ical');

const app = express();
app.get('/healthz', (req, res) => res.status(200).send('OK'));
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Web server running on ${PORT}`));

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMembers
  ]
});

const reactionsMap = { '🥺': '🥺', '😅': '😅' }; // 例
const patterns = [
  { pattern: /K-bot/, response: "はいはいなんでしょうか？" },
  { pattern: /きょへ/, response: () => sendMsg(process.env.DEBUG_CHANNEL_ID, "ピカチュウ窓主") }
];

client.once(Events.ClientReady, () => {
  console.log(`Logged in as ${client.user.tag}`);
  client.user.setPresence({ activities: [{ name: '第２の人生' }], status: 'online' });
});

client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot) return;

  // リアクション
  for (const emoji in reactionsMap) {
    if (message.content.includes(emoji)) {
      message.react(reactionsMap[emoji]).catch(console.error);
    }
  }

  // パターン応答
  for (const { pattern, response } of patterns) {
    if (message.content.match(pattern)) {
      if (typeof response === 'function') {
        await response();
      } else {
        await message.channel.send(response);
      }
      return;
    }
  }
});

client.on('voiceStateUpdate', async (oldState, newState) => {
  const vc = client.channels.cache.get(process.env.VOICE_CHANNEL_ID);
  const text = client.channels.cache.get(process.env.MAIN_CHANNEL_ID);
  if (!vc || !text) return;

  // 通話開始
  if (!oldState.channelId && newState.channelId === vc.id && vc.members.size === 1) {
    text.send("chatroom1にて通話が開始されました！");
  }
  // 通話終了
  if (oldState.channelId === vc.id && vc.members.size === 0) {
    text.send("お疲れ様でした！🥱");
  }
});

// カレンダー関連
cron.schedule('0 9 * * 1', async () => {
  try {
    const res = await axios.get(process.env.ICAL_URL);
    const events = ical.parseICS(res.data);
    const msg = Object.values(events)
      .filter(e => e.start)
      .map(e => `**${e.summary}** - ${e.start.toLocaleDateString('ja-JP')}`)
      .join('\n');
    client.channels.cache.get(process.env.ICAL_CHANNEL_ID)?.send(`# 📅 今月の予定\n${msg}`);
  } catch (e) {
    console.error('iCal error:', e);
  }
});

function sendMsg(channelId, text) {
  const ch = client.channels.cache.get(channelId);
  if (ch) ch.send(text).catch(console.error);
}

client.login(process.env.DISCORD_BOT_TOKEN);
