const { session } = require("electron");

const CHROME_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36";

const FIREFOX_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:134.0) Gecko/20100101 Firefox/134.0";

const CHROME_SEC_CH_UA = '"Chromium";v="134", "Google Chrome";v="134", "Not_A Brand";v="24"';

const FIREFOX_PARTITIONS = new Set([
  "persist:connect-gmail-v3",
  "persist:connect-gmail-v4",
  "persist:connect-browser-v1",
  "persist:connect-google-v1",
  "persist:connect-youtube-v1",
  "persist:connect-drive-v1",
  "persist:connect-gemini-v1",
]);

const PARTITIONS = [
  ...FIREFOX_PARTITIONS,
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

function isGoogleHost(url) {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return (
      host.includes("google.") ||
      host.includes("gmail.") ||
      host.endsWith("google.com") ||
      host.includes("youtube.") ||
      host === "youtu.be"
    );
  } catch {
    return false;
  }
}

function hardenSession(partition) {
  const ses = session.fromPartition(partition);
  const useFirefoxDefault = FIREFOX_PARTITIONS.has(partition);
  const defaultUa = useFirefoxDefault ? FIREFOX_UA : CHROME_UA;
  try {
    ses.setUserAgent(defaultUa);
  } catch {
  }

  try {
    ses.webRequest.onBeforeSendHeaders((details, callback) => {
      const headers = { ...details.requestHeaders };
      const useFirefox = useFirefoxDefault || isGoogleHost(details.url);
      const ua = useFirefox ? FIREFOX_UA : CHROME_UA;
      headers["User-Agent"] = ua;
      if (useFirefox) {
        delete headers["sec-ch-ua"];
        delete headers["sec-ch-ua-mobile"];
        delete headers["sec-ch-ua-platform"];
        delete headers["sec-ch-ua-full-version-list"];
        delete headers["Sec-CH-UA"];
        delete headers["Sec-CH-UA-Mobile"];
        delete headers["Sec-CH-UA-Platform"];
        delete headers["Sec-CH-UA-Full-Version-List"];
      } else {
        headers["sec-ch-ua"] = CHROME_SEC_CH_UA;
        headers["sec-ch-ua-mobile"] = "?0";
        headers["sec-ch-ua-platform"] = '"Windows"';
      }
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
  FIREFOX_UA,
};