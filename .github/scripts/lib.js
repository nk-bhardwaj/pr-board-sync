const TICKET_RE = /\bAB[#-](\d+)\b/i;

function extractTicketId(...sources) {
  for (const s of sources) {
    const m = TICKET_RE.exec(s || "");
    if (m) return m[1];
  }
  return null;
}

function decideAction({ action, merged, draft }) {
  if (action === "closed") return { type: merged ? "merged" : "closed-unmerged" };
  if (["opened", "reopened", "ready_for_review"].includes(action)) {
    return { type: draft ? "link-only" : "open" };
  }
  return { type: "none" };
}

module.exports = { extractTicketId, decideAction, TICKET_RE };
