window.LexiconStorage = window.LexiconStorage || {};

window.LexiconStorage.load = async function () {
  const res = await window.Lexicon.invoke("storage.load");
  return res.data || { settings: {} };
};

window.LexiconStorage.save = async function (data) {
  await window.Lexicon.invoke("storage.save", { data });
};