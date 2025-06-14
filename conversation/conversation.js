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

