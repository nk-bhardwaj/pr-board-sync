# Azure Boards Setup

## Get Organization and Project Names

1. Navigate to your Azure Boards project
2. Look at the URL: `https://dev.azure.com/{org}/{project}/_boards`
3. Extract:
   - `AZURE_ORG`: The `{org}` part
   - `AZURE_PROJECT`: The `{project}` part

Example:
- URL: `https://dev.azure.com/mycompany/MyProject/_boards`
- `AZURE_ORG`: `mycompany`
- `AZURE_PROJECT`: `MyProject`

## Create a Personal Access Token (PAT)

1. Go to [Azure DevOps](https://dev.azure.com)
2. Click your profile icon → **Security** (or go directly to `https://dev.azure.com/_usersSettings/tokens`)
3. Click **+ New Token**
4. Fill in:
   - **Name**: `pr-board-sync` (or any descriptive name)
   - **Organization**: Select your organization
   - **Expiration**: Choose an appropriate expiry (90 days, 1 year, or custom)
   - **Scopes**: Check **Work Items** → **Read & write**
5. Click **Create**
6. **Copy the token immediately** - you won't see it again

## State Names by Process Template

Azure Boards uses different state names depending on the process template. Choose the appropriate states for your project:

### Agile Process

| State | Description |
|-------|-------------|
| New | Newly created work item |
| Active | Work in progress |
| Resolved | Implementation complete, awaiting verification |
| Closed | Verified and complete |

**Recommended mapping:**
- `STATE_OPEN`: `"Active"`
- `STATE_MERGED`: `"Closed"`

### Scrum Process

| State | Description |
|-------|-------------|
| New | Newly created work item |
| Approved | Approved for implementation |
| Committed | Work in progress |
| Done | Complete and verified |

**Recommended mapping:**
- `STATE_OPEN`: `"Committed"`
- `STATE_MERGED`: `"Done"`

### Basic Process

| State | Description |
|-------|-------------|
| To Do | Not started |
| Doing | Work in progress |
| Done | Complete |

**Recommended mapping:**
- `STATE_OPEN`: `"Doing"`
- `STATE_MERGED`: `"Done"`

### CMMI Process

| State | Description |
|-------|-------------|
| Proposed | Proposed work item |
| Active | Work in progress |
| Resolved | Implementation complete |
| Closed | Verified and complete |

**Recommended mapping:**
- `STATE_OPEN`: `"Active"`
- `STATE_MERGED`: `"Closed"`

## Verify Your Token and State Names

Use this curl command to verify your PAT and check available states:

```bash
curl -u ":YOUR_PAT" \
  "https://dev.azure.com/YOUR_ORG/YOUR_PROJECT/_apis/wit/workitemtypes?api-version=7.1"
```

Replace:
- `YOUR_PAT`: Your Personal Access Token
- `YOUR_ORG`: Your Azure DevOps organization
- `YOUR_PROJECT`: Your Azure DevOps project

The response will show all work item types and their state fields. Look for the `System.State` field values.

## Verify Token Permissions

Test that your token has the correct permissions by fetching a work item:

```bash
curl -u ":YOUR_PAT" \
  "https://dev.azure.com/YOUR_ORG/YOUR_PROJECT/_apis/wit/workitems/1?api-version=7.1"
```

If you get a 200 response, your token has read access. To test write access, you can use a PATCH request (see [Testing](testing.md)).

## Common Issues

### 401 Unauthorized

- PAT may be expired
- PAT may not have the correct scope (Work Items: Read & write)
- Organization name may be incorrect

### 403 Forbidden

- PAT may not have write permissions
- User may not have permission to modify work items in the project

### 404 Not Found

- Project name may be incorrect
- Work item ID may not exist
- User may not have access to the project

## Add to GitHub

Once you have your PAT and state names:

1. Add the PAT as a GitHub secret named `AZURE_DEVOPS_PAT`
2. Add `AZURE_ORG` and `AZURE_PROJECT` as GitHub variables
3. Add `STATE_OPEN` and `STATE_MERGED` as GitHub variables (if not using defaults)
4. See [GitHub Setup](setup-github.md) for detailed instructions
