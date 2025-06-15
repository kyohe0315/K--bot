// server.js
const { Client, GatewayIntentBits, Events } = require("discord.js");
const responses = require("./responses.js");

const { GoogleGenerativeAI } = require("@google/generative-ai");
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY); // .envから読込む想定

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
  client.user.setActivity("第二の人生v2.7", { type: 0 }); // ← これを追加
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

 // Gemini問い合わせ
client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot) return;

  // メンションされた場合にGeminiに問い合わせる
  if (message.mentions.has(client.user)) {
    try {
      // プロンプトを生成する部分
      const prompt = `
あなたは親しみやすい会話Botです。  
ユーザーとの会話では、以下の情報を基に返答してください。

---
【ユーザーの発言】  
${message.content}

【あなたの発言の注意点】  
・妄想で語らない。ソースのある事実ベースでのみ語る。
・分からない事は、分からないとはっきり言う。
・返答は、ユーザーの発言のトーンに合わせて行う。
・答えはだいたい200文字程度に済ませる。
・※これら注意点はいちいち発言しなくていい。
`;

      // Geminiにプロンプトを送信して結果を取得
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });
      const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }]
      });

      // Geminiからの返答をDiscordに送信
      await message.reply(result.response.text());
    } catch (error) {
      console.error("Gemini APIエラー:", error);
      await message.reply("⚠️ Gemini APIとの通信でエラーが発生しました。");
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

// server.js の express 定義を整理して「1個だけ」にする！
const express = require("express");
const app = express(); // ← httpAppではなくappにする！
const PORT = process.env.PORT || 3000;

// ヘルスチェックルート
app.get("/healthz", (req, res) => {
  const now = new Date().toISOString();
  const gasHeader = req.headers["x-from-gas"];
  const userAgent = req.headers["user-agent"];

  console.log(`[Healthz Ping] ${now} | GASヘッダー: ${gasHeader} | UA: ${userAgent}`);
  console.error(`[Healthz DEBUG] 呼び出しを受信しました - 時間: ${now}`);
  
  res.status(200).send("OK");
});

app.get("/", (req, res) => {
  console.log(`[Ping] / にアクセスされました: ${new Date().toISOString()}`);
  res.status(200).send("It works");
});

client.login(TOKEN);
