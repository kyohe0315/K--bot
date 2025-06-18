const fetch = require("node-fetch");

// 自分のAPIキーとチャンネルIDに置き換えてね
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
const CHANNEL_ID = "UCxxxxxxxxxxxxxxxx"; // 推しのチャンネルID
let lastNotifiedVideoId = null;

async function checkLiveUpcoming(client) {
  const url = `https://www.googleapis.com/youtube/v3/search?key=${YOUTUBE_API_KEY}&channelId=${CHANNEL_ID}&part=snippet&eventType=upcoming&type=video&order=date&maxResults=1`;

  try {
    const res = await fetch(url);
    const data = await res.json();
    const latest = data.items?.[0];

    if (!latest) return;

    const videoId = latest.id.videoId;
    const title = latest.snippet.title;
    const thumbnail = latest.snippet.thumbnails?.high?.url;

    // 同じ動画IDなら通知済みと判断
    if (videoId === lastNotifiedVideoId) return;
    lastNotifiedVideoId = videoId;

    const channel = await client.channels.fetch("送信先テキストチャンネルID");
    await channel.send({
      content: `📢 ライブ予約発見！\n▶️ **${title}**\nhttps://www.youtube.com/watch?v=${videoId}`,
      files: [thumbnail]
    });

  } catch (err) {
    console.error("ライブ予約チェック失敗:", err);
  }
}

module.exports = { checkLiveUpcoming };
