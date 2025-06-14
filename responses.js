// responses.js
module.exports = [
  {
    pattern: /こんにちは|やあ|こんちゃ/,
    responses: ["やあ！", "こんにちは～", "元気？", "いやっほー！", "こんにちは！こんばんは！", "ぐへへへへ"],
    type: "random"
  },
  { pattern: /きょへ。?は/,
    responses: ["ピカチュウ窓主"],
    type: "static"
  },
  { pattern: /たっつんは/,
    responses: ["ハゲ"],
    type: "static"
  },
  { pattern: /VC開始/,
    responses: ["chatroom1にて通話が開始されました！\nhttps://discord.gg/PpugjHBgDB"],
    type: "static"
  },
  {
    pattern: /テスト/,
    responses: ["これはテストメッセージです。", "すべて正常に動作しています。"],
    type: "static"
  },
  {
    pattern: /うんこ|💩/,
    responses: ["う", "ん", "こ", "だ", "な", "♪"],
    type: "reverse-delete"
  },
  {
    pattern: /せいは/,
    responses: [
      "せいさんはですね・・・。",
      "言いたい事たくさんあるんですよ。",
      "結構長くなるので覚悟してくださいね？",
      "何から話そうかな。",
      "まずは僕と青酸がはじめて出会った日の事ですが、",
      "あれはまだ僕たちが高3だった頃…の2年前…。",
      "続きは課金してね！♡"
    ],
    type: "progressive"
  }
];
