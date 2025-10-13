require('dotenv').config(); // ローカル保険。最上段に
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

require("dotenv").config(); // ← 忘れずに！
const { checkLiveUpcoming } = require("./youtubeUpcomingChecker");
const setupRSSWatcher = require("./rssWatcher");

const TOKEN = process.env.DISCORD_BOT_TOKEN;
const VC_NOTIFY_CHANNEL_ID = process.env.VC_NOTIFY_CHANNEL_ID; // ← 聞き専チャンネル
const VOICE_CHANNEL_ID = process.env.VOICE_CHANNEL_ID; // ← chatroom1
const ICAL_CHANNEL_ID = process.env.ICAL_CHANNEL_ID; // ← 星の子の話し場
const ICAL_URL = process.env.ICAL_URL; // ← GoogleカレンダーURL
const vcStartMessages = new Map();

const axios = require("axios");
const ical = require("node-ical");
const cron = require("node-cron");

const GAS_LOG_URL = process.env.GAS_LOG_URL;

client.once(Events.ClientReady, () => {
  console.log(`${client.user.tag} でログイン中`);
  client.user.setActivity("第二の人生v3.0.1", { type: 0 }); // ← これを追加
    
  // 🔔 ライブ予約チェック（定期実行）
  setInterval(() => checkLiveUpcoming(client), 3 *60 * 1000); // 3分ごと

  // 🔔 RSS動画チェック（定期実行）
  setupRSSWatcher(client);
});

const delegateHandlers = {
  postMonthlyEventsHandler: async (message) => {
    await postMonthlyEvents(message.channel);
  },
  remindCurrentEventsHandler: async (message) => {
    await remindCurrentEvents(message.channel);
  }
};

async function saveSummarizedLog(userInput, botReply, userId, username = "") {
  const payload = {
    userId,
    username,
    userSummary: userInput,
    botSummary: botReply,
    mode: "save"
  };

  const res = await fetch(GAS_LOG_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  const text = await res.text();
  console.log("[LogGAS Save] Response:", text);
}

async function postToGAS(payload) {
  const res = await fetch(GAS_LOG_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  return await res.text();
}

// 要約ログ取得用
async function getFromLogGAS(payload) {
  const res = await fetch(GAS_LOG_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  const text = await res.text();
  console.log("[LogGAS] Response text:", text);

  try {
    return JSON.parse(text);
  } catch (err) {
    console.error("[LogGAS] JSON parse error:", err);
    return [];
  }
}

function weightedRandom(arr) {
  const total = arr.reduce((sum, obj) => sum + (obj.weight || 1), 0);
  let rand = Math.random() * total;
  for (const obj of arr) {
    rand -= obj.weight || 1;
    if (rand <= 0) return obj;
  }
  return arr[arr.length - 1]; // 念のため最後にフォールバック
}

function logText(label, value) {
  console.log(`=== ${label} ===`);
  console.log(value);
  console.log("===================");
}

client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot) return;

  // ① メンションがあれば、Gemini に送る（ジャンル判定あり）
  if (message.mentions.has(client.user)) {
    try {
      const userInput = message.content;
      const isSky = /Sky|キャンマラ|星を紡ぐ|エリア|ひだね|火種|光のかけら|キャンドル|わっくす|雨林|捨て地|孤島|峡谷/.test(userInput);
      const areaName = isSky ? detectAreaName(userInput) : null;

      let relevantData = [];
      let areaDataText = "";
      let aliasText = "";

      let recentLogsText = "";
      try {
        const pastLogs = await getFromLogGAS({
          userId: message.author.id,
          mode: "get"
        });        
        const last5 = pastLogs.slice(-5).map((log, i) =>
          `${i + 1}. ユーザー「${log.userSummary}」→Bot「${log.botSummary}」`
                                            );        
        if (last5.length > 0) {
          recentLogsText = `【過去の会話ログ】\n${last5.join("\n")}\n`;
        }        
      } catch (err) {
      console.warn("過去ログ取得エラー:", err);
    }

      // 🔹 Sky系の場合のみ JSONデータ参照
      if (isSky && areaName) {
        try {
          const filePath = path.join(__dirname, "data", `fire_seeds_${areaName}.json`);
          const json = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
          relevantData = extractRelevantSpots(json, userInput);
          if (relevantData.length === 0) relevantData = json.locations;

          areaDataText = `\n【${areaName}の火種情報】\n${JSON.stringify(json)}`;
          aliasText = `
【用語補足】
・火種＝光のかけら＝かけら＝ひかり＝ワックス
・捨て地＝捨地＝すてち
・草原＝そうげん
・雨林＝うりん
・書庫＝しょこ
・孤島＝ことう
・峡谷＝きょうこく
・DC＝大キャン＝大キャンドル
・音楽＝音楽堂の音楽チャレンジの事
`;
        } catch (err) {
          console.error(`❌ ${areaName} のデータ読み込み失敗`, err);
        }
      }

      // 🔹 Geminiへのプロンプト作成
      const prompt = `
あなたは親しみやすい会話Botです。
以下の情報をもとに、ユーザーの質問に的確かつ自然に答えてください。

---
${recentLogsText ? recentLogsText : ""}
${aliasText ? `${aliasText}\n` : ""}

【ユーザーの発言】
${userInput}
${areaDataText}

${relevantData.length > 0 ? `【参照データ】\n${JSON.stringify(relevantData, null, 2)}` : ""}

【あなたの発言の注意点】
・過去の会話を参考に自然に返す。
・過去情報は無理に会話に入れない。
・妄想で語らない。ソースのある事実ベースでのみ語る。
・分からないことは、分からないとはっきり言う。
・返答は、ユーザーのトーンに合わせて自然に。
・だいたい200文字以内。
`;

      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }]
      });

      const reply = result.response.text();
      await message.reply(reply);

      // 🔹 要約ログ保存（ユーザーとBotのやり取り）
      await saveSummarizedLog(userInput, reply, message.author.id, message.author.username);

    } catch (error) {
      console.error("Gemini APIエラー:", error);
      await message.reply("⚠️ Gemini APIとの通信でエラーが発生しました。");
    }
    return; // ★ Gemini使ったら responses 側には行かせない
  }

  // ② responses.js の pattern にマッチするかチェック（メンションないとき）
  for (const { pattern, responses: res, type, id } of responses) {
    if (pattern.test(message.content)) {
      switch (type) {

        case "static": // 候補を全て送信。ノーマル
          const staticResponses = Array.isArray(res) ? res : [res];
          for (const r of staticResponses) {
            if (r && typeof r === "string" && r.trim() !== "") {
              await message.channel.send(r);
            }
          }
          break;

        case "random": // ランダム表示。複数可
          const rand = weightedRandom(res);
          const items = Array.isArray(rand) ? rand : [rand];
          for (const item of items) {
            if (typeof item === "string" && item.trim()) {
              await message.channel.send(item);
            }
          }
          break;

        case "progressive": // 1つ表示→削除。次を表示→削除 ×n
          for (const r of res) {
            const sent = await message.channel.send(r);
            await delay(3000);
            await sent.delete().catch(() => {});
          }
          break;

        case "function": // 実行用
          if (typeof res === "function") {
            const Fresult = await res(message);
            if (Fresult && typeof Fresult === "string" && Fresult.trim() !== "") {
              await message.channel.send(Fresult);
            }
          }
          break;

        case "weighted": // ランダム。ただし確率の重みを考慮
          const wresult = weightedRandom(res);
          const texts = Array.isArray(wresult.texts) ? wresult.texts : [wresult.text];
          for (const t of texts) {
            if (t?.trim()) await message.channel.send(t);
          }
          break;

        case "reverse-delete": // 1つずつ全部表示 → 1つずつ削除
          const messages = [];
          for (const r of res) messages.push(await message.channel.send(r));
          for (const m of messages.reverse()) {
            await delay(2000);
            await m.delete().catch(() => {});
          }
          break;

        case "delegate": // 特定関数を委任呼び出し
          if (id && typeof delegateHandlers[id] === "function") {
            await delegateHandlers[id](message);
          } else {
            console.warn(`⚠ delegateHandler "${id}" が見つかりません`);
          }
          break;
      }
      return; // responses にヒットしたら Gemini 側には行かない
    }
  }
});

const fs = require('fs');
const path = require('path');

// エリア名のマッピング（別名対応）
const areaAlias = {
  "捨て地": ["捨地", "すてち", "すてっち"],
  "雨林": ["うりん"],
  "草原": ["そうげん"],
  "孤島": ["ことう"],
  "峡谷": ["きょうこく"],
  "書庫": ["しょこ"],
  "天空": ["てんくう"],
  "海ホーム": ["旧ホーム", "ホーム"],
  "花鳥卿": ["かちょう", "花鳥", "かちょうきょう"],
  "アリスカフェ": ["アリスエリア", "アリス", "ありす"],
  "ソーシャルライト・他": ["ソーシャル", "ならい", "ウニ", "ウナギ", "シャード", "赤石", "隠者", "パン", "貝", "焚火", "レース", "花束", "シャード", "虹"]
};

// 別名を標準名に変換
function detectAreaName(text) {
  for (const [standard, aliases] of Object.entries(areaAlias)) {
    if ([standard, ...aliases].some(keyword => text.includes(keyword))) {
      return standard;
    }
  }
  return null;
}

// 関連スポットだけ抽出
function extractRelevantSpots(json, text) {
  return json.locations.filter(loc =>
    text.includes(loc.zone) || text.includes(loc.spot)
  );
}

client.on(Events.VoiceStateUpdate, async (oldState, newState) => {
  console.log("VC Update:", {
    old: oldState.channelId,
    new: newState.channelId,
  });

  const guildId = oldState.guild.id;
  const channel = oldState.channel || newState.channel;

  // === VCに入った最初の1人の処理 ===
  if (
    newState.channel &&
    newState.channel.id === VOICE_CHANNEL_ID &&
    oldState.channelId !== newState.channelId &&
    newState.channel.members.size === 1
  ) {
    try {
      const textChannel = newState.guild.channels.cache.get(VC_NOTIFY_CHANNEL_ID);
      if (textChannel && textChannel.isTextBased()) {
        const msg = await textChannel.send("VCが開始されました！🎧\nhttps://discord.gg/PpugjHBgDB");
        vcStartMessages.set(guildId, msg.id);
      }
    } catch (err) {
      console.error("VC開始メッセージ送信エラー:", err);
    }
  }

  // === VCから最後の1人が抜けたときの処理 ===
  if (
    channel &&
    channel.id === VOICE_CHANNEL_ID &&
    oldState.channelId !== newState.channelId &&
    channel.members.size === 0 &&
    vcStartMessages.has(guildId)
  ) {
    try {
      const textChannel = channel.guild.channels.cache.get(VC_NOTIFY_CHANNEL_ID);
      const msgId = vcStartMessages.get(guildId);
      if (textChannel && textChannel.isTextBased() && msgId) {
        const msg = await textChannel.messages.fetch(msgId);
        await msg.delete().catch(() => {});
        await textChannel.send("おつかれさまでした！🥱");
        vcStartMessages.delete(guildId);
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
      .filter(msg =>
        msg.author.id === client.user.id &&
        msg.content === "おつかれさまでした！🥱"
             )
      .sort((a, b) => b.createdTimestamp - a.createdTimestamp); // 新しい順

    if (targets.size > 1) {
      const [, ...oldOnes] = targets.map(msg => msg); // 最新1件を除いて削除
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
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});

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
