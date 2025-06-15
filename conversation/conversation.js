// 先頭に追加
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

const PROFILE_API = "https://script.google.com/macros/s/AKfycbw1mxYrWAJGi7nW6liN4grvoUqTJ2vkNVxGVT3eCh3BfuyRIanSM5JH7hzTl7PLylEvQA/exec"; // プロフィールGASのURLに置き換えてください
const SUMMARY_API = "https://script.google.com/macros/s/AKfycby7Cfr3d7yqeYOPoIte4WjBgSx_WLsh0_64ahGBTvA7-3L_gRIaD04OXwXORW3kNxeerw/exec"; // 会話要約GASのURLに置き換えてください

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

  const nickname = profile?.nickname || "ユーザー";
//  const personality = profile?.personality || "普通";
//  const likes = profile?.likes || "特になし";

  const prompt = `
あなたはDiscord上で活動する、親しみやすく面白い会話Botです。
skyやスマブラの知識が多くあります。
以下の情報を元に、ユーザーとの自然で楽しい会話を行ってください。

---
■ ユーザー情報
呼び方：${nickname}
性格：${personality}
好きなもの：${likes}

■ 最近の会話要約：
${summary || "なし"}

■ ユーザーの発言：
${messages.map(msg => msg.content).join("\n")}

■ あなたの返事のルール：
・多少感情表現を含める
・お堅くなりすぎず、フレンドリーすぎず。
・長くても200文字程度の返信。長くなる情報の場合は超えてもOK
・※プロフィール情報が未入力の場合（たとえば「好きなもの」「名前」が空欄の時）、無理に話題に出さず自然に会話してください。
`;

  return prompt;
}


module.exports = {
  getUserProfile,
  getConversationSummary,
  generateGeminiPrompt
};
