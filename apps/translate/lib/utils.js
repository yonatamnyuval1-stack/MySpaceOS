window.Translate = window.Translate || {};

window.Translate.escapeHtml = function (s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
};

window.Translate.invoke = async function (channel, args) {
  if (!window.myApp?.invoke) throw new Error("Open via My Space.");
  const result = await window.myApp.invoke(channel, args || {});
  if (result?.ok === false && result?.error) throw new Error(result.error);
  return result;
};

window.Translate.langLabel = function (code) {
  const lang = window.TranslateLangs?.getLanguage(code);
  if (!lang) return code;
  return lang.native !== lang.name ? `${lang.name} · ${lang.native}` : lang.name;
};

window.Translate.formatDate = function (iso) {
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
};

window.Translate.countWords = function (text) {
  return String(text || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
};

let activeSpeech = null;
let speechToken = 0;

window.Translate.stopSpeak = function () {
  speechToken++;
  if (activeSpeech) {
    activeSpeech.pause();
    activeSpeech.removeAttribute("src");
    activeSpeech = null;
  }
};

window.Translate.speak = async function (text, langCode) {
  const t = String(text || "").trim();
  if (!t) return false;

  window.Translate.stopSpeak();
  const token = ++speechToken;

  try {
    const res = await window.Translate.invoke("speech.speak", {
      text: t,
      lang: langCode && langCode !== "auto" ? langCode : "en",
    });

    for (const part of res.parts || []) {
      if (token !== speechToken) return false;
      await new Promise((resolve, reject) => {
        const audio = new Audio(`data:${res.mime || "audio/mpeg"};base64,${part}`);
        activeSpeech = audio;
        audio.onended = () => resolve();
        audio.onerror = () => reject(new Error("Playback failed"));
        audio.play().catch(reject);
      });
    }
    return true;
  } catch (err) {
    if (token === speechToken) console.warn("Speech:", err.message);
    return false;
  }
};

window.Translate.buildLangOptions = function (includeAuto) {
  const langs = includeAuto
    ? window.TranslateLangs.LANGUAGES
    : window.TranslateLangs.targetLanguages();
  return langs
    .map(
      (l) =>
        `<option value="${window.Translate.escapeHtml(l.code)}">${window.Translate.escapeHtml(l.native)} — ${window.Translate.escapeHtml(l.name)}</option>`
    )
    .join("");
};
