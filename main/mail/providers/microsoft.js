const PROVIDER_ID = "microsoft";

async function notReady(action) {
  return {
    ok: false,
    error: `Microsoft mail (${action}) is not implemented yet. Gmail is available now.`,
    comingSoon: true,
  };
}

module.exports = {
  id: PROVIDER_ID,
  label: "Microsoft 365 / Outlook",
  startOAuth: () => notReady("connect"),
  refreshAccessToken: () => notReady("refresh"),
  getProfile: () => notReady("profile"),
  listMessages: () => notReady("list"),
  getMessage: () => notReady("get"),
  listHistory: () => notReady("history"),
};
