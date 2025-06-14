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

// 定型パターン + 応答メッセージ
const patterns = [
  { pattern: /K-bot/, response: "はいはいなんでしょうか？" },
  { pattern: /きょへ/, response: () => sendMsg(process.env.DEBUG_CHANNEL_ID, "ピカチュウ窓主") },
];

// 複数メッセージ + 自動削除
const multiMessageTriggers = [
  {
    pattern: /うんこ|💩|ウンコ|ウンチ/,
    messages: ["う", "ん", "こ", "だ", "な", "♪"],
    deleteDelay: 1000
  },
  {
    pattern: /せいは|seiは/,
    messages: [
      "せいさんはですね・・・。",
      "言いたい事たくさんあるんですよ。",
      "結構長くなるので覚悟してくださいね？",
      "何から話そうかな。",
      "まずは僕と青酸がはじめて出会った日の事ですが、",
      "あれはまだ僕たちが高3だった頃…の2年前…。",
      "続きは課金してね！♡"
    ],
    deleteDelay: 4000
  }
];

// ランダムレスポンスパターン
const randomResponses = [
  {
    pattern: /おは|おっは|おはよう/,
    responses: ["おはよう☀️", "おっはー！", "Good morning!", "今日も元気？"]
  },
  {
    pattern: /おみくじ/,
    responses: ["大吉", "中吉", "小吉", "凶", "大凶", "末吉"]
  }
];

client.once(Events.ClientReady, () => {
  console.log(`Logged in as ${client.user.tag}`);
  client.user.setPresence({ activities: [{ name: '第２の人生' }], status: 'online' });
});

client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot) return;

  // リアクション機能
  for (const emoji in reactionsMap) {
    if (message.content.includes(emoji)) {
      message.react(reactionsMap[emoji]).catch(console.error);
    }
  }

  // 固定応答
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

  // 複数メッセージ投稿＋自動削除
  for (const { pattern, messages, deleteDelay } of multiMessageTriggers) {
    if (message.content.match(pattern)) {
      const sent = [];
      for (const text of messages) {
        const msg = await message.channel.send(text);
        sent.push(msg);
      }
      setTimeout(() => {
        sent.forEach(m => m.delete().catch(() => {}));
      }, deleteDelay);
      return;
    }
  }

  // ランダムレスポンス
  for (const { pattern, responses } of randomResponses) {
    if (message.content.match(pattern)) {
      const rand = responses[Math.floor(Math.random() * responses.length)];
      await message.channel.send(rand);
      return;
    }
  }
});

// VC入退出監視
client.on('voiceStateUpdate', async (oldState, newState) => {
  const vc = client.channels.cache.get(process.env.VOICE_CHANNEL_ID);
  const text = client.channels.cache.get(process.env.MAIN_CHANNEL_ID);
  if (!vc || !text) return;

  if (!oldState.channelId && newState.channelId === vc.id && vc.members.size === 1) {
    text.send("chatroom1にて通話が開始されました！https://discord.gg/PpugjHBgDB");
  }

  if (oldState.channelId === vc.id && vc.members.size === 0) {
    text.send("お疲れ様でした！🥱");
  }
});

// カレンダー送信
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
