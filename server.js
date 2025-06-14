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
const VC_NOTIFY_CHANNEL_ID = "932595932464291872";// ← 聞き専チャンネル
const vcStartMessages = new Map();

client.once(Events.ClientReady, () => {
  console.log(`${client.user.tag} でログイン中`);
  client.user.setActivity("第二の人生v2.1", { type: 0 }); // ← これを追加
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

  // VC通話開始
  if (/VC開始|ボイチャ開始|VCスタート|ボイチャスタート/.test(message.content)) {
    const sent = await message.channel.send("chatroom1にて通話が開始されました！\nhttps://discord.gg/PpugjHBgDB");
    vcStartMessages.set(message.guildId, sent.id);
    setTimeout(() => message.delete().catch(() => {}), 200);
    return;
  }
});

client.on(Events.VoiceStateUpdate, async (oldState, newState) => {
  const guild = newState.guild;

  // 通話に人が入った時
  if (!oldState.channel && newState.channel) {
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

  // 通話から全員いなくなった時
  const channel = oldState.channel;
  if (
    channel &&
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
        await textChannel.send("おつかれさまでした！");
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

client.login(TOKEN);
