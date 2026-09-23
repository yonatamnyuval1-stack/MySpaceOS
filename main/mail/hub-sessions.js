const { session } = require("electron");
const CHROME_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36";
const CHROME_SEC_CH_UA = '"Chromium";v="134", "Google Chrome";v="134", "Not_A Brand";v="24"';
const PARTITIONS = [
  "persist:connect-gmail-v5",
  "persist:connect-browser-v2",
  "persist:connect-google-v2",
  "persist:connect-youtube-v2",
  "persist:connect-drive-v2",
  "persist:connect-gemini-v2",
  "persist:connect-outlook-v3",
  "persist:connect-yahoo-v3",
  "persist:connect-whatsapp-v3",
  "persist:connect-telegram-v3",
  "persist:connect-discord-v3",
  "persist:connect-messenger-v3",
  "persist:connect-instagram-v3",
  "persist:connect-x-v3",
  "persist:connect-slack-v3",
  "persist:connect-linkedin-v3",
  "persist:connect-teams-v3",
  "persist:connect-edge-v1",
  "persist:connect-facebook-v1",
  "persist:connect-reddit-v1",
  "persist:connect-tiktok-v1",
  "persist:connect-ollama-v1",
  "persist:connect-chatgpt-v1",
  "persist:connect-claude-v1",
  "persist:connect-spotify-v1",
  "persist:connect-netflix-v1",
  "persist:connect-github-v1",
  "persist:connect-notion-v1",
  "persist:connect-onedrive-v1",
];

function hardenSession(partition) {
  const ses = session.fromPartition(partition);
  try {
    ses.setUserAgent(CHROME_UA);
  } catch {
  }

  try {
    ses.webRequest.onBeforeSendHeaders((details, callback) => {
      const headers = { ...details.requestHeaders };
      headers["User-Agent"] = CHROME_UA;
      headers["sec-ch-ua"] = CHROME_SEC_CH_UA;
      headers["sec-ch-ua-mobile"] = "?0";
      headers["sec-ch-ua-platform"] = '"Windows"';
      callback({ requestHeaders: headers });
    });
  } catch (err) {
    console.warn("[hub-sessions] webRequest failed", partition, err?.message || err);
  }
}

function initConnectSessions() {
  for (const partition of PARTITIONS) {
    hardenSession(partition);
  }
}

module.exports = {
  initConnectSessions,
  hardenSession,
  CHROME_UA,
};