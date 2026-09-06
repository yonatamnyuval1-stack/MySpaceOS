(function (root) {
  function bridge() {
    if (root.Link) return root.Link;
    if (!root.myApp?.invoke) return null;
    const mod = root.myApp.moduleId;
    return {
      routes: () => root.myApp.invoke("link.routes.list", {}),
      send: (args) => root.myApp.invoke("link.command.send", args || {}),
      publish: (args) => root.myApp.invoke("link.event.publish", args || {}),
      subscribe: (topics) =>
        root.myApp.invoke("link.event.subscribe", {
          topics: Array.isArray(topics) ? topics : [topics],
        }),
      onEvent: (cb) => {
        if (!root.myApp.onLinkEvent) return () => {};
        return root.myApp.onLinkEvent(cb);
      },
      onCommand: () => {
        throw new Error("Use window.Link.onCommand from preload");
      },
      moduleId: mod,
    };
  }

  async function send(target, verb, args) {
    const b = bridge();
    if (!b) throw new Error("Pulse bridge unavailable");
    return b.send({ target, verb, args: args || {} });
  }

  async function publish(topic, payload) {
    const b = bridge();
    if (!b) throw new Error("Pulse bridge unavailable");
    return b.publish({ topic, payload: payload || {} });
  }

  root.Pulse = { bridge, send, publish };
})(typeof window !== "undefined" ? window : globalThis);
