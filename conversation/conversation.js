const { loadHistory, saveHistory } = require("./jsonStorage");
const MAX_HISTORY = 15;

// JSONをMapに読み込み
const userConversations = new Map(Object.entries(loadHistory()));

function addToHistory(userId, message) {
  const history = userConversations.get(userId) || [];
  history.push(message);
  if (history.length > MAX_HISTORY) history.shift();
  userConversations.set(userId, history);
  saveHistory(Object.fromEntries(userConversations));
}

function getConversationPrompt(userId) {
  const history = userConversations.get(userId) || [];
  return history.join("\n");
}

module.exports = {
  addToHistory,
  getConversationPrompt,
};

const fetch = require("node-fetch"); // 必要ならnpmでインストール

async function sendToGAS(userId, message, reply) {
  try {
    await fetch("https://script.google.com/macros/s/あなたのGAS_URL/exec", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId,
        message,
        reply,
      }),
    });
  } catch (e) {
    console.error("GAS送信エラー:", e);
  }
}

