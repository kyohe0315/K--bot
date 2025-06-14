// 元のコードの構造に基づいて、以下の機能を追加します：
// 1. 特定ワードで複数メッセージ → 時間差削除
// 2. 特定ワードでランダムレスポンス
// 3. おみくじ機能（ランダム選択 + 画像）

const { Client, GatewayIntentBits, Events } = require("discord.js");
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

client.once("ready", () => {
  console.log(`起動完了！`);
});

client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot) return;

  // 複数メッセージ投稿＆削除（"せいは"）
  if (/せいは/.test(message.content)) {
    const messages = [
      "せいさんはですね・・・。",
      "言いたい事たくさんあるんですよ。",
      "結構長くなるので覚悟してくださいね？",
      "何から話そうかな。",
      "まずは僕と青酸がはじめて出会った日の事ですが、",
      "あれはまだ僕たちが高3だった頃…の2年前…。",
    ];

    for (const [i, text] of messages.entries()) {
      const sent = await message.channel.send(text);
      setTimeout(() => sent.delete().catch(console.error), 3500 + i * 200);
    }

    setTimeout(() => {
      message.channel.send("続きは課金してね！♡");
    }, 3500 * messages.length);
    return;
  }

  // ランダムレスポンス（例：「疲れた」→元気づけ）
  if (/疲れた|しんどい/.test(message.content)) {
    const responses = [
      "元気出して！🥺",
      "ちょっと休憩しよ☕",
      "深呼吸、大事！🌿",
      "これ見て笑えよ → https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    ];
    const choice = responses[Math.floor(Math.random() * responses.length)];
    message.channel.send(choice);
    return;
  }

  // おみくじ機能
  if (/!おみくじ/.test(message.content)) {
    const results = [
      { text: "大吉！今日は最高の一日！", img: "https://example.com/daikichi.gif" },
      { text: "中吉！いいことあるかも！", img: "https://example.com/chukichi.gif" },
      { text: "凶！気をつけて！", img: "https://example.com/kyou.gif" },
    ];
    const choice = results[Math.floor(Math.random() * results.length)];
    await message.channel.send(choice.text);
    await message.channel.send(choice.img);
    return;
  }
});

client.login(process.env.TOKEN);
