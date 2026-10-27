const { describe, it } = require("node:test");
const assert = require("node:assert");
const { extractTicketId, decideAction, TICKET_RE } = require("../.github/scripts/lib.js");

describe("extractTicketId", () => {
  it("extracts AB#123 from branch", () => {
    assert.strictEqual(extractTicketId("feature/AB#123-fix"), "123");
  });

  it("extracts AB-45 from branch", () => {
    assert.strictEqual(extractTicketId("feature/AB-45-fix"), "45");
  });

  it("extracts AB#123 from title", () => {
    assert.strictEqual(extractTicketId("", "Fix bug AB#123", ""), "123");
  });

  it("extracts AB-45 from body", () => {
    assert.strictEqual(extractTicketId("", "", "See AB-45 for details"), "45");
  });

  it("branch takes precedence over title", () => {
    assert.strictEqual(extractTicketId("AB#1", "AB#2", "AB#3"), "1");
  });

  it("title takes precedence over body", () => {
    assert.strictEqual(extractTicketId("", "AB#2", "AB#3"), "2");
  });

  it("handles lowercase ab#7", () => {
    assert.strictEqual(extractTicketId("feature/ab#7-fix"), "7");
  });

  it("returns null when no match", () => {
    assert.strictEqual(extractTicketId("feature/fix-bug", "Fix bug", "No ticket"), null);
  });

  it("does not match FAB#12", () => {
    assert.strictEqual(extractTicketId("FAB#12"), null);
  });

  it("does not match AB# with no number", () => {
    assert.strictEqual(extractTicketId("AB#"), null);
  });

  it("does not match AB- with no number", () => {
    assert.strictEqual(extractTicketId("AB-"), null);
  });

  it("handles empty strings", () => {
    assert.strictEqual(extractTicketId("", "", ""), null);
  });

  it("handles null/undefined", () => {
    assert.strictEqual(extractTicketId(null, undefined, ""), null);
  });
});

describe("decideAction", () => {
  it("opened non-draft returns open", () => {
    assert.deepStrictEqual(decideAction({ action: "opened", merged: false, draft: false }), {
      type: "open",
    });
  });

  it("reopened non-draft returns open", () => {
    assert.deepStrictEqual(decideAction({ action: "reopened", merged: false, draft: false }), {
      type: "open",
    });
  });

  it("ready_for_review returns open", () => {
    assert.deepStrictEqual(decideAction({ action: "ready_for_review", merged: false, draft: false }), {
      type: "open",
    });
  });

  it("opened draft returns link-only", () => {
    assert.deepStrictEqual(decideAction({ action: "opened", merged: false, draft: true }), {
      type: "link-only",
    });
  });

  it("reopened draft returns link-only", () => {
    assert.deepStrictEqual(decideAction({ action: "reopened", merged: false, draft: true }), {
      type: "link-only",
    });
  });

  it("closed merged returns merged", () => {
    assert.deepStrictEqual(decideAction({ action: "closed", merged: true, draft: false }), {
      type: "merged",
    });
  });

  it("closed not merged returns closed-unmerged", () => {
    assert.deepStrictEqual(decideAction({ action: "closed", merged: false, draft: false }), {
      type: "closed-unmerged",
    });
  });

  it("other actions return none", () => {
    assert.deepStrictEqual(decideAction({ action: "synchronize", merged: false, draft: false }), {
      type: "none",
    });
  });

  it("edited returns none", () => {
    assert.deepStrictEqual(decideAction({ action: "edited", merged: false, draft: false }), {
      type: "none",
    });
  });
});

describe("TICKET_RE", () => {
  it("matches AB#123", () => {
    assert.match("AB#123", TICKET_RE);
  });

  it("matches AB-456", () => {
    assert.match("AB-456", TICKET_RE);
  });

  it("matches ab#789 (case insensitive)", () => {
    assert.match("ab#789", TICKET_RE);
  });

  it("does not match FAB#123", () => {
    assert.doesNotMatch("FAB#123", TICKET_RE);
  });

  it("does not match XAB#123", () => {
    assert.doesNotMatch("XAB#123", TICKET_RE);
  });

  it("matches in middle of string", () => {
    assert.match("fix-AB#123-bug", TICKET_RE);
  });
});
