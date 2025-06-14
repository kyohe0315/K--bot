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

// 定型レスポンス
const simplePatterns = [
  { pattern: /こんにちは|やあ|こんちゃ/, responses: ["やあ！", "こんにちは～", "元気？"] },
  { pattern: /きょへ。?は/, responses: ["ピカチュウ窓主"] },
  { pattern: /テスト/, responses: ["これはテストメッセージです。", "すべて正常に動作しています。"] },
  { pattern: /うんこ|💩/, responses: ["う", "ん", "こ", "だ", "な", "♪"], sequential: true },
];

// 複数メッセージ＆順次削除
const multiMessagePatterns = [
  {
    pattern: /せいは/,
    messages: [
      "せいさんはですね・・・。",
      "言いたい事たくさんあるんですよ。",
      "結構長くなるので覚悟してくださいね？",
      "何から話そうかな。",
      "まずは僕と青酸がはじめて出会った日の事ですが、",
      "あれはまだ僕たちが高3だった頃…の2年前…。",
      "続きは課金してね！♡",
    ],
  },
];

// おみくじ用
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

  // シンプルなランダムレスポンス
  for (const { pattern, responses, sequential } of simplePatterns) {
    if (message.content.match(pattern)) {
      if (sequential) {
        for (const text of responses) {
          const msg = await message.channel.send(text);
          setTimeout(() => msg.delete().catch(() => {}), 1000);
          await delay(3000);
        }
      } else {
        const random = responses[Math.floor(Math.random() * responses.length)];
        await message.channel.send(random);
      }
      return;
    }
  }

  // 複数メッセージ順次表示削除
  for (const { pattern, messages } of multiMessagePatterns) {
    if (message.content.match(pattern)) {
      for (const msgText of messages) {
        const msg = await message.channel.send(msgText);
        setTimeout(() => msg.delete().catch(() => {}), 100);
        await delay(5000);
      }
      return;
    }
  }

  // おみくじ
  if (
    message.content.match(omikujiTriggers) ||
    (message.mentions.has(client.user) && message.content.includes("おみくじ"))
  ) {
    const result = omikujiResults[Math.floor(Math.random() * omikujiResults.length)];
    await message.reply(result);
    setTimeout(() => message.delete().catch(() => {}), 1000);
    return;
  }

  // VC通話開始メッセージ
  if (message.content.match(/VC開始|ボイチャ開始|VCスタート|ボイチャスタート/)) {
    const sent = await message.channel.send("chatroom1にて通話が開始されました！　\n https://discord.gg/PpugjHBgDB");
    vcStartMessages.set(message.guildId, sent.id);
    setTimeout(() => message.delete().catch(() => {}), 200);
    return;
  }
});

// VC退出 → 開始メッセージ削除
client.on(Events.VoiceStateUpdate, async (oldState, newState) => {
  const channel = oldState.channel;
  if (
    channel &&
    oldState.channelId !== newState.channelId &&
    channel.members.size === 0 &&
    vcStartMessages.has(oldState.guild.id)
  ) {
    try {
      const textChannel = channel.guild.channels.cache.find((ch) => ch.isTextBased());
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
