const { handleDayPlannerInvoke } = require("../../apps/day-planner-ipc");

async function listTasks(input = {}) {
  const res = await handleDayPlannerInvoke("tasks.list", {});
  if (!res?.ok) return res;
  let tasks = res.tasks || [];
  const q = String(input.q || input.query || "").trim().toLowerCase();
  if (q) {
    tasks = tasks.filter((t) =>
      [t.title, t.notes, t.dueDate, t.dueTime].join(" ").toLowerCase().includes(q)
    );
  }
  if (input.done === true) tasks = tasks.filter((t) => t.done);
  if (input.done === false) tasks = tasks.filter((t) => !t.done);
  const limit = Math.min(Math.max(Number(input.limit) || 80, 1), 200);
  return {
    ok: true,
    tasks: tasks.slice(0, limit),
    total: tasks.length,
    today: res.today || null,
    upcoming: res.upcoming || null,
  };
}

async function addTask(input = {}) {
  const title = String(input.title || "").trim();
  if (!title) return { ok: false, error: "Missing title" };
  return handleDayPlannerInvoke("task.add", {
    title,
    notes: input.notes,
    dueDate: input.dueDate,
    dueTime: input.dueTime ?? input.time,
    notify: input.notify,
    priority: input.priority,
  });
}

async function toggleTask(input = {}) {
  const id = String(input.id || "").trim();
  if (!id) return { ok: false, error: "Missing task id" };
  return handleDayPlannerInvoke("task.toggle", { id });
}

async function generateTasks(input = {}) {
  const goal = String(input.goal || input.prompt || "").trim();
  if (!goal) return { ok: false, error: "Missing goal" };
  return handleDayPlannerInvoke("tasks.generate", {
    goal,
    language: input.language,
    count: input.count,
    apply: input.apply !== false,
  });
}

const CAPABILITIES = [
  {
    id: "day-planner.tasks.list",
    kind: "query",
    provider: "day-planner",
    title: "List today tasks",
    description: "Tasks from the Today / Day Planner app",
    handler: listTasks,
  },
  {
    id: "day-planner.task.add",
    kind: "action",
    provider: "day-planner",
    title: "Add task",
    description: "Create a new task in Today",
    handler: addTask,
  },
  {
    id: "day-planner.task.toggle",
    kind: "action",
    provider: "day-planner",
    title: "Toggle task done",
    description: "Mark a task complete or incomplete",
    handler: toggleTask,
  },
  {
    id: "day-planner.tasks.generate",
    kind: "action",
    provider: "day-planner",
    title: "Generate tasks",
    description: "AI-generate tasks from a goal (optional apply)",
    handler: generateTasks,
  },
];

module.exports = { CAPABILITIES };