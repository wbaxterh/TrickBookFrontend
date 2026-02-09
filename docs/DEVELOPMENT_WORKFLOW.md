# TrickBook Development Workflow

## Code Change Process

This document outlines our standard process for making code changes to the TrickBook mobile app.

### 1. Create a GitHub Issue

Before starting work, create an issue to track the task:

```bash
gh issue create --repo wbaxterh/TrickBookFrontend \
  --title "Brief description of the issue" \
  --body "## Description
Detailed explanation of the problem or feature.

## Expected Behavior
What should happen.

## Current Behavior
What currently happens (for bugs).

## Acceptance Criteria
- [ ] Criterion 1
- [ ] Criterion 2

## Priority
High/Medium/Low"
```

### 2. Create a Feature Branch

Branch off from `v2-rebuild` (our main development branch):

```bash
git checkout v2-rebuild
git pull
git checkout -b fix/issue-description   # For bug fixes
# OR
git checkout -b feature/feature-name    # For new features
```

**Branch naming conventions:**
- `fix/` - Bug fixes
- `feature/` - New features
- `refactor/` - Code refactoring
- `docs/` - Documentation changes

### 3. Make Your Changes

1. Write your code
2. Test locally on iOS simulator and/or Android emulator
3. Commit with clear messages:

```bash
git add <files>
git commit -m "Brief description of change

- Detail 1
- Detail 2

Fixes #<issue-number>

Co-Authored-By: Your Name <email>"
```

### 4. Push and Create Pull Request

```bash
git push -u origin <branch-name>

gh pr create --repo wbaxterh/TrickBookFrontend \
  --title "Fix: Brief description" \
  --body "## Summary
- Change 1
- Change 2

## Test plan
- [ ] Test step 1
- [ ] Test step 2

Fixes #<issue-number>" \
  --base v2-rebuild
```

### 5. Merge and Clean Up

After review/approval:

```bash
gh pr merge <pr-number> --repo wbaxterh/TrickBookFrontend --squash --delete-branch
```

The issue will auto-close if you included `Fixes #<issue-number>` in the PR.

### 6. Update Local Branch

```bash
git checkout v2-rebuild
git pull
```

---

## Building and Deploying

### Local Development

```bash
npx expo start
# Press 'i' for iOS simulator
# Press 'a' for Android emulator
```

### Building for App Stores

**iOS (TestFlight):**
```bash
eas build --profile testflight --platform ios
eas submit -p ios --latest
```

**Android (Play Store):**
```bash
eas build --profile playstore --platform android
eas submit -p android --latest --profile playstore
```

---

## Environment Variables & Secrets

### Local Development
- Store secrets in `.env` file (gitignored)
- Example: `GOOGLE_MAPS_API_KEY=your_key_here`

### EAS Builds
- Store secrets using EAS:
```bash
eas secret:create --name SECRET_NAME --value "secret_value" --scope project
```

### Configuration
- `app.config.js` reads from `process.env` for sensitive values
- Never commit API keys or secrets to git

---

## Important Branches

| Branch | Purpose |
|--------|---------|
| `v2-rebuild` | Main development branch |
| `master` | Legacy (do not use) |

---

## Useful Commands

```bash
# Check issue status
gh issue list --repo wbaxterh/TrickBookFrontend

# Check PR status
gh pr list --repo wbaxterh/TrickBookFrontend

# View issue details
gh issue view <number> --repo wbaxterh/TrickBookFrontend

# Close an issue
gh issue close <number> --repo wbaxterh/TrickBookFrontend --reason completed
```
