const { extractTicketId, decideAction } = require("./lib.js");

function escapeHtml(text) {
  const map = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  };
  return text.replace(/[&<>"']/g, (c) => map[c]);
}

function buildPatch({ type, stateOpen, stateMerged, prUrl, prNumber, linkExists }) {
  const ops = [];

  if (type === "open") {
    ops.push({
      op: "add",
      path: "/fields/System.State",
      value: stateOpen,
    });
  } else if (type === "merged") {
    ops.push({
      op: "add",
      path: "/fields/System.State",
      value: stateMerged,
    });
  }

  let comment;
  if (type === "open") {
    comment = `PR opened: <a href="${escapeHtml(prUrl)}">#${prNumber}</a>`;
  } else if (type === "link-only") {
    comment = `PR (draft) linked: <a href="${escapeHtml(prUrl)}">#${prNumber}</a>`;
  } else if (type === "merged") {
    comment = `PR merged: <a href="${escapeHtml(prUrl)}">#${prNumber}</a>`;
  } else if (type === "closed-unmerged") {
    comment = `PR closed without merge: <a href="${escapeHtml(prUrl)}">#${prNumber}</a>`;
  }

  if (comment) {
    ops.push({
      op: "add",
      path: "/fields/System.History",
      value: comment,
    });
  }

  if (!linkExists) {
    ops.push({
      op: "add",
      path: "/relations/-",
      value: {
        rel: "Hyperlink",
        url: prUrl,
        attributes: { comment: `GitHub PR #${prNumber}` },
      },
    });
  }

  return ops;
}

async function run({ env, event, fetchImpl = fetch }) {
  const log = (msg) => console.log(`[board-sync] ${msg}`);

  const azureOrg = env.AZURE_ORG;
  const azureProject = env.AZURE_PROJECT;
  const azureBaseUrl = env.AZURE_BASE_URL || "https://dev.azure.com";
  const azurePat = env.AZURE_DEVOPS_PAT;
  const stateOpen = env.STATE_OPEN || "Active";
  const stateMerged = env.STATE_MERGED || "Closed";

  if (!azureOrg || !azureProject || !azurePat) {
    log("Azure Boards not configured, skipping");
    console.log("::warning::Azure Boards not configured, skipping");
    return 0;
  }

  if (event.pull_request.head.repo.fork) {
    log("skipping fork PR (no secrets available)");
    return 0;
  }

  const branch = event.pull_request.head.ref;
  const title = event.pull_request.title;
  const body = event.pull_request.body || "";
  const ticketId = extractTicketId(branch, title, body);

  if (!ticketId) {
    log("no ticket found");
    return 0;
  }

  const actionResult = decideAction({
    action: event.action,
    merged: event.pull_request.merged,
    draft: event.pull_request.draft,
  });

  if (actionResult.type === "none") {
    log("no action needed for this event");
    return 0;
  }

  const prUrl = event.pull_request.html_url;
  const prNumber = event.pull_request.number;
  const apiUrl = `${azureBaseUrl}/${azureOrg}/${azureProject}/_apis/wit/workitems/${ticketId}?api-version=7.1`;

  const auth = btoa(`:${azurePat}`);

  let response;
  try {
    response = await fetchImpl(`${apiUrl}&$expand=relations`, {
      method: "GET",
      headers: {
        Authorization: `Basic ${auth}`,
      },
    });
  } catch (err) {
    log(`fetch error: ${err.message}`);
    return 1;
  }

  if (response.status === 404) {
    log("work item not found");
    return 0;
  }

  if (!response.ok) {
    const text = await response.text();
    log(`GET failed: ${response.status} ${text}`);
    return 1;
  }

  const data = await response.json();
  const linkExists = data.relations?.some(
    (r) => r.rel === "Hyperlink" && r.url === prUrl
  );

  const patchOps = buildPatch({
    type: actionResult.type,
    stateOpen,
    stateMerged,
    prUrl,
    prNumber,
    linkExists,
  });

  let patchResponse;
  const patchWithRetry = async () => {
    try {
      patchResponse = await fetchImpl(apiUrl, {
        method: "PATCH",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/json-patch+json",
        },
        body: JSON.stringify(patchOps),
      });
    } catch (err) {
      log(`fetch error: ${err.message}`);
      return 1;
    }

    if (patchResponse.ok) return 0;

    if (patchResponse.status === 429 || patchResponse.status >= 500) {
      log(`retrying after 2s (status ${patchResponse.status})`);
      await new Promise((resolve) => setTimeout(resolve, 2000));
      try {
        patchResponse = await fetchImpl(apiUrl, {
          method: "PATCH",
          headers: {
            Authorization: `Basic ${auth}`,
            "Content-Type": "application/json-patch+json",
          },
          body: JSON.stringify(patchOps),
        });
      } catch (err) {
        log(`fetch error on retry: ${err.message}`);
        return 1;
      }
    }

    if (!patchResponse.ok) {
      const text = await patchResponse.text();
      log(`PATCH failed: ${patchResponse.status} ${text}`);
      return 1;
    }

    return 0;
  };

  return await patchWithRetry();
}

if (require.main === module) {
  const fs = require("fs");
  const eventPath = process.env.GITHUB_EVENT_PATH;
  if (!eventPath) {
    console.error("GITHUB_EVENT_PATH not set");
    process.exit(1);
  }
  const event = JSON.parse(fs.readFileSync(eventPath, "utf8"));
  run({ env: process.env, event }).then((code) => process.exit(code));
}

module.exports = { buildPatch, escapeHtml, run };
