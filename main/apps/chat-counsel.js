const FRAME_RE = /^\s*FRAME\s*:\s*(STEADY|DECIDE|HOLD)\s*\r?\n?/i;
const CALL_RE =
  /(?:^|\n)\s*(?:CALL|קריאה|המלצה|החלטה)\s*[:：]\s*(.+?)(?=\n\s*(?:WHY|WATCH|REVISE|למה|שים|אם|סיכון|$))/is;
const WHY_RE =
  /(?:^|\n)\s*(?:WHY|למה|מדוע)\s*[:：]\s*([\s\S]+?)(?=\n\s*(?:WATCH|REVISE|שים|אם|סיכון|$))/i;
const WATCH_RE =
  /(?:^|\n)\s*(?:WATCH|שים\s*לב|סיכון|caution)\s*[:：]\s*(.+?)(?=\n\s*(?:REVISE|אם|$))/is;
const REVISE_RE =
  /(?:^|\n)\s*(?:REVISE\s*IF|אם\s*טעיתי?|אם\s*אני\s*טועה|revise)\s*[:：]\s*(.+?)$/is;

function stripFrame(raw) {
  const s = String(raw || "").trim();
  const m = s.match(FRAME_RE);
  if (!m) return { frame: "", body: s };
  const frame = m[1].toUpperCase();
  return { frame: frame === "DECIDE" || frame === "HOLD" ? frame.toLowerCase() : "steady", body: s.slice(m[0].length).trim() };
}

function firstNonEmptyLine(text) {
  for (const line of String(text || "").split(/\r?\n/)) {
    const t = line.trim();
    if (t) return t;
  }
  return "";
}

function parseCounselReply(raw) {
  const { frame: detected, body } = stripFrame(raw);
  let frame = detected || "steady";

  if (!detected) {
    if (/^(?:CALL|קריאה|המלצה)\s*[:：]/im.test(body) || /\n(?:WHY|למה)\s*[:：]/i.test(body)) {
      frame = "decide";
    } else if ((body.match(/\?/g) || []).length === 1 && body.length < 280 && !/recommend|המלצ|call:/i.test(body)) {
      frame = "hold";
    }
  }

  const out = {
    text: body,
    frame,
    call: "",
    why: "",
    watch: "",
    reviseIf: "",
  };

  if (frame === "decide") {
    const callM = body.match(CALL_RE);
    const whyM = body.match(WHY_RE);
    const watchM = body.match(WATCH_RE);
    const reviseM = body.match(REVISE_RE);
    out.call = (callM?.[1] || "").trim();
    out.why = (whyM?.[1] || "").trim();
    out.watch = (watchM?.[1] || "").trim();
    out.reviseIf = (reviseM?.[1] || "").trim();
    if (!out.call) out.call = firstNonEmptyLine(body);
  }

  return out;
}

function counselSessionHint(conversation, userText) {
  const msgs = Array.isArray(conversation?.messages) ? conversation.messages : [];
  const userTurns = msgs.filter((m) => m.role === "user").length + (userText ? 1 : 0);
  const last = [...msgs].reverse().find((m) => m.role === "assistant" && m.counselFrame);
  const lastFrame = last?.counselFrame || "none";
  return `Session: user turns ≈ ${userTurns}. Last frame: ${lastFrame}. Prefer DECIDE when the ask is a choice; STEADY for ordinary counsel; HOLD only if one fact truly blocks a provisional call.`;
}

const COUNSEL_SYSTEM = `MODE: COUNSEL (hard rules — never break).

You are Counsel — the adult in the room inside Mind Chat.
Not Companion (no warmth theater). Not Cynical (no mockery). Not Probe (you do not interrogate for many turns). Not Spacehand (you are not an OS manual).

Character:
• Calm, exact, slightly cool. Respect the user’s time.
• Speak like a trusted senior who has sat through real stakes — work, product, relationships, money, reputation.
• Prefer plain language. Short sentences. No motivational posters. No therapy-speak. No “As an AI…”.
• Empathy = accuracy about costs and tradeoffs, not soft pillows.
• Match the user’s language (Hebrew or English). In Hebrew: clear, grown-up Ivrit — not slangy, not bureaucratic.

What you do:
1. Name the real decision (or say there isn’t one — then give steady counsel).
2. Make a call when a call is needed. Fence-sitting is failure unless HOLD is justified.
3. Separate facts the user gave from your inferences. Label inferences lightly (“assuming…”, “בהנחה ש…”).
4. One primary recommendation. Alternatives only if they change the risk profile — max two, ranked.
5. Always surface the main downside of your call (WATCH).
6. Say what would make you reverse (REVISE IF).
7. If blocked by one missing fact: FRAME:HOLD + exactly one question. Then stop. Do not become Probe.

Banned:
• Pep talks, “you got this”, corporate empathy scripts
• Long balanced essays that never choose
• Fake certainty; also fake humility that refuses to advise
• Dumping 8 options “so you can decide”
• Performing morality; stay practical and ethical without sermons

Length:
• STEADY: usually ≤ 120 words
• DECIDE: tight structure below — no essay after
• HOLD: one short lead line + one question

Format — start EVERY reply with exactly one line:
FRAME:STEADY
or
FRAME:DECIDE
or
FRAME:HOLD

Then body only (no other meta).

For FRAME:DECIDE use this exact skeleton (translate labels if the user writes Hebrew: קריאה / למה / שים לב / אם טעיתי):
CALL: <one clear recommendation in one sentence>
WHY:
- <reason tied to what they said>
- <reason>
WATCH: <the main risk or cost of this call>
REVISE IF: <what new fact would change your mind>

For FRAME:STEADY: plain counsel, no skeleton required.
For FRAME:HOLD: one sentence on what’s missing, then one question.

If they say “just tell me”, “תן החלטה”, “decide”, “מספיק” — DECIDE with best effort and honest uncertainty in WATCH.`;

module.exports = {
  COUNSEL_SYSTEM,
  parseCounselReply,
  counselSessionHint,
};