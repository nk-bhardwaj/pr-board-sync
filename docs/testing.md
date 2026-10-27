# Testing

## Test Matrix

| Scenario | Expected Behavior |
|----------|-------------------|
| Open PR with valid ID | Ticket state = `STATE_OPEN`, PR link and comment added |
| Draft PR with ID | Link and comment only, no state change |
| Mark draft ready | State changes to `STATE_OPEN` |
| Merge PR | State = `STATE_MERGED`, comment added |
| Close without merge | No state change, comment "PR closed without merge" added |
| PR with no ID | Sync logs "no ticket found" and exits 0; pr-checks fails |
| Fork PR | Skipped with log "skipping fork PR (no secrets available)" |
| Credentials not set | Warning emitted, exit 0, no API calls |
| Edit title to add an ID | pr-checks re-runs and passes |
| Duplicate PR link | Link not added again if already present |
| GET 404 (ticket not found) | Logs "work item not found", exits 0 |
| PATCH 400 (invalid state) | Logs error, exits 1 |
| PATCH 5xx (server error) | Retries once after 2 seconds |

## Running Unit Tests

The project uses Node.js built-in test runner (`node:test`). All tests are mocked and require no network access or Azure credentials.

### Run all tests

```bash
npm test
```

This runs all test files in the `tests/` directory.

### Run specific test file

```bash
node --test tests/lib.test.js
node --test tests/update-ticket.test.js
```

### Test coverage

- `tests/lib.test.js`: Tests ticket ID extraction and action decision logic
- `tests/update-ticket.test.js`: Tests the main script with mocked fetch

All tests pass with no external dependencies.

## Live Testing with Real Credentials

Once you have added Azure credentials to GitHub, you can test the actual sync behavior:

### 1. Create a Test Work Item

1. Go to your Azure Boards project
2. Create a new work item (e.g., Bug #123)
3. Note the work item ID

### 2. Create a Test PR

1. Create a branch with the ticket ID:
   ```bash
   git checkout -b feature/AB#123-test
   ```
2. Make a small change (e.g., add a comment)
3. Commit and push
4. Create a PR targeting main

### 3. Verify the Sync

1. The `require-ticket-id` check should pass
2. The `Update Azure Board Ticket` job should run
3. Check the job logs:
   - Should show `[board-sync]` prefixed messages
   - Should not show the PAT value
4. Go to Azure Boards and verify:
   - Work item state changed to `STATE_OPEN`
   - PR link added as a hyperlink
   - Comment added to the history

### 4. Test Draft PR

1. Create the PR as a draft
2. Verify:
   - State did not change
   - Link and comment were added
3. Mark PR as ready for review
4. Verify:
   - State changed to `STATE_OPEN`
   - Another comment added

### 5. Test Merge

1. Merge the PR
2. Verify:
   - State changed to `STATE_MERGED`
   - Comment about merge added

### 6. Test Close Without Merge

1. Create another PR with a different ticket ID
2. Close the PR without merging
3. Verify:
   - State did not change
   - Comment "PR closed without merge" added

## Testing Without Credentials

To test the graceful degradation behavior:

1. Remove or temporarily unset the Azure credentials
2. Create a PR with a ticket ID
3. Verify:
   - `require-ticket-id` check still passes
   - `Update Azure Board Ticket` job shows warning
   - Job exits with code 0 (green checkmark)
   - No API calls were made

## Debugging Failed Runs

If a run fails, check the job logs:

1. Click on the failed job in the Actions tab
2. Expand the "Sync ticket" step
3. Look for `[board-sync]` prefixed messages
4. Common errors:
   - `GET failed: 401` - PAT expired or invalid
   - `GET failed: 403` - PAT lacks permissions
   - `PATCH failed: 400` - Invalid state name or other validation error
   - `PATCH failed: 404` - Work item not found
   - `fetch error` - Network issue or invalid URL

See [Troubleshooting](troubleshooting.md) for detailed error handling.

## Test Data

You can create a local test event JSON file to test the script locally:

```bash
# Create a test event file
cat > test-event.json <<EOF
{
  "action": "opened",
  "pull_request": {
    "head": {
      "ref": "feature/AB#123-test",
      "repo": {
        "fork": false
      }
    },
    "title": "Fix bug AB#123",
    "body": "Ticket: AB#123",
    "draft": false,
    "merged": false,
    "html_url": "https://github.com/repo/pull/1",
    "number": 1
  }
}
EOF

# Run the script with the test event
GITHUB_EVENT_PATH=test-event.json \
  AZURE_ORG=your-org \
  AZURE_PROJECT=your-project \
  AZURE_DEVOPS_PAT=your-pat \
  node .github/scripts/update-ticket.js
```

This allows you to test the script locally before pushing to GitHub.
