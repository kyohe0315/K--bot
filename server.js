const { Client, GatewayIntentBits, Events } = require("discord.js");
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
  ],
});

const TOKEN = process.env.DISCORD_BOT_TOKEN;

// 設定されたレスポンスパターン
const messagePatterns = [
  {
    pattern: /こんにちは|やあ|こんちゃ/,
    responses: ["やあ！", "こんにちは～", "元気？"],
    type: "random",
  },
  {
    pattern: /きょへ。?は/,
    responses: ["ピカチュウ窓主"],
    type: "random",
  },
  {
    pattern: /テスト/,
    responses: ["これはテストメッセージです。", "すべて正常に動作しています。"],
    type: "multi",
  },
  {
    pattern: /うんこ|💩/,
    responses: ["う", "ん", "こ", "だ", "な", "♪"],
    type: "sequential",
    deleteAfter: 1000,
    interval: 3000,
  },
  {
    pattern: /せいは/,
    responses: [
      "せいさんはですね・・・。",
      "言いたい事たくさんあるんですよ。",
      "結構長くなるので覚悟してくださいね？",
      "何から話そうかな。",
      "まずは僕と青酸がはじめて出会った日の事ですが、",
      "あれはまだ僕たちが高3だった頃…の2年前…。",
      "続きは課金してね！♡",
    ],
    type: "sequential",
    deleteAfter: 1000,
    interval: 3000,
  },
];

// おみくじ機能
const omikujiTriggers = /！おみくじ|!おみくじ|おみくじ/;
const omikujiResults = [
  "🎊すっごーーーい大吉！！🎊",
  "✨かなり大吉✨",
  "✨吉だね！✨",
  "中吉だなぁ～👍🏻",
  "残念~ 小吉~www",
  "凶！",
  "大凶。背後には気を付けろよ・・・。",
];

let vcStartMessages = new Map();

client.on(Events.ClientReady, () => {
  console.log(`${client.user.tag} でログイン中`);
});

client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot) return;

  // 共通レスポンス処理
  for (const { pattern, responses, type, deleteAfter = 0, interval = 0 } of messagePatterns) {
    if (message.content.match(pattern)) {
      if (type === "random") {
        const res = responses[Math.floor(Math.random() * responses.length)];
        await message.channel.send(res);
      } else {
        for (const text of responses) {
          const msg = await message.channel.send(text);
          if (deleteAfter > 0) setTimeout(() => msg.delete().catch(() => {}), deleteAfter);
          if (interval > 0) await delay(interval);
        }
      }
      return;
    }
  }

  // おみくじ処理
  if (
    message.content.match(omikujiTriggers) ||
    (message.mentions.has(client.user) && message.content.includes("おみくじ"))
  ) {
    const result = omikujiResults[Math.floor(Math.random() * omikujiResults.length)];
    await message.reply(result);
    setTimeout(() => message.delete().catch(() => {}), 1000);
    return;
  }

  // VC通話開始
  if (message.content.match(/VC開始|ボイチャ開始|VCスタート|ボイチャスタート/)) {
    const sent = await message.channel.send("chatroom1にて通話が開始されました！　
 https://discord.gg/PpugjHBgDB");
    vcStartMessages.set(message.guildId, sent.id);
    setTimeout(() => message.delete().catch(() => {}), 200);
    return;
  }
});

// VC退出 → 通話終了＋開始メッセージ削除
client.on(Events.VoiceStateUpdate, async (oldState, newState) => {
  const channel = oldState.channel;
  if (
    channel &&
    oldState.channelId !== newState.channelId &&
    channel.members.size === 0 &&
    vcStartMessages.has(oldState.guild.id)
  ) {
    try {
      const textChannel = channel.guild.channels.cache.find(
        (ch) => ch.isTextBased() && ch.name === "chatroom1-text"
      );
      if (textChannel) {
        const msgId = vcStartMessages.get(oldState.guild.id);
        const msg = await textChannel.messages.fetch(msgId);
        await msg.delete().catch(() => {});
        await textChannel.send("通話おつかれさまでした！");
        vcStartMessages.delete(oldState.guild.id);
      }
    } catch (err) {
      console.error("通話終了メッセージ削除エラー:", err);
    }
  }
});

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

client.login(TOKEN);
