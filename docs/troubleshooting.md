# Troubleshooting

## Common Errors and Solutions

### 401 Unauthorized

**Symptoms:**
- Job logs show: `GET failed: 401` or `PATCH failed: 401`
- Sync job fails with red X

**Causes:**
- PAT has expired
- PAT is invalid or corrupted
- PAT was copied incorrectly

**Solutions:**
1. Regenerate the PAT in Azure DevOps
2. Update the `AZURE_DEVOPS_PAT` secret in GitHub
3. Verify the PAT with a curl command (see [Azure Boards Setup](setup-azure-boards.md))

### 403 Forbidden

**Symptoms:**
- Job logs show: `GET failed: 403` or `PATCH failed: 403`
- Sync job fails with red X

**Causes:**
- PAT lacks Work Items (Read & write) scope
- User does not have permission to modify work items in the project
- Project access has been revoked

**Solutions:**
1. Verify PAT has "Work Items: Read & write" scope
2. Check user permissions in Azure DevOps project
3. Ensure the user is a member of the project

### 400 Bad Request (State Error)

**Symptoms:**
- Job logs show: `PATCH failed: 400`
- Response body mentions invalid state or field value

**Causes:**
- `STATE_OPEN` or `STATE_MERGED` is set to a non-existent state
- State name has a typo
- State name is case-sensitive and doesn't match

**Solutions:**
1. Verify the exact state names in your Azure Boards project
2. Check the process template (Agile, Scrum, Basic, CMMI)
3. Update the `STATE_OPEN` and `STATE_MERGED` variables in GitHub
4. See [State Mapping](state-mapping.md) for default values

### 404 Not Found

**Symptoms:**
- Job logs show: `work item not found`
- Sync job exits with code 0 (green checkmark)

**Causes:**
- Work item ID does not exist in the project
- Ticket ID in branch/title/body is incorrect
- Work item was deleted

**Solutions:**
1. Verify the work item exists in Azure Boards
2. Check the ticket ID in the PR (AB#123 vs AB-456)
3. Ensure the work item is in the correct project

### Workflow Not Triggering

**Symptoms:**
- No workflow runs appear in the Actions tab
- PR checks don't run

**Causes:**
- Workflow file is not on the base branch (main)
- Workflow file has syntax errors
- Trigger types don't match the event

**Solutions:**
1. Ensure the workflow file is pushed to the main branch first
2. Check the workflow YAML syntax (indentation, colons, etc.)
3. Verify the trigger includes the correct event types:
   ```yaml
   on:
     pull_request:
       types: [opened, reopened, ready_for_review, closed]
   ```

### Fork PRs Not Syncing

**Symptoms:**
- Job logs show: `skipping fork PR (no secrets available)`
- No updates to Azure Boards for fork PRs

**Causes:**
- Fork PRs cannot access repository secrets (by design)
- Script explicitly checks for fork PRs and skips them

**Solutions:**
- This is expected behavior for security
- If you need to support fork PRs, consider using `pull_request_target` (but be aware of security implications)
- Alternatively, have contributors work in the main repository

### Duplicate PR Links

**Symptoms:**
- Multiple PR links appear in the work item
- Same PR linked multiple times

**Causes:**
- Link deduplication logic is not working
- PR URL comparison is case-sensitive or has trailing slashes

**Solutions:**
- The script should check for existing links before adding
- If you see duplicates, it may be a bug - check the script logic
- Manually remove duplicate links in Azure Boards

### "Not Configured" Warning

**Symptoms:**
- Job logs show: `::warning::Azure Boards not configured, skipping`
- Job exits with code 0 (green checkmark)

**Causes:**
- `AZURE_ORG`, `AZURE_PROJECT`, or `AZURE_DEVOPS_PAT` is missing
- Variables or secrets not set in GitHub

**Solutions:**
1. Add the missing variables and secrets in GitHub
2. Verify the names match exactly (case-sensitive)
3. See [GitHub Setup](setup-github.md) for detailed instructions

### PR Checks Failing

**Symptoms:**
- `require-ticket-id` check fails with red X
- Error message: "PR must reference a ticket like AB#123"

**Causes:**
- No ticket ID in branch name, title, or body
- Ticket ID format is incorrect (e.g., TICKET#123 instead of AB#123)

**Solutions:**
1. Add a ticket ID in one of these locations:
   - Branch name: `feature/AB#123-fix`
   - PR title: `Fix bug AB#123`
   - PR body: `Ticket: AB#123`
2. Use the correct format: `AB#123` or `AB-123`
3. The regex is case-insensitive, so `ab#123` also works

### Rate Limiting (429)

**Symptoms:**
- Job logs show: `retrying after 2s (status 429)`
- Job may succeed after retry or fail

**Causes:**
- Too many API requests to Azure DevOps
- Exceeded rate limits

**Solutions:**
- The script automatically retries once after 2 seconds
- If rate limits are consistently hit, consider:
  - Reducing the frequency of PR events
  - Contacting Azure DevOps support for higher limits

### Network Errors

**Symptoms:**
- Job logs show: `fetch error: ...`
- Connection timeout or DNS resolution failure

**Causes:**
- Network connectivity issues
- Invalid `AZURE_BASE_URL`
- Firewall blocking requests

**Solutions:**
1. Verify network connectivity from GitHub Actions runners
2. Check `AZURE_BASE_URL` is correct (default: `https://dev.azure.com`)
3. If using a self-hosted Azure DevOps instance, ensure the URL is accessible
4. Check firewall rules allow outbound HTTPS requests

## Getting Help

If you encounter an error not listed here:

1. Check the full job logs in the Actions tab
2. Look for `[board-sync]` prefixed messages
3. Verify your configuration matches the setup guides
4. Review the test matrix in [Testing](testing.md)
5. Check the Azure DevOps API documentation for error codes

## Debug Mode

To get more detailed logging, you can modify the script locally:

```javascript
// In update-ticket.js, add more console.log statements
const log = (msg) => console.log(`[board-sync] ${msg}`);
const debug = (msg) => console.log(`[board-sync][debug] ${msg}`);
```

Use the debug log for variables and intermediate values. Remember not to log the PAT.
