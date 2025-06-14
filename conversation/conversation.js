const { loadHistory, saveHistory } = require("./jsonStorage");
const fetch = require("node-fetch"); // ← これを追加！

const MAX_HISTORY = 15;
const GAS_WEBHOOK_URL = "https://script.google.com/macros/s/AKfycbzW_4EjWkTlYl2dzQdtOwP-O_seUqDEymefazelR0gmzHqyJW9E3SXmvnEjOkWGR9wX/exec"; // ← 差し替え！

// 読み込み
const userConversations = new Map(Object.entries(loadHistory()));

function addToHistory(userId, message) {
  const history = userConversations.get(userId) || [];
  history.push(message);
  if (history.length > MAX_HISTORY) history.shift();
  userConversations.set(userId, history);

  saveHistory(Object.fromEntries(userConversations));

  // 👇 GASに送信（最後の2発言を送る）
  if (history.length >= 2) {
    sendToGAS(userId, history.at(-2), history.at(-1));
  }
}

function getConversationPrompt(userId) {
  const history = userConversations.get(userId) || [];
  return history.join("\n");
}

// 👇 ここがGASに送る処理
async function sendToGAS(userId, message, reply) {
  try {
    await fetch(GAS_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId,
        message,
        reply,
      }),
    });
  } catch (err) {
    console.error("GAS送信エラー:", err);
  }
}

module.exports = {
  addToHistory,
  getConversationPrompt,
};

const PROFILE_API = "https://script.google.com/macros/s/AKfycbyoo2Cw1D5oibyASMa1U_-E6DhVr0SKrranWn-fyZ21WtMsvEgbLU5JGOB406Kxq_he/exec"; // GASのデプロイURL

async function getUserProfile(userId) {
  try {
    const res = await fetch(`${PROFILE_API}?userId=${userId}`);
    const json = await res.json();
    return json.error ? null : json;
  } catch (e) {
    console.error("プロフィール取得失敗", e);
    return null;
  }
}

