// 先頭に追加
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

const PROFILE_API = "https://script.google.com/macros/s/AKfycbyskcoqd-VvLLtSZdLvWxxdyIyue9qZ7whOaY7895s8_0rz-FcPWWimoNpVrrTAV_E_kQ/exec"; // プロフィールGASのURLに置き換えてください

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

// Geminiプロンプト生成（例）
async function generateGeminiPrompt(userId, messages) {
  const profile = await getUserProfile(userId);

  const nickname = profile?.nickname || "あなた";
　const personality = profile?.personality || "普通";
  const likes = profile?.likes || "特になし";

  const prompt = `
あなたはDiscord上で活動する、親しみやすく面白い会話Botです。
skyやスマブラの知識が多くあります。
以下の情報を元に、ユーザーとの自然で楽しい会話を行ってください。

---
■ ユーザー情報
呼び方：${nickname}
性格：${personality}
好きなもの：${likes}

■ 最近の会話
${messages.map(msg => msg.content).join("\n")}

■ あなたの返事のルール：
・多少感情表現を含める
・お堅くなりすぎず、フレンドリーすぎず。
・長くても200文字程度の返信。長くなる情報の場合は超えてもOK
・絶対に妄想で語らない。ソースのある事実のみで会話する事。
・知らない事、分からない事は素直に分からない。と言う事。
・※プロフィール情報が未入力（undefined）の場合、話題に出さずユーザーの発言に対して自然に会話してください。
`;

  return prompt;
}


module.exports = {
  getUserProfile,
  generateGeminiPrompt
};
