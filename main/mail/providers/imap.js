const PROVIDER_ID = "imap";

async function notReady(action) {
  return {
    ok: false,
    error: `IMAP (${action}) is not implemented yet. use Gmail OAuth for now.`,
    comingSoon: true,
  };
}

module.exports = {
  id: PROVIDER_ID,
  label: "IMAP",
  startOAuth: () => notReady("connect"),
  refreshAccessToken: () => notReady("refresh"),
  getProfile: () => notReady("profile"),
  listMessages: () => notReady("list"),
  getMessage: () => notReady("get"),
  listHistory: () => notReady("history"),
};
