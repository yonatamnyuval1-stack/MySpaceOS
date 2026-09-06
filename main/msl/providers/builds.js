const { handleBuildsInvoke } = require("../../apps/builds-ipc");

async function listProjects(input = {}) {
  const res = await handleBuildsInvoke("projects.list", {
    q: input.q || input.query,
    categoryId: input.categoryId || input.category,
    favorites: input.favorites || input.favorite,
  });
  if (!res?.ok) return res;
  const projects = (res.projects || []).map((p) => ({
    id: p.id,
    name: p.name,
    categoryId: p.categoryId,
    icon: p.icon,
    iconId: p.iconId || "",
    description: p.description || "",
    rootPath: p.rootPath || "",
    stack: p.stack || [],
    favorite: Boolean(p.favorite),
    builtAt: p.builtAt || "",
    fileCount: p.fileCount || 0,
  }));
  return {
    ok: true,
    projects,
    count: projects.length,
    categories: res.categories || [],
  };
}

async function getProject(input = {}) {
  const id = String(input.id || input.name || input.project || "").trim();
  if (!id) return { ok: false, error: "Missing project id or name" };
  return handleBuildsInvoke("projects.get", { id, name: input.name, project: input.project });
}

async function createProject(input = {}) {
  const name = String(input.name || "").trim();
  if (!name) return { ok: false, error: "Missing project name" };
  return handleBuildsInvoke("projects.create", input);
}

async function openFolder(input = {}) {
  const folder = String(input.path || input.rootPath || "").trim();
  if (!folder) return { ok: false, error: "Missing path" };
  return handleBuildsInvoke("folder.open", { path: folder });
}

const CAPABILITIES = [
  {
    id: "builds.projects.list",
    kind: "query",
    provider: "builds",
    title: "List builds projects",
    description: "Projects from Builds with optional search/filter",
    handler: listProjects,
  },
  {
    id: "builds.projects.get",
    kind: "query",
    provider: "builds",
    title: "Get project",
    description: "Fetch one Builds project by id or name",
    handler: getProject,
  },
  {
    id: "builds.projects.create",
    kind: "action",
    provider: "builds",
    title: "Create project",
    description: "Create a new Builds project",
    handler: createProject,
  },
  {
    id: "builds.folder.open",
    kind: "action",
    provider: "builds",
    title: "Open project folder",
    description: "Open a linked project folder in the OS file manager",
    handler: openFolder,
  },
];

module.exports = { CAPABILITIES };
