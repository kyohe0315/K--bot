
const fs = require("fs");
const path = require("path");
const FILE_PATH = path.join(__dirname, "../conversation_data.json");

function loadHistory() {
  if (!fs.existsSync(FILE_PATH)) return {};
  try {
    const data = fs.readFileSync(FILE_PATH, "utf-8");
    return JSON.parse(data);
  } catch (e) {
    console.error("会話履歴読み込みエラー:", e);
    return {};
  }
}

function saveHistory(data) {
  try {
    fs.writeFileSync(FILE_PATH, JSON.stringify(data, null, 2), "utf-8");
  } catch (e) {
    console.error("会話履歴保存エラー:", e);
  }
}

module.exports = {
  loadHistory,
  saveHistory,
};
