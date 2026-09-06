const { handleBuildsInvoke } = require("../apps/builds-ipc");
const { shellOpenPage } = require("./tools-shell");

const PROJECT_REF = {
  project: { type: "string", description: "Project id or name" },
  id: { type: "string", description: "Project id" },
  name: { type: "string", description: "Project name" },
};

const TEXT_EDIT_PROPS = {
  mode: {
    type: "string",
    description: "set | append | prepend | remove | replace (default set)",
  },
  text: { type: "string", description: "New text" },
  find: { type: "string", description: "Substring to find" },
  replace: { type: "string", description: "Replacement text" },
  all: {
    type: "boolean",
    description: "Replace/remove all occurrences (default true)",
  },
};

const BUILDS_TOOL_DEFS = [
  {
    name: "builds_list_projects",
    description:
      "List Builds projects. Filter by search text, category, or favorites.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search name, description, path, stack, tags" },
        category: {
          type: "string",
          description: "Category id or name",
        },
        favorites: { type: "boolean", description: "If true, only favorite projects" },
      },
    },
  },
  {
    name: "builds_get_project",
    description:
      "Get full Builds project details including notes, attachments, links, fields, and sub-categories. Catalog only: does not read/write disk files under rootPath.",
    parameters: {
      type: "object",
      properties: { ...PROJECT_REF },
    },
  },
  {
    name: "builds_add_project",
    description:
      "Create a new Builds project. Optionally link a folder path.",
    parameters: {
      type: "object",
      properties: {
        name: { type: "string", description: "Project name (default: New project)" },
        category: {
          type: "string",
          description: "Category id or name (default: other)",
        },
        description: { type: "string", description: "Short description" },
        path: {
          type: "string",
          description: "Absolute folder path to link as the project root",
        },
        rootPath: { type: "string", description: "Alias for path" },
        icon: { type: "string", description: "Emoji icon (default 🏗️)" },
        stack: {
          type: "string",
          description: "Comma-separated tech stack",
        },
        tags: { type: "string", description: "Comma-separated tags" },
        repoUrl: { type: "string", description: "Repository URL" },
        demoUrl: { type: "string", description: "Demo / live URL" },
        notes: { type: "string", description: "Notes" },
        favorite: { type: "boolean", description: "Mark as favorite" },
      },
    },
  },
  {
    name: "builds_update_project",
    description:
      "Update Builds catalog fields for a project (name, description, notes, category, stack, tags, urls, favorite, linked folder). Does not modify files inside the linked folder on disk.",
    parameters: {
      type: "object",
      properties: {
        ...PROJECT_REF,
        rename: { type: "string", description: "New project display name" },
        description: { type: "string", description: "Short description" },
        notes: { type: "string", description: "Replace full notes text" },
        category: { type: "string", description: "Category id or name" },
        icon: { type: "string", description: "Emoji icon" },
        color: { type: "string", description: "Accent color" },
        stack: { type: "string", description: "Comma-separated tech stack" },
        tags: { type: "string", description: "Comma-separated tags" },
        repoUrl: { type: "string", description: "Repository URL" },
        demoUrl: { type: "string", description: "Demo URL" },
        favorite: { type: "boolean", description: "Favorite flag" },
        watchFolder: { type: "boolean", description: "Auto-rescan linked folder" },
        path: {
          type: "string",
          description: "Link/change root folder path",
        },
        builtAt: { type: "string", description: "Built-on date YYYY-MM-DD" },
      },
    },
  },
  {
    name: "builds_edit_notes",
    description:
      "Edit project notes in the Builds catalog: set, append, prepend, remove substring, or replace text. Does not change files on disk.",
    parameters: {
      type: "object",
      properties: {
        ...PROJECT_REF,
        ...TEXT_EDIT_PROPS,
      },
    },
  },
  {
    name: "builds_edit_description",
    description:
      "Edit project short description in the Builds catalog. Does not change files on disk.",
    parameters: {
      type: "object",
      properties: {
        ...PROJECT_REF,
        ...TEXT_EDIT_PROPS,
      },
    },
  },
  {
    name: "builds_add_attachment",
    description:
      "Attach a file/folder path to a Builds project as documentation reference. Stores the path in the catalog only: does not copy or modify the file on disk.",
    parameters: {
      type: "object",
      properties: {
        ...PROJECT_REF,
        path: { type: "string", description: "Absolute file or folder path to attach" },
        paths: {
          type: "array",
          items: { type: "string" },
          description: "Multiple absolute paths to attach",
        },
        description: { type: "string", description: "Optional note about this attachment" },
        type: { type: "string", description: "file | folder (auto-detected if omitted)" },
      },
    },
  },
  {
    name: "builds_remove_attachment",
    description:
      "Remove an attachment from the Builds project catalog by id, name, or path. Does NOT delete the file/folder on disk.",
    parameters: {
      type: "object",
      properties: {
        ...PROJECT_REF,
        attachment: {
          type: "string",
          description: "Attachment id, file name, or path",
        },
      },
    },
  },
  {
    name: "builds_update_attachment",
    description:
      "Update an attachment's catalog description or display name.",
    parameters: {
      type: "object",
      properties: {
        ...PROJECT_REF,
        attachment: { type: "string", description: "Attachment id, name, or path" },
        description: { type: "string", description: "New attachment description" },
        attachmentName: { type: "string", description: "New display name" },
      },
    },
  },
  {
    name: "builds_add_link",
    description: "Add a labeled URL link to a Builds project's documentation.",
    parameters: {
      type: "object",
      properties: {
        ...PROJECT_REF,
        url: { type: "string", description: "URL" },
        label: { type: "string", description: "Link label (default: url)" },
      },
      required: ["url"],
    },
  },
  {
    name: "builds_remove_link",
    description: "Remove a link from a Builds project by id, label, or url.",
    parameters: {
      type: "object",
      properties: {
        ...PROJECT_REF,
        link: { type: "string", description: "Link id, label, or url" },
      },
    },
  },
  {
    name: "builds_set_field",
    description:
      "Set a custom key/value documentation field on a Builds project.",
    parameters: {
      type: "object",
      properties: {
        ...PROJECT_REF,
        key: { type: "string", description: "Field key" },
        value: { type: "string", description: "Field value" },
      },
      required: ["key"],
    },
  },
  {
    name: "builds_remove_field",
    description: "Remove a custom documentation field from a Builds project.",
    parameters: {
      type: "object",
      properties: {
        ...PROJECT_REF,
        field: { type: "string", description: "Field id or key" },
      },
    },
  },
  {
    name: "builds_link_folder",
    description:
      "Link (or change) the code folder path for a Builds project and optionally refresh the file-tree snapshot. Does not modify folder contents on disk.",
    parameters: {
      type: "object",
      properties: {
        ...PROJECT_REF,
        path: { type: "string", description: "Absolute folder path" },
        scan: {
          type: "boolean",
          description: "Scan tree snapshot after linking (default true)",
        },
        watchFolder: { type: "boolean", description: "Enable auto-rescan for this project" },
      },
      required: ["path"],
    },
  },
  {
    name: "builds_rescan_tree",
    description:
      "Refresh the Builds file-tree snapshot for a project's linked folder. Does not modify files on disk.",
    parameters: {
      type: "object",
      properties: { ...PROJECT_REF },
    },
  },
  {
    name: "builds_delete_project",
    description:
      "Delete a Builds project by id or name. Permanently removes it from the portfolio catalog.",
    parameters: {
      type: "object",
      properties: { ...PROJECT_REF },
    },
  },
  {
    name: "builds_duplicate_project",
    description:
      "Duplicate an existing Builds project. Optionally set the copy name.",
    parameters: {
      type: "object",
      properties: {
        ...PROJECT_REF,
        newName: {
          type: "string",
          description: "Optional name for the copy (default: \"<original> (copy)\")",
        },
      },
    },
  },
];

function projectRefArgs(args) {
  return {
    project: args?.project || args?.id || args?.projectId || args?.name,
    id: args?.id || args?.projectId,
    name: args?.name,
  };
}

async function buildsListProjects(args) {
  return handleBuildsInvoke("projects.list", {
    q: args?.query || args?.q || args?.search,
    category: args?.category || args?.categoryId,
    favorites: args?.favorites ?? args?.favorite,
  });
}

async function buildsGetProject(args) {
  const ref = projectRefArgs(args);
  if (!String(ref.project || "").trim()) {
    return { ok: false, error: "Provide project id or name" };
  }
  return handleBuildsInvoke("projects.get", ref);
}

async function buildsAddProject(args) {
  return handleBuildsInvoke("projects.create", {
    name: args?.name,
    category: args?.category || args?.categoryId,
    description: args?.description,
    path: args?.path || args?.rootPath || args?.folder,
    rootPath: args?.rootPath || args?.path || args?.folder,
    icon: args?.icon,
    color: args?.color,
    stack: args?.stack,
    tags: args?.tags,
    repoUrl: args?.repoUrl || args?.repo,
    demoUrl: args?.demoUrl || args?.demo,
    notes: args?.notes,
    favorite: args?.favorite,
    watchFolder: args?.watchFolder,
    builtAt: args?.builtAt,
  });
}

async function buildsUpdateProject(args) {
  return handleBuildsInvoke("projects.update", {
    ...projectRefArgs(args),
    rename: args?.rename || args?.newName || args?.title,
    description: args?.description,
    notes: args?.notes,
    category: args?.category || args?.categoryId,
    icon: args?.icon,
    color: args?.color,
    stack: args?.stack,
    tags: args?.tags,
    repoUrl: args?.repoUrl || args?.repo,
    demoUrl: args?.demoUrl || args?.demo,
    favorite: args?.favorite,
    watchFolder: args?.watchFolder,
    path: args?.path || args?.rootPath || args?.folder,
    builtAt: args?.builtAt,
    scan: args?.scan,
  });
}

async function buildsEditNotes(args) {
  let mode = args?.mode || args?.action;
  const text = args?.text ?? args?.content ?? args?.notes;
  const find = args?.find ?? args?.search;
  const replace = args?.replace ?? args?.replacement;
  if (
    (mode === "replace" || mode === "replace_all") &&
    text != null &&
    (find == null || find === "") &&
    replace == null
  ) {
    mode = "set";
  }
  return handleBuildsInvoke("projects.editNotes", {
    ...projectRefArgs(args),
    mode: mode || "set",
    text,
    find,
    replace,
    all: args?.all,
  });
}

async function buildsEditDescription(args) {
  let mode = args?.mode || args?.action;
  const text = args?.text ?? args?.content ?? args?.description;
  const find = args?.find ?? args?.search;
  const replace = args?.replace ?? args?.replacement;
  if (
    (mode === "replace" || mode === "replace_all") &&
    text != null &&
    (find == null || find === "") &&
    replace == null
  ) {
    mode = "set";
  }
  return handleBuildsInvoke("projects.editDescription", {
    ...projectRefArgs(args),
    mode: mode || "set",
    text,
    find,
    replace,
    all: args?.all,
  });
}

async function buildsAddAttachment(args) {
  return handleBuildsInvoke("projects.addAttachment", {
    ...projectRefArgs(args),
    path: args?.path || args?.file || args?.folder,
    paths: args?.paths,
    description: args?.description || args?.note,
    type: args?.type,
    fileName: args?.fileName || args?.attachmentName,
  });
}

async function buildsRemoveAttachment(args) {
  return handleBuildsInvoke("projects.removeAttachment", {
    ...projectRefArgs(args),
    attachment: args?.attachment || args?.attachmentId || args?.file || args?.path || args?.att,
  });
}

async function buildsUpdateAttachment(args) {
  return handleBuildsInvoke("projects.updateAttachment", {
    ...projectRefArgs(args),
    attachment: args?.attachment || args?.attachmentId || args?.file || args?.path || args?.att,
    description: args?.description || args?.note,
    attachmentName: args?.attachmentName || args?.fileName || args?.newName,
  });
}

async function buildsAddLink(args) {
  return handleBuildsInvoke("projects.addLink", {
    ...projectRefArgs(args),
    url: args?.url || args?.href,
    label: args?.label || args?.title,
  });
}

async function buildsRemoveLink(args) {
  return handleBuildsInvoke("projects.removeLink", {
    ...projectRefArgs(args),
    link: args?.link || args?.linkId || args?.label || args?.url,
  });
}

async function buildsSetField(args) {
  return handleBuildsInvoke("projects.setField", {
    ...projectRefArgs(args),
    key: args?.key || args?.field || args?.fieldKey,
    value: args?.value,
  });
}

async function buildsRemoveField(args) {
  return handleBuildsInvoke("projects.removeField", {
    ...projectRefArgs(args),
    field: args?.field || args?.fieldId || args?.key,
  });
}

async function buildsLinkFolder(args) {
  return handleBuildsInvoke("projects.linkFolder", {
    ...projectRefArgs(args),
    path: args?.path || args?.rootPath || args?.folder,
    scan: args?.scan,
    watchFolder: args?.watchFolder,
  });
}

async function buildsRescanTree(args) {
  return handleBuildsInvoke("projects.rescan", projectRefArgs(args));
}

async function buildsDeleteProject(args) {
  const ref = projectRefArgs(args);
  if (!String(ref.project || "").trim()) {
    return { ok: false, error: "Provide project id or name" };
  }
  return handleBuildsInvoke("projects.delete", ref);
}

async function buildsDuplicateProject(args) {
  const ref = projectRefArgs(args);
  if (!String(ref.project || "").trim()) {
    return { ok: false, error: "Provide project id or name to duplicate" };
  }
  return handleBuildsInvoke("projects.duplicate", {
    ...ref,
    name: args?.newName || args?.copyName,
  });
}

async function maybeOpenBuilds(ctx, result) {
  if (!result?.ok || !ctx?.getMainWindow) return result;
  try {
    const opened = await shellOpenPage({ app: "builds", page: "browse" }, ctx);
    if (opened?.ok) result.openedPage = "browse";
    else if (opened?.error) result.openWarning = opened.error;
  } catch (err) {
    result.openWarning = err.message || String(err);
  }
  return result;
}

const MUTATING_TOOLS = new Set([
  "builds_add_project",
  "builds_update_project",
  "builds_edit_notes",
  "builds_edit_description",
  "builds_add_attachment",
  "builds_remove_attachment",
  "builds_update_attachment",
  "builds_add_link",
  "builds_remove_link",
  "builds_set_field",
  "builds_remove_field",
  "builds_link_folder",
  "builds_rescan_tree",
  "builds_delete_project",
  "builds_duplicate_project",
]);

async function executeBuildsTool(name, args, ctx) {
  let result;
  switch (name) {
    case "builds_list_projects":
      result = await buildsListProjects(args || {});
      break;
    case "builds_get_project":
      result = await buildsGetProject(args || {});
      break;
    case "builds_add_project":
      result = await buildsAddProject(args || {});
      break;
    case "builds_update_project":
      result = await buildsUpdateProject(args || {});
      break;
    case "builds_edit_notes":
      result = await buildsEditNotes(args || {});
      break;
    case "builds_edit_description":
      result = await buildsEditDescription(args || {});
      break;
    case "builds_add_attachment":
      result = await buildsAddAttachment(args || {});
      break;
    case "builds_remove_attachment":
      result = await buildsRemoveAttachment(args || {});
      break;
    case "builds_update_attachment":
      result = await buildsUpdateAttachment(args || {});
      break;
    case "builds_add_link":
      result = await buildsAddLink(args || {});
      break;
    case "builds_remove_link":
      result = await buildsRemoveLink(args || {});
      break;
    case "builds_set_field":
      result = await buildsSetField(args || {});
      break;
    case "builds_remove_field":
      result = await buildsRemoveField(args || {});
      break;
    case "builds_link_folder":
      result = await buildsLinkFolder(args || {});
      break;
    case "builds_rescan_tree":
      result = await buildsRescanTree(args || {});
      break;
    case "builds_delete_project":
      result = await buildsDeleteProject(args || {});
      break;
    case "builds_duplicate_project":
      result = await buildsDuplicateProject(args || {});
      break;
    default:
      result = { ok: false, error: `Unknown builds tool: ${name}` };
  }

  if (result?.ok && MUTATING_TOOLS.has(name)) {
    result = await maybeOpenBuilds(ctx, result);
  }

  return result;
}

module.exports = {
  BUILDS_TOOL_DEFS,
  executeBuildsTool,
};