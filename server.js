const express = require("express");
const app = express();
const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => {
  res.status(200).send("Hello from root");
});

app.get("/healthz", (req, res) => {
  res.status(200).send("OK");
});

app.listen(PORT, () => {
  console.log(`✅ サーバー起動完了 on port ${PORT}`);
  console.log(`✅ Listening on http://localhost:${PORT}`);
});
