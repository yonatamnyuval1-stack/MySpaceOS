const { handleContactsInvoke } = require("../../apps/contacts-ipc");

function slimContact(c) {
  if (!c) return null;
  return {
    id: c.id,
    name: c.name || [c.firstName, c.lastName].filter(Boolean).join(" ") || "",
    email: c.email || "",
    phone: c.phone || "",
    groupId: c.groupId || null,
    birthday: c.birthday || null,
    company: c.company || "",
    notes: c.notes || "",
  };
}

async function listContacts(input = {}) {
  const res = await handleContactsInvoke("storage.load", {});
  if (!res?.ok) return res;
  let contacts = (res.data?.contacts || []).map(slimContact).filter(Boolean);
  const q = String(input.q || input.query || "").trim().toLowerCase();
  if (q) {
    contacts = contacts.filter((c) =>
      [c.name, c.email, c.phone, c.company, c.notes].join(" ").toLowerCase().includes(q)
    );
  }
  const limit = Math.min(Math.max(Number(input.limit) || 80, 1), 300);
  return {
    ok: true,
    contacts: contacts.slice(0, limit),
    total: contacts.length,
    groups: res.data?.groups || [],
  };
}

async function upcomingReminders() {
  return handleContactsInvoke("reminders.upcoming", {});
}

async function openEmail(input = {}) {
  const email = String(input.email || "").trim();
  if (!email) return { ok: false, error: "Missing email" };
  return handleContactsInvoke("email.open", { email });
}

async function openPhone(input = {}) {
  const phone = String(input.phone || "").trim();
  if (!phone) return { ok: false, error: "Missing phone" };
  return handleContactsInvoke("phone.open", { phone });
}

const CAPABILITIES = [
  {
    id: "contacts.list",
    kind: "query",
    provider: "contacts",
    title: "List contacts",
    description: "Search/list contacts from the Contacts app",
    handler: listContacts,
  },
  {
    id: "contacts.reminders.upcoming",
    kind: "query",
    provider: "contacts",
    title: "Upcoming birthday reminders",
    description: "Contacts with upcoming birthday reminders",
    handler: upcomingReminders,
  },
  {
    id: "contacts.email.open",
    kind: "action",
    provider: "contacts",
    title: "Open email",
    description: "Open the default mail client for a contact email",
    handler: openEmail,
  },
  {
    id: "contacts.phone.open",
    kind: "action",
    provider: "contacts",
    title: "Open phone",
    description: "Open a phone dialer link for a number",
    handler: openPhone,
  },
];

module.exports = { CAPABILITIES };