const Parser = require("rss-parser");
const parser = new Parser();
const YOUTUBE_NOTIFY_CHANNEL_ID = process.env.YOUTUBE_NOTIFY_CHANNEL_ID;
const RSS_URL = process.env.RSS_URL;

let latestVideoId = null;

function setupRSSWatcher(client) {
  setInterval(async () => {
    try {
      const feed = await parser.parseURL(RSS_URL);
      const latest = feed.items[0];

      if (!latest || !latest.id) return;

      if (latest.id !== latestVideoId) {
        latestVideoId = latest.id;

        const channel = await client.channels.fetch(YOUTUBE_NOTIFY_CHANNEL_ID);
        if (channel && channel.isTextBased()) {
          await channel.send(`# きょへの新着動画！\n${latest.link}`);
        }
      }
    } catch (err) {
      console.error("RSSチェック失敗:", err);
    }
  }, 5 * 60 * 1000); // 5分ごとにチェック
}

module.exports = setupRSSWatcher;
