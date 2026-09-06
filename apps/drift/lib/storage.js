window.DriftStorage = window.DriftStorage || {};

window.DriftStorage.load = async function () {
  const res = await window.Drift.invoke("storage.load");
  return res.data;
};

window.DriftStorage.save = async function (data) {
  await window.Drift.invoke("storage.save", { data });
};
