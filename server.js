// server.js
const { Client, GatewayIntentBits, Events } = require("discord.js");
const responses = require("./responses.js");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
  ],
});

const TOKEN = process.env.DISCORD_BOT_TOKEN;
const VC_NOTIFY_CHANNEL_ID = "932595932464291872"; // ← 聞き専チャンネル
const VOICE_CHANNEL_ID = "930348999645483111"; // ← chatroom1
const vcStartMessages = new Map();

client.once(Events.ClientReady, () => {
  console.log(`${client.user.tag} でログイン中`);
  client.user.setActivity("第二の人生v2.4", { type: 0 }); // ← これを追加
});

client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot) return;

  for (const { pattern, responses: res, type } of responses) {
    if (pattern.test(message.content)) {
      switch (type) {
        case "static":
          for (const r of res) await message.channel.send(r);
          break;

        case "random":
          await message.channel.send(res[Math.floor(Math.random() * res.length)]);
          break;

        case "progressive":
          for (const r of res) {
            const sent = await message.channel.send(r);
            setTimeout(() => sent.delete().catch(() => {}), 3000);
            await delay(100);
          }
          break;

        case "reverse-delete": {
          const messages = [];
          for (const r of res) messages.push(await message.channel.send(r));
          for (const m of messages.reverse()) {
            setTimeout(() => m.delete().catch(() => {}), 1000);
            await delay(2000);
          }
          break;
        }
      }
      return;
    }
  }

  // おみくじ
  if (
    /！おみくじ|!おみくじ|おみくじ/.test(message.content) ||
    (message.mentions.has(client.user) && message.content.includes("おみくじ"))
  ) {
    const omikujiResults = [
      "🎊すっごーーーい大吉！！🎊",
      "✨かなり大吉✨",
      "✨吉だね！✨",
      "中吉だなぁ～👍🏻",
      "残念~ 小吉~www",
      "凶！",
      "大凶。背後には気を付けろよ・・・。",
    ];
    const result = omikujiResults[Math.floor(Math.random() * omikujiResults.length)];
    await message.reply(result);
    setTimeout(() => message.delete().catch(() => {}), 1000);
    return;
  }
});

client.on(Events.VoiceStateUpdate, async (oldState, newState) => {
  const guild = newState.guild;

  // ✅ 指定VCに人が入った時だけ通知を送る
  if (!oldState.channel && newState.channelId === VOICE_CHANNEL_ID) {
    const textChannel = guild.channels.cache.get(VC_NOTIFY_CHANNEL_ID);
    if (textChannel && textChannel.isTextBased()) {
      try {
        const msg = await textChannel.send("chatroom1にて通話が開始されました！\nhttps://discord.gg/PpugjHBgDB");
        vcStartMessages.set(guild.id, msg.id);
      } catch (err) {
        console.error("VC開始メッセージ送信エラー:", err);
      }
    }
  }

  // ✅ VCから全員いなくなったら終了メッセージ送信＆開始メッセージ削除
  const channel = oldState.channel;
  if (
    channel &&
    channel.id === VOICE_CHANNEL_ID && // ← 対象VCであることも確認
    oldState.channelId !== newState.channelId &&
    channel.members.size === 0 &&
    vcStartMessages.has(oldState.guild.id)
  ) {
    try {
      const textChannel = channel.guild.channels.cache.get(VC_NOTIFY_CHANNEL_ID);
      const msgId = vcStartMessages.get(oldState.guild.id);
      if (textChannel && textChannel.isTextBased() && msgId) {
        const msg = await textChannel.messages.fetch(msgId);
        await msg.delete().catch(() => {});
        await textChannel.send("おつかれさまでした！🥱");
        vcStartMessages.delete(oldState.guild.id);
      }
    } catch (err) {
      console.error("VC終了メッセージ削除エラー:", err);
    }
  }
});

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const CHECK_INTERVAL = 10 * 60 * 1000; // 10分（ミリ秒）

setInterval(async () => {
  const channel = client.channels.cache.get(VC_NOTIFY_CHANNEL_ID);
  if (!channel || !channel.isTextBased()) return;

  try {
    const fetched = await channel.messages.fetch({ limit: 50 });
    const targets = fetched
      .filter(msg => msg.content === "おつかれさまでした！🥱" && !msg.author.bot)
      .sort((a, b) => b.createdTimestamp - a.createdTimestamp); // 新しい順

    if (targets.size > 1) {
      const [, ...oldOnes] = targets.map(msg => msg); // 最新1つを残して削除
      for (const msg of oldOnes) {
        await msg.delete().catch(() => {});
      }
    }
  } catch (err) {
    console.error("メッセージ自動整理エラー:", err);
  }
}, CHECK_INTERVAL);


client.login(TOKEN);
