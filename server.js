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
  client.user.setActivity("第二の人生v2.9", { type: 0 }); // ← これを追加
  //postMonthlyEvents(); // ← デバッグ用
  //remindCurrentEvents(); // ← デバッグ用← これを追加
});

const { postMonthlyEvents, remindCurrentEvents } = require("./utils/calendar");

const delegateHandlers = {
  postMonthlyEvents: async (message) => {
    await postMonthlyEvents(message.channel);
  },
  remindCurrentEvents: async (message) => {
    await remindCurrentEvents(message.channel);
  }
};

function weightedRandom(arr) {
  const total = arr.reduce((sum, obj) => sum + (obj.weight || 1), 0);
  let rand = Math.random() * total;
  for (const obj of arr) {
    rand -= obj.weight || 1;
    if (rand <= 0) return obj;
  }
  return arr[arr.length - 1]; // 念のため最後にフォールバック
}


client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot) return;

  // ① responses.js のパターンチェック＆処理
  for (const { pattern, responses: res, type } of responses) {
    if (pattern.test(message.content)) {
      switch (type) {
        case "static":
          const staticResponses = Array.isArray(res) ? res : [res];
          for (const r of staticResponses) {
            if (r && typeof r === "string" && r.trim() !== "") {
              await message.channel.send(r);
            }
          }
          break;

        case "random":
          const r = res[Math.floor(Math.random() * res.length)];
          if (r && typeof r === "string" && r.trim() !== "") {
            await message.channel.send(r);
          }
          break;

        case "progressive":
          for (const r of res) {
            const sent = await message.channel.send(r);
            await delay(3000);
            await sent.delete().catch(() => {});
          }
          break;

        case "function":
          if (typeof res === "function") {
            const result = await res(message);
            if (result && typeof result === "string" && result.trim() !== "") {
              await message.channel.send(result);
            }
          }
          break;

        case "weighted": {
          const result = weightedRandom(res);
          const texts = Array.isArray(result.texts) ? result.texts : [result.text];
          for (const t of texts) {
            if (t?.trim()) await message.channel.send(t);
          }
          break;
        }

        case "reverse-delete": {
          const messages = [];
          for (const r of res) messages.push(await message.channel.send(r));
          for (const m of messages.reverse()) {
            await delay(2000);
            await m.delete().catch(() => {});
          }
          break;
        }
          
        case "delegate":
          if (id && typeof delegateHandlers[id] === "function") {
            await delegateHandlers[id](message); // ← ここで実行
          } else {
            console.warn(`⚠ delegateHandler "${id}" が見つかりません`);
          }
          break;
      }
      return; // responses にヒットしたら Gemini 側には行かない
    }
  }

  // ② Gemini に送る条件：メンションかつ Sky関連ワードが含まれている
  const isSkyTopic = /Sky|キャンマラ|星を紡ぐ|エリア|ひだね|火種|光のかけら|キャンドル|わっくす|雨林|捨て地|孤島|峡谷/.test(message.content);

  if (message.mentions.has(client.user) && isSkyTopic) {
    try {
      const userInput = message.content;

      // --- エリア検出・JSON取得 ---
      const areaName = detectAreaName(userInput);
      let relevantData = [];

      if (areaName) {
        const filePath = path.join(__dirname, "data", `fire_seeds_${areaName}.json`);
        const json = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        relevantData = extractRelevantSpots(json, userInput);
        if (relevantData.length === 0) relevantData = json.locations;
      }

      const aliasText = isSkyTopic ? `
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
` : "";
      
      let areaDataText = "";
      const matchedArea = areaName;
      if (matchedArea) {
        try {
          const areaFilePath = path.join(__dirname, "data", `fire_seeds_${matchedArea}.json`);
          const areaJson = JSON.parse(fs.readFileSync(areaFilePath, "utf-8"));
          areaDataText = `\n【${matchedArea}の火種情報】\n${JSON.stringify(areaJson)}`;
        } catch (err) {
          console.error(`❌ ${matchedArea} のデータ読み込み失敗`, err);
        }
      }

      // --- プロンプト生成 ---
      const prompt = `
あなたは親しみやすい会話Botです。
以下の情報をもとに、ユーザーの質問に的確かつ自然に答えてください。

---
【用語補足】
${aliasText}

【ユーザーの発言】
${message.content}

${areaDataText}

【参照データ（該当エリア）】
${JSON.stringify(relevantData, null, 2)}

【あなたの発言の注意点】
・妄想で語らない。ソースのある事実ベースでのみ語る。
・分からないことは、分からないとはっきり言う。
・返答は、ユーザーのトーンに合わせて自然に。
・だいたい200文字以内。
`;

      const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });
      const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }]
      });

      await message.reply(result.response.text());
    } catch (error) {
      console.error("Gemini APIエラー:", error);
      await message.reply("⚠️ Gemini APIとの通信でエラーが発生しました。");
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
  const guild = newState.guild;

  // ✅ 指定VCに人が入った時だけ通知を送る
  if (!oldState.channel && newState.channelId === VOICE_CHANNEL_ID) {
    console.log("✅ VCに誰かが入った");
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
