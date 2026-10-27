# State Mapping

## Event-to-State Mapping

The script maps GitHub PR events to Azure Boards work item states:

| GitHub PR Event | Condition | Azure Boards State | Variable |
|-----------------|-----------|-------------------|----------|
| `opened` | Not draft | `STATE_OPEN` (default: "Active") | `STATE_OPEN` |
| `reopened` | Not draft | `STATE_OPEN` (default: "Active") | `STATE_OPEN` |
| `ready_for_review` | - | `STATE_OPEN` (default: "Active") | `STATE_OPEN` |
| `opened` | Draft | No state change | - |
| `reopened` | Draft | No state change | - |
| `closed` | Merged | `STATE_MERGED` (default: "Closed") | `STATE_MERGED` |
| `closed` | Not merged | No state change | - |
| `synchronize` | - | No action | - |
| `edited` | - | No action | - |

## Default State Values

| Variable | Default Value | When to Change |
|----------|---------------|----------------|
| `STATE_OPEN` | `"Active"` | If your process uses different state names (e.g., "New", "In Progress", "Committed") |
| `STATE_MERGED` | `"Closed"` | If your process uses different state names (e.g., "Done", "Resolved") |

## Changing State Mapping

To customize the state mapping, add or modify the GitHub variables:

1. Go to repository **Settings** → **Secrets and variables** → **Actions**
2. Click **New repository variable** (or edit existing)
3. Add:
   - `STATE_OPEN`: Your desired state for open PRs
   - `STATE_MERGED`: Your desired state for merged PRs
4. Save

Example for Scrum process:
- `STATE_OPEN`: `"Committed"`
- `STATE_MERGED`: `"Done"`

Example for Basic process:
- `STATE_OPEN`: `"Doing"`
- `STATE_MERGED`: `"Done"`

## No State Change Scenarios

The following scenarios do not change the work item state:

- **Draft PRs**: Only adds a link and comment, preserves current state
- **Closed without merge**: Adds a comment about closure, preserves current state
- **Other events** (`synchronize`, `edited`): No action taken

This design allows manual state management in Azure Boards while still tracking PR activity via comments and links.

## State Transition Examples

### Example 1: Typical Flow (Agile Process)

1. Create work item in "New" state
2. Open PR with `AB#123` in branch name
3. Script sets state to "Active" (`STATE_OPEN`)
4. Work on the PR
5. Merge the PR
6. Script sets state to "Closed" (`STATE_MERGED`)

### Example 2: Draft PR Flow

1. Create work item in "New" state
2. Open draft PR with `AB#123` in title
3. Script adds link and comment, state remains "New"
4. Mark PR as ready for review
5. Script sets state to "Active" (`STATE_OPEN`)
6. Merge the PR
7. Script sets state to "Closed" (`STATE_MERGED`)

### Example 3: Manual State Management

1. Create work item in "In Progress" state
2. Open PR with `AB#123` in body
3. Script sets state to "Active" (overwrites "In Progress")
4. Manually change state to "In Progress" in Azure Boards
5. Close PR without merge
6. Script adds comment, state remains "In Progress"

## State Validation

The script does not validate that the target state exists in your Azure Boards project. If you set `STATE_OPEN` to a non-existent state, the PATCH request will fail with a 400 error.

To verify your state names, see [Azure Boards Setup](setup-azure-boards.md).
