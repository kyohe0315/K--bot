// server.js
const { Client, GatewayIntentBits, Events } = require("discord.js");
const responses = require("./responses.js");

const { OpenAI } = require("openai");
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
  ],
});

const TOKEN = process.env.DISCORD_BOT_TOKEN;
const VC_NOTIFY_CHANNEL_ID = process.env.VC_NOTIFY_CHANNEL_ID; // ← 聞き専チャンネル
const VOICE_CHANNEL_ID = process.env.VOICE_CHANNEL_ID; // ← chatroom1
const ICAL_CHANNEL_ID = process.env.ICAL_CHANNEL_ID; // ← 星の子の話し場
const ICAL_URL = process.env.ICAL_URL; // ← GoogleカレンダーURL
const vcStartMessages = new Map();

const axios = require("axios");
const ical = require("node-ical");
const cron = require("node-cron");

client.once(Events.ClientReady, () => {
  console.log(`${client.user.tag} でログイン中`);
  client.user.setActivity("第二の人生v2.5", { type: 0 }); // ← これを追加
  //postMonthlyEvents(); // ← デバッグ用
  //remindCurrentEvents(); // ← デバッグ用← これを追加
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
          for (const r of res) { // ← 例）うんこ
            const sent = await message.channel.send(r);
            setTimeout(() => sent.delete().catch(() => {}), 3000); // ← 表示時間
            await delay(100); // ← 次のメッセージまでの待ち時間
          }
          break;

        case "reverse-delete": { // ← 例）せいは
          const messages = [];
          for (const r of res) messages.push(await message.channel.send(r));
          for (const m of messages.reverse()) {
            setTimeout(() => m.delete().catch(() => {}), 1000); // ← 各メッセージの削除までの時間
            await delay(2000); // ← 次の削除までの待ち時間
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

client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot) return;

  // ChatGPT呼び出し処理
  if (
    message.mentions.has(client.user) &&
    message.content.includes(@K-bot.#7426 ")
  ) {
    try {
      const prompt = message.content.replace(/<@!?(\d+)>/g, "").trim(); // メンション削除

      const response = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.8,
      });

      const replyText = response.choices[0].message.content.trim();
      await message.reply(replyText);
    } catch (err) {
      console.error("ChatGPTへの問い合わせでエラー:", err);
      await message.reply("ChatGPTへの問い合わせに失敗しました🥲");
    }
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

const CHECK_INTERVAL = 1 * 60 * 1000; // 10分（ミリ秒）

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

function getMonthRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 2, 0, 23, 59, 59);
  return { start, end };
}

async function postMonthlyEvents() {
  try {
    const { start, end } = getMonthRange();
    const response = await axios.get(ICAL_URL);
    const events = ical.parseICS(response.data);

    const monthlyEvents = Object.values(events).filter(event =>
      event.start && event.start >= start && event.start <= end
    );

    global.monthlyEvents = monthlyEvents;

    const channel = client.channels.cache.get(ICAL_CHANNEL_ID);
    if (!channel || !channel.isTextBased()) return;

    if (monthlyEvents.length > 0) {
      let message = `# 📅 ${start.toLocaleDateString('ja-JP')} ～ ${end.toLocaleDateString('ja-JP')} のイベント一覧\n\n\n`;
      monthlyEvents.forEach(event => {
        const startDate = event.start.toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo' }).replace(/^\d+\/(\d+)\/(\d+)$/, '$1/$2');
        const endDate = event.end ? event.end.toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo' }).replace(/^\d+\/(\d+)\/(\d+)$/, '$1/$2') : '未定';
        message += `**${event.summary}**\n${startDate} ～ ${endDate}\n\n`;
      });
      await channel.send(message);
    } else {
      await channel.send(`📅 今月 (${start.toLocaleDateString('ja-JP')} ～ ${end.toLocaleDateString('ja-JP')}) に予定されているイベントはありません。`);
    }
  } catch (error) {
    console.error('カレンダーの取得に失敗しました:', error);
  }
}

async function remindCurrentEvents() {
  try {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const { start, end } = getMonthRange();
    const response = await axios.get(ICAL_URL);
    const events = ical.parseICS(response.data);

    const monthlyEvents = Object.values(events).filter(event =>
      event.start && event.start >= start && event.start <= end
    );
    global.monthlyEvents = monthlyEvents;

    const channel = client.channels.cache.get(ICAL_CHANNEL_ID);
    if (!channel || !channel.isTextBased()) return;

    const ongoingEvents = monthlyEvents.filter(event => {
      const eventStart = new Date(event.start);
      const eventEnd = new Date(event.end || event.start); // 終了未設定なら開始日と同じに
      eventStart.setHours(0, 0, 0, 0);
      eventEnd.setHours(0, 0, 0, 0);
      return eventStart <= now && eventEnd >= now;
    });

    if (ongoingEvents.length > 0) {
      let message = `## 🔔 現在進行中のイベント\n\n`;
      ongoingEvents.forEach(event => {
        const startDate = event.start.toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo' }).replace(/^\d+\/(\d+)\/(\d+)$/, '$1/$2');
        const endDate = event.end ? event.end.toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo' }).replace(/^\d+\/(\d+)\/(\d+)$/, '$1/$2') : '未定';
        message += `**${event.summary}**\n開始日: ${startDate} ～ 終了日: ${endDate}\n\n`;
      });
      await channel.send(message);
    } else {
      await channel.send('🔔 現在進行中のイベントはありません。');
    }
  } catch (error) {
    console.error('リマインダーの送信に失敗しました:', error);
  }
}

// 月曜 午前9時：今月のイベント一覧
cron.schedule('0 9 * * 1', () => {
  postMonthlyEvents();
});

// 水・金 午後5時：進行中イベントリマインダー
cron.schedule('0 17 * * 3,5', () => {
  remindCurrentEvents();
});

client.login(TOKEN);
