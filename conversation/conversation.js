// 先頭に追加
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

const PROFILE_API = "https://script.google.com/macros/s/AKfycbx-HQWZxP3KjRkwKhy6qjuQ_jrebKvoZjbtIZL_GXol87OrRrZwbzsWe1S4Rl2chcBe/exec"; // プロフィールGASのURLに置き換えてください
const SUMMARY_API = "https://script.google.com/macros/s/AKfycbz7UJ6OtYJ8LE0sulZl7jiPBgpJksRshcnPD3F1gAuBORtStD-MZ_KWNX6kYEcJD2Qh/exec"; // 会話要約GASのURLに置き換えてください

// プロフィール取得関数
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

// 会話要約取得関数
async function getConversationSummary(userId) {
  try {
    const res = await fetch(`${SUMMARY_API}?userId=${userId}`);
    const json = await res.json();
    return json.summaries?.join("\n") || "";
  } catch (e) {
    console.error("要約取得失敗", e);
    return "";
  }
}

// Geminiプロンプト生成（例）
async function generateGeminiPrompt(userId, messages) {
  const profile = await getUserProfile(userId);
  const summary = await getConversationSummary(userId);

  let profileText = "";
  if (profile) {
    profileText = `このユーザーは「${profile.nickname}」と呼ばれたい。\n性格：${profile.personality}\n好きなもの：${profile.likes}\n`;
  }

  const prompt = `
${profileText}
【最近の会話要約】
${summary}

【ユーザーの発言】
${messages.map(msg => msg.content).join("\n")}
`;

  return prompt;
}

module.exports = {
  getUserProfile,
  getConversationSummary,
  generateGeminiPrompt
};
