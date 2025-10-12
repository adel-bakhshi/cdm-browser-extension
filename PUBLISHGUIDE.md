# Extension Publishing and Debug Guide

> 🧠 **Reminder**: This file exists because I tend to forget things!

## 🛠️ Prerequisites

### Before You Start

- **Node.js** must be installed on your system
- Verify Node.js installation: `node --version` (should be v16 or higher)
- Verify npm installation: `npm --version`

## 📥 Initial Setup

### Install Dependencies

```bash
# Navigate to src directory first
cd src

# Install packages using your preferred package manager
npm install
# OR
yarn install
# OR
pnpm install
```

## 🔍 Debugging the Extension

### Debug in Browser

```bash
# Make sure you're in the src directory
cd src

# Debug in Chrome
npx extension dev --browser=chrome

# Debug in Firefox
npx extension dev --browser=firefox
```

### Debugging Tips

- Chrome: Go to `chrome://extensions/` and enable "Developer mode"
- Firefox: Go to `about:debugging` and click "This Firefox"
- Check browser console for any errors
- Use `Logger` class in your code for tracing

## 🚀 Build & Publication Process

### Pre-Build Checklist

- Code is linted and formatted
- No console errors during debug mode

### Step 1: Update Documentation

```bash
# Update CHANGELOG.md with proper format:
# - Added: New features
# - Changed: Existing functionality changes
# - Fixed: Bug fixes
# - Removed: Deprecated features
```

**CHANGELOG Format Example:**

```markdown
## [1.2.3] - 2024-01-15

### Added

- New feature X

### Fixed

- Bug in Y component
```

### Step 2: Update Version Numbers

- Update version in `src/package.json`

```json
{
  "version": "1.2.3"
}
```

- Update version in `src/manifest.json`

```json
{
  "version": "1.2.3"
}
```

**Versioning Strategy:**

- `MAJOR.MINOR.PATCH`
- MAJOR: Breaking changes
- MINOR: New features (backward compatible)
- PATCH: Bug fixes

### Step 3: Create Git Tag

```bash
# Commit your changes first
git add .
git commit -m "release: v1.2.3 - [brief description of changes]"

# Create annotated tag
git tag -a v1.2.3 -m "Version 1.2.3: [description of changes]"

# Verify tag was created
git tag -l
```

### Step 4: Push to GitHub

```bash
# Push commits and tags to remote
git push origin main
git push origin --tags
```

### Step 5: Monitor GitHub Workflow

- Go to GitHub repository → Actions tab
- Wait for build workflow to complete
- Check that extension files are generated successfully
- Download built extension from workflow artifacts (if needed)

## 🌐 Browser-Specific Publication

### Chrome Publication

- **Automatic**: The extension will be available in GitHub Releases
- Download from Releases when needed
- No additional action required for Chrome store because it's not published

### Firefox Publication

```bash
# After GitHub workflow completes:
1. Go to https://addons.mozilla.org/
2. Navigate to Developer Dashboard
3. Upload new version from GitHub Releases
4. Submit for review (if required)
5. Wait for approval notification
```

**Firefox Submission Checklist:**

- Extension file downloaded from GitHub Releases
- Source code uploaded
- Release notes provided

## 📋 Final Release Checklist

### Pre-Release

- Node.js is installed and working
- Dependencies installed in `src/` directory
- Extension debugs successfully in both browsers
- CHANGELOG.md updated with correct format
- Version numbers updated in both package.json and manifest.json
- Git tag created with proper version
- Commits pushed to remote repository

### Post-Release

- GitHub workflow completed successfully
- Extension downloaded from Releases (Chrome)
- New version submitted to Firefox Add-ons (Firefox)
- Test installed extension in both browsers
- Update any related documentation

### Communication

- Notify team/community about new release
- Update any integration documentation
- Create release notes on GitHub

---

**Remember**: Breathe, check the list twice, and celebrate when it's done! 🎉
