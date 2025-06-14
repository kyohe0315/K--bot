const { loadHistory, saveHistory } = require("./jsonStorage");
const fetch = require("node-fetch"); // ← これを追加！

const MAX_HISTORY = 15;
const GAS_WEBHOOK_URL = "https://script.google.com/macros/s/あなたのID/exec"; // ← 差し替え！

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
