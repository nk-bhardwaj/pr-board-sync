# GitHub Setup

## Create the Repository

1. Create a new GitHub repository (e.g., `pr-board-sync`)
2. **Important:** Push the code to the main branch first
   - Workflows only trigger when the workflow file exists on the base branch
   - If you push to a feature branch first, the workflow won't run

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/your-org/pr-board-sync.git
git push -u origin main
```

## Add GitHub Variables and Secrets

1. Go to repository **Settings** → **Secrets and variables** → **Actions**
2. Click **New repository variable** and add:

### Variables (non-secret)

| Variable | Value | Required | Default |
|----------|-------|----------|---------|
| `AZURE_ORG` | Your Azure DevOps organization name | Yes | - |
| `AZURE_PROJECT` | Your Azure DevOps project name | Yes | - |
| `AZURE_BASE_URL` | Azure DevOps base URL | No | `https://dev.azure.com` |
| `STATE_OPEN` | State for open PRs | No | `"Active"` |
| `STATE_MERGED` | State for merged PRs | No | `"Closed"` |

Example values:
- `AZURE_ORG`: `mycompany`
- `AZURE_PROJECT`: `MyProject`
- `AZURE_BASE_URL`: `https://dev.azure.com` (or your self-hosted URL)
- `STATE_OPEN`: `"Active"` (or `"New"`, `"In Progress"`, etc.)
- `STATE_MERGED`: `"Closed"` (or `"Done"`, `"Resolved"`, etc.)

### Secret

Click **New repository secret** and add:

| Secret | Value | Required |
|--------|-------|----------|
| `AZURE_DEVOPS_PAT` | Personal Access Token | Yes |

**Important:** Generate the PAT with the correct scope (see [Azure Boards Setup](setup-azure-boards.md)).

## Enable Branch Protection

1. Go to repository **Settings** → **Branches** → **Branch protection rules**
2. Click **Add new rule**
3. Enter branch name pattern: `main` (or your default branch)
4. Under "Require status checks to pass before merging":
   - Check `require-ticket-id`
   - Optionally check "Require branches to be up to date before merging"
5. Click **Create**

Now any PR targeting `main` must have a valid ticket ID (`AB#123` or `AB-123`) in the branch name, title, or body.

## Verify the Setup

1. Create a feature branch with a ticket ID:
   ```bash
   git checkout -b feature/AB#123-test
   ```
2. Make a small change and commit
3. Push and create a PR
4. The `require-ticket-id` check should pass
5. The `Update Azure Board Ticket` job should:
   - Run with a warning if credentials are not set
   - Update the work item if credentials are set

## Fork PR Behavior

Fork PRs are automatically skipped because they cannot access repository secrets. The script logs:

```
[board-sync] skipping fork PR (no secrets available)
```

This is by design for security. If you need to support fork PRs, consider using `pull_request_target` (but be aware of security implications).
