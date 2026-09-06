(function () {
  function isFullDesktop() {
    return typeof window.mySpace?.pickExecutable === "function";
  }

  window.MySpaceDesktop = {
    isFullDesktop,
  };
})();