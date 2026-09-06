const { runPowerShell, toArray } = require("./exec-utils");

async function scanEnvironment() {
  const scannedAt = new Date().toISOString();

  if (process.platform !== "win32") {
    return {
      ok: true,
      scannedAt,
      variables: [],
      pathEntries: [],
      summary: { total: 0 },
      note: "Environment scan is supported on Windows only.",
    };
  }

  try {
    const raw = await runPowerShell(
      "Get-ChildItem Env: | Select-Object Name, Value | Sort-Object Name | ConvertTo-Json -Compress"
    );

    const variables = toArray(raw)
      .filter((v) => v?.Name != null)
      .map((v) => {
        const value = String(v.Value ?? "");
        return {
          name: v.Name,
          value,
          length: value.length,
          key: `env-${v.Name}`,
          isPath: v.Name.toUpperCase() === "PATH",
        };
      });

    const pathVar = variables.find((v) => v.isPath);
    const pathEntries = pathVar
      ? pathVar.value
          .split(";")
          .map((p) => p.trim())
          .filter(Boolean)
          .map((p, i) => ({ index: i + 1, path: p, key: `path-${i}` }))
      : [];

    const userPrefix = variables.filter((v) =>
      /^(USER|HOME|APPDATA|LOCALAPPDATA|TEMP|TMP|USERNAME|COMPUTERNAME|OS|PROCESSOR)/i.test(v.name)
    ).length;

    return {
      ok: true,
      scannedAt,
      variables,
      pathEntries,
      summary: {
        total: variables.length,
        pathCount: pathEntries.length,
        userRelated: userPrefix,
      },
    };
  } catch (err) {
    return { ok: false, error: err.message || "Environment scan failed" };
  }
}

module.exports = { scanEnvironment };
