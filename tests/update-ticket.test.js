const { describe, it, mock } = require("node:test");
const assert = require("node:assert");
const { buildPatch, escapeHtml, run } = require("../.github/scripts/update-ticket.js");

describe("escapeHtml", () => {
  it("escapes &", () => {
    assert.strictEqual(escapeHtml("A & B"), "A &amp; B");
  });

  it("escapes <", () => {
    assert.strictEqual(escapeHtml("A < B"), "A &lt; B");
  });

  it("escapes >", () => {
    assert.strictEqual(escapeHtml("A > B"), "A &gt; B");
  });

  it("escapes double quotes", () => {
    assert.strictEqual(escapeHtml('A "B"'), "A &quot;B&quot;");
  });

  it("escapes single quotes", () => {
    assert.strictEqual(escapeHtml("A 'B'"), "A &#39;B&#39;");
  });

  it("escapes multiple special chars", () => {
    assert.strictEqual(escapeHtml("<script>&\"'</script>"), "&lt;script&gt;&amp;&quot;&#39;&lt;/script&gt;");
  });

  it("leaves normal text unchanged", () => {
    assert.strictEqual(escapeHtml("Hello World"), "Hello World");
  });
});

describe("buildPatch", () => {
  it("open action includes state and comment and link", () => {
    const ops = buildPatch({
      type: "open",
      stateOpen: "Active",
      stateMerged: "Closed",
      prUrl: "https://github.com/repo/pull/1",
      prNumber: 1,
      linkExists: false,
    });
    assert.strictEqual(ops.length, 3);
    assert.strictEqual(ops[0].path, "/fields/System.State");
    assert.strictEqual(ops[0].value, "Active");
    assert.strictEqual(ops[1].path, "/fields/System.History");
    assert.match(ops[1].value, /PR opened/);
    assert.strictEqual(ops[2].path, "/relations/-");
    assert.strictEqual(ops[2].value.rel, "Hyperlink");
  });

  it("draft action includes no state change", () => {
    const ops = buildPatch({
      type: "link-only",
      stateOpen: "Active",
      stateMerged: "Closed",
      prUrl: "https://github.com/repo/pull/1",
      prNumber: 1,
      linkExists: false,
    });
    assert.strictEqual(ops.length, 2);
    assert.ok(!ops.some((op) => op.path === "/fields/System.State"));
    assert.match(ops[0].value, /draft/);
  });

  it("merged action uses STATE_MERGED", () => {
    const ops = buildPatch({
      type: "merged",
      stateOpen: "Active",
      stateMerged: "Closed",
      prUrl: "https://github.com/repo/pull/1",
      prNumber: 1,
      linkExists: false,
    });
    assert.strictEqual(ops.length, 3);
    assert.strictEqual(ops[0].value, "Closed");
    assert.match(ops[1].value, /merged/);
  });

  it("closed-unmerged has no state op", () => {
    const ops = buildPatch({
      type: "closed-unmerged",
      stateOpen: "Active",
      stateMerged: "Closed",
      prUrl: "https://github.com/repo/pull/1",
      prNumber: 1,
      linkExists: false,
    });
    assert.strictEqual(ops.length, 2);
    assert.ok(!ops.some((op) => op.path === "/fields/System.State"));
    assert.match(ops[0].value, /closed without merge/);
  });

  it("existing link is not duplicated", () => {
    const ops = buildPatch({
      type: "open",
      stateOpen: "Active",
      stateMerged: "Closed",
      prUrl: "https://github.com/repo/pull/1",
      prNumber: 1,
      linkExists: true,
    });
    assert.strictEqual(ops.length, 2);
    assert.ok(!ops.some((op) => op.path === "/relations/-"));
  });

  it("escapes HTML in comment", () => {
    const ops = buildPatch({
      type: "open",
      stateOpen: "Active",
      stateMerged: "Closed",
      prUrl: "https://github.com/repo/pull/1?test=<script>",
      prNumber: 1,
      linkExists: false,
    });
    assert.match(ops[1].value, /&lt;script&gt;/);
  });
});

describe("run", () => {
  it("returns 0 with warning when config missing", async () => {
    const env = {};
    const event = {
      action: "opened",
      pull_request: {
        head: { ref: "AB#123-fix", repo: { fork: false } },
        title: "Fix",
        body: "",
        draft: false,
        merged: false,
        html_url: "https://github.com/repo/pull/1",
        number: 1,
      },
    };
    const logs = [];
    const mockConsole = {
      log: (msg) => logs.push(msg),
      error: (msg) => logs.push(msg),
    };
    const originalLog = console.log;
    const originalError = console.error;
    console.log = mockConsole.log;
    console.error = mockConsole.error;

    const code = await run({ env, event });

    console.log = originalLog;
    console.error = originalError;

    assert.strictEqual(code, 0);
    assert.ok(logs.some((l) => l.includes("not configured")));
  });

  it("skips fork PR", async () => {
    const env = {
      AZURE_ORG: "org",
      AZURE_PROJECT: "proj",
      AZURE_DEVOPS_PAT: "pat123",
    };
    const event = {
      action: "opened",
      pull_request: {
        head: { ref: "AB#123-fix", repo: { fork: true } },
        title: "Fix",
        body: "",
        draft: false,
        merged: false,
        html_url: "https://github.com/repo/pull/1",
        number: 1,
      },
    };
    const logs = [];
    const mockConsole = { log: (msg) => logs.push(msg) };
    const originalLog = console.log;
    console.log = mockConsole.log;

    const code = await run({ env, event });

    console.log = originalLog;

    assert.strictEqual(code, 0);
    assert.ok(logs.some((l) => l.includes("fork PR")));
  });

  it("skips when no ticket ID", async () => {
    const env = {
      AZURE_ORG: "org",
      AZURE_PROJECT: "proj",
      AZURE_DEVOPS_PAT: "pat123",
    };
    const event = {
      action: "opened",
      pull_request: {
        head: { ref: "fix-bug", repo: { fork: false } },
        title: "Fix",
        body: "",
        draft: false,
        merged: false,
        html_url: "https://github.com/repo/pull/1",
        number: 1,
      },
    };
    const logs = [];
    const mockConsole = { log: (msg) => logs.push(msg) };
    const originalLog = console.log;
    console.log = mockConsole.log;

    const code = await run({ env, event });

    console.log = originalLog;

    assert.strictEqual(code, 0);
    assert.ok(logs.some((l) => l.includes("no ticket")));
  });

  it("returns 0 on GET 404", async () => {
    const env = {
      AZURE_ORG: "org",
      AZURE_PROJECT: "proj",
      AZURE_DEVOPS_PAT: "pat123",
    };
    const event = {
      action: "opened",
      pull_request: {
        head: { ref: "AB#123-fix", repo: { fork: false } },
        title: "Fix",
        body: "",
        draft: false,
        merged: false,
        html_url: "https://github.com/repo/pull/1",
        number: 1,
      },
    };
    const mockFetch = mock.fn(async () => ({
      ok: false,
      status: 404,
      text: async () => "Not found",
    }));

    const logs = [];
    const mockConsole = { log: (msg) => logs.push(msg) };
    const originalLog = console.log;
    console.log = mockConsole.log;

    const code = await run({ env, event, fetchImpl: mockFetch });

    console.log = originalLog;

    assert.strictEqual(code, 0);
    assert.ok(logs.some((l) => l.includes("not found")));
  });

  it("sends correct PATCH for open PR", async () => {
    const env = {
      AZURE_ORG: "org",
      AZURE_PROJECT: "proj",
      AZURE_DEVOPS_PAT: "pat123",
      STATE_OPEN: "Active",
      STATE_MERGED: "Closed",
    };
    const event = {
      action: "opened",
      pull_request: {
        head: { ref: "AB#123-fix", repo: { fork: false } },
        title: "Fix",
        body: "",
        draft: false,
        merged: false,
        html_url: "https://github.com/repo/pull/1",
        number: 1,
      },
    };
    const mockFetch = mock.fn(async (url, options) => {
      if (url.includes("$expand=relations")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ relations: [] }),
        };
      }
      if (options.method === "PATCH") {
        assert.strictEqual(options.headers["Content-Type"], "application/json-patch+json");
        assert.match(options.headers.Authorization, /^Basic /);
        const body = JSON.parse(options.body);
        assert.ok(body.some((op) => op.path === "/fields/System.State" && op.value === "Active"));
        assert.ok(body.some((op) => op.path === "/fields/System.History"));
        assert.ok(body.some((op) => op.path === "/relations/-"));
        return { ok: true, status: 200 };
      }
      return { ok: false, status: 500 };
    });

    const code = await run({ env, event, fetchImpl: mockFetch });

    assert.strictEqual(code, 0);
  });

  it("draft PR sends no state op", async () => {
    const env = {
      AZURE_ORG: "org",
      AZURE_PROJECT: "proj",
      AZURE_DEVOPS_PAT: "pat123",
      STATE_OPEN: "Active",
      STATE_MERGED: "Closed",
    };
    const event = {
      action: "opened",
      pull_request: {
        head: { ref: "AB#123-fix", repo: { fork: false } },
        title: "Fix",
        body: "",
        draft: true,
        merged: false,
        html_url: "https://github.com/repo/pull/1",
        number: 1,
      },
    };
    const mockFetch = mock.fn(async (url, options) => {
      if (url.includes("$expand=relations")) {
        return { ok: true, status: 200, json: async () => ({ relations: [] }) };
      }
      if (options.method === "PATCH") {
        const body = JSON.parse(options.body);
        assert.ok(!body.some((op) => op.path === "/fields/System.State"));
        return { ok: true, status: 200 };
      }
      return { ok: false, status: 500 };
    });

    const code = await run({ env, event, fetchImpl: mockFetch });

    assert.strictEqual(code, 0);
  });

  it("merged uses STATE_MERGED", async () => {
    const env = {
      AZURE_ORG: "org",
      AZURE_PROJECT: "proj",
      AZURE_DEVOPS_PAT: "pat123",
      STATE_OPEN: "Active",
      STATE_MERGED: "Closed",
    };
    const event = {
      action: "closed",
      pull_request: {
        head: { ref: "AB#123-fix", repo: { fork: false } },
        title: "Fix",
        body: "",
        draft: false,
        merged: true,
        html_url: "https://github.com/repo/pull/1",
        number: 1,
      },
    };
    const mockFetch = mock.fn(async (url, options) => {
      if (url.includes("$expand=relations")) {
        return { ok: true, status: 200, json: async () => ({ relations: [] }) };
      }
      if (options.method === "PATCH") {
        const body = JSON.parse(options.body);
        assert.ok(body.some((op) => op.path === "/fields/System.State" && op.value === "Closed"));
        return { ok: true, status: 200 };
      }
      return { ok: false, status: 500 };
    });

    const code = await run({ env, event, fetchImpl: mockFetch });

    assert.strictEqual(code, 0);
  });

  it("closed-unmerged has no state op", async () => {
    const env = {
      AZURE_ORG: "org",
      AZURE_PROJECT: "proj",
      AZURE_DEVOPS_PAT: "pat123",
    };
    const event = {
      action: "closed",
      pull_request: {
        head: { ref: "AB#123-fix", repo: { fork: false } },
        title: "Fix",
        body: "",
        draft: false,
        merged: false,
        html_url: "https://github.com/repo/pull/1",
        number: 1,
      },
    };
    const mockFetch = mock.fn(async (url, options) => {
      if (url.includes("$expand=relations")) {
        return { ok: true, status: 200, json: async () => ({ relations: [] }) };
      }
      if (options.method === "PATCH") {
        const body = JSON.parse(options.body);
        assert.ok(!body.some((op) => op.path === "/fields/System.State"));
        return { ok: true, status: 200 };
      }
      return { ok: false, status: 500 };
    });

    const code = await run({ env, event, fetchImpl: mockFetch });

    assert.strictEqual(code, 0);
  });

  it("existing PR link is not duplicated", async () => {
    const env = {
      AZURE_ORG: "org",
      AZURE_PROJECT: "proj",
      AZURE_DEVOPS_PAT: "pat123",
    };
    const event = {
      action: "opened",
      pull_request: {
        head: { ref: "AB#123-fix", repo: { fork: false } },
        title: "Fix",
        body: "",
        draft: false,
        merged: false,
        html_url: "https://github.com/repo/pull/1",
        number: 1,
      },
    };
    const mockFetch = mock.fn(async (url, options) => {
      if (url.includes("$expand=relations")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            relations: [{ rel: "Hyperlink", url: "https://github.com/repo/pull/1" }],
          }),
        };
      }
      if (options.method === "PATCH") {
        const body = JSON.parse(options.body);
        assert.ok(!body.some((op) => op.path === "/relations/-"));
        return { ok: true, status: 200 };
      }
      return { ok: false, status: 500 };
    });

    const code = await run({ env, event, fetchImpl: mockFetch });

    assert.strictEqual(code, 0);
  });

  it("PATCH 400 returns 1", async () => {
    const env = {
      AZURE_ORG: "org",
      AZURE_PROJECT: "proj",
      AZURE_DEVOPS_PAT: "pat123",
    };
    const event = {
      action: "opened",
      pull_request: {
        head: { ref: "AB#123-fix", repo: { fork: false } },
        title: "Fix",
        body: "",
        draft: false,
        merged: false,
        html_url: "https://github.com/repo/pull/1",
        number: 1,
      },
    };
    const mockFetch = mock.fn(async (url, options) => {
      if (url.includes("$expand=relations")) {
        return { ok: true, status: 200, json: async () => ({ relations: [] }) };
      }
      if (options.method === "PATCH") {
        return { ok: false, status: 400, text: async () => "Bad request" };
      }
      return { ok: false, status: 500 };
    });

    const logs = [];
    const mockConsole = { log: (msg) => logs.push(msg) };
    const originalLog = console.log;
    console.log = mockConsole.log;

    const code = await run({ env, event, fetchImpl: mockFetch });

    console.log = originalLog;

    assert.strictEqual(code, 1);
    assert.ok(logs.some((l) => l.includes("PATCH failed")));
  });

  it("5xx retries once", async () => {
    const env = {
      AZURE_ORG: "org",
      AZURE_PROJECT: "proj",
      AZURE_DEVOPS_PAT: "pat123",
    };
    const event = {
      action: "opened",
      pull_request: {
        head: { ref: "AB#123-fix", repo: { fork: false } },
        title: "Fix",
        body: "",
        draft: false,
        merged: false,
        html_url: "https://github.com/repo/pull/1",
        number: 1,
      },
    };
    let callCount = 0;
    const mockFetch = mock.fn(async (url, options) => {
      if (url.includes("$expand=relations")) {
        return { ok: true, status: 200, json: async () => ({ relations: [] }) };
      }
      if (options.method === "PATCH") {
        callCount++;
        if (callCount === 1) {
          return { ok: false, status: 500, text: async () => "Server error" };
        }
        return { ok: true, status: 200 };
      }
      return { ok: false, status: 500 };
    });

    const logs = [];
    const mockConsole = { log: (msg) => logs.push(msg) };
    const originalLog = console.log;
    console.log = mockConsole.log;

    const code = await run({ env, event, fetchImpl: mockFetch });

    console.log = originalLog;

    assert.strictEqual(code, 0);
    assert.strictEqual(callCount, 2);
    assert.ok(logs.some((l) => l.includes("retrying")));
  });

  it("PAT never appears in console output", async () => {
    const env = {
      AZURE_ORG: "org",
      AZURE_PROJECT: "proj",
      AZURE_DEVOPS_PAT: "secret-pat-12345",
    };
    const event = {
      action: "opened",
      pull_request: {
        head: { ref: "AB#123-fix", repo: { fork: false } },
        title: "Fix",
        body: "",
        draft: false,
        merged: false,
        html_url: "https://github.com/repo/pull/1",
        number: 1,
      },
    };
    const mockFetch = mock.fn(async (url) => {
      if (url.includes("$expand=relations")) {
        return { ok: true, status: 200, json: async () => ({ relations: [] }) };
      }
      return { ok: true, status: 200 };
    });

    const logs = [];
    const mockConsole = { log: (msg) => logs.push(msg) };
    const originalLog = console.log;
    console.log = mockConsole.log;

    await run({ env, event, fetchImpl: mockFetch });

    console.log = originalLog;

    const allLogs = logs.join(" ");
    assert.ok(!allLogs.includes("secret-pat-12345"));
    assert.ok(!allLogs.includes(env.AZURE_DEVOPS_PAT));
  });
});
