const MAX_HISTORY = 15;
const userConversations = new Map();

function addToHistory(userId, message) {
  const history = userConversations.get(userId) || [];
  history.push(message);
  if (history.length > MAX_HISTORY) {
    history.shift();
  }
  userConversations.set(userId, history);
}

function getConversationPrompt(userId) {
  const history = userConversations.get(userId) || [];
  return history.join("\n");
}

module.exports = {
  addToHistory,
  getConversationPrompt,
};
