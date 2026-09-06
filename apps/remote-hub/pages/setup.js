window.RemoteHubPages = window.RemoteHubPages || {};

window.RemoteHubPages.setup = (function () {
  const { invoke } = window.RemoteHub;

  const page = document.getElementById("page-setup");

  async function scan() {
  }

  function bind() {
    page.querySelector("#btn-dl-tailscale")?.addEventListener("click", async () => {
      await window.RemoteHubHologram.run("Opening Tailscale", () => invoke("help.tailscale"));
    });
    page.querySelector("#btn-dl-rustdesk")?.addEventListener("click", async () => {
      await window.RemoteHubHologram.run("Opening RustDesk", () => invoke("help.rustdesk"));
    });
  }

  return { id: "setup", page, scan, bind };
})();
