# GitHub Actions CI/CD Pipeline

This directory contains GitHub Actions workflows for Continuous Integration and Continuous Deployment of the Crowd Flow Optimiser.

## Workflows

### 1. CI Pipeline (`ci.yml`) — Automatic on Push & PR

Runs on every push to `main` and all pull requests targeting `main`.

#### Jobs:

**Backend (Python 3.11)**
- ✅ Installs `requirements.txt`
- ✅ Lints code with [ruff](https://github.com/astral-sh/ruff) (warnings allowed)
- ✅ Runs pytest test suite
- 📊 Status badge: ![Backend](https://github.com/YOUR_USERNAME/crowd-flow-optimiser/actions/workflows/ci.yml/badge.svg?job=backend)

**Frontend (Node 20.x)**
- ✅ Installs dependencies with `npm ci`
- ✅ Lints code with ESLint (warnings allowed)
- ✅ Builds with `npm run build` (TypeScript strict mode + Vite)
- 📊 Status badge: ![Frontend](https://github.com/YOUR_USERNAME/crowd-flow-optimiser/actions/workflows/ci.yml/badge.svg?job=frontend)

**Docker Build**
- ✅ Builds backend Dockerfile
- ✅ Builds frontend Dockerfile
- ⚙️ **Depends on** both backend and frontend jobs passing
- ✅ Confirms Docker images compile cleanly
- 📊 Status badge: ![Docker](https://github.com/YOUR_USERNAME/crowd-flow-optimiser/actions/workflows/ci.yml/badge.svg?job=docker-build)

### 2. Deployment Workflow (`deploy.yml`) — Manual or Auto on Main Merge

Runs when code is merged to `main` (can be configured for manual approval in branch protection).

#### Jobs:

**Frontend → Vercel**
- Pushes frontend to Vercel for serverless hosting
- Requires: `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` secrets
- Output: Live URL in deployment status

**Backend → Hugging Face Spaces** (Recommended)
- Builds Docker image and prepares for HF Spaces
- Requires: `HF_TOKEN` secret with write access
- Instructions provided for manual Space setup (Docker SDK)

**Backend → Render** (Alternative)
- Pushes to Render.com for serverless backend
- Requires: `RENDER_DEPLOY_HOOK` secret
- Alternative if HF Spaces not preferred

### 3. Dependabot Configuration (`dependabot.yml`)

Automatically creates pull requests for dependency updates.

- **Python** (backend): Weekly updates on Mondays
- **npm** (frontend): Weekly updates on Mondays  
- **GitHub Actions**: Weekly updates on Mondays
- All PRs require review before merge (security best practice)

## Setup Instructions

### 1. Enable Workflows in GitHub

```bash
# Workflows are enabled by default
# No action needed unless you disabled them in repo settings
```

### 2. Frontend Deployment (Vercel)

```bash
# Step 1: Create Vercel project
# https://vercel.com/new → Import GitHub repo → crowd-flow-optimiser

# Step 2: Add secrets to GitHub repo settings
# Settings → Secrets and variables → Actions → New repository secret

# Add these secrets:
VERCEL_TOKEN         # From https://vercel.com/account/tokens
VERCEL_ORG_ID        # From Vercel dashboard
VERCEL_PROJECT_ID    # From Vercel project settings
```

### 3. Backend Deployment (Hugging Face Spaces) — RECOMMENDED

```bash
# Step 1: Create HF Space
# https://huggingface.co/spaces/new
# → Space name: crowd-flow-optimiser-api
# → SDK: Docker
# → Visibility: Public

# Step 2: Add HF_TOKEN secret to GitHub
# https://github.com/YOUR_USERNAME/crowd-flow-optimiser/settings/secrets
HF_TOKEN    # From https://huggingface.co/settings/tokens
            # Requires: repo write access, inference API access

# Step 3: Push backend/ to Space repo
git clone https://huggingface.co/spaces/YOUR_USERNAME/crowd-flow-optimiser-api
cd crowd-flow-optimiser-api
cp -r ../crowd-flow-optimiser/backend/* .
git add .
git commit -m "Initial backend deploy"
git push

# Step 4: Set environment variables in Space settings
# HF Space → Settings → Environment variables
ALLOWED_ORIGINS=https://YOUR_VERCEL_URL.vercel.app
HF_TOKEN=hf_your_token  # (optional, for Chronos model)
```

### 4. Backend Deployment (Render) — ALTERNATIVE

```bash
# Step 1: Create Render Web Service
# https://render.com/register → New → Web Service

# Step 2: Connect GitHub repo
# Settings → GitHub connection → Authorize

# Step 3: Add RENDER_DEPLOY_HOOK secret
# GitHub repo → Settings → Secrets
# Get hook from Render: Settings → Deploy hooks

RENDER_DEPLOY_HOOK=https://api.render.com/deploy/srv-xxxxx

# Step 4: Set environment variables in Render dashboard
# Render → Environment → Add variables
ALLOWED_ORIGINS=https://YOUR_URL
HF_TOKEN=hf_your_token  # (optional)
```

## Local Testing

### Test CI Locally

```bash
# Backend tests
cd backend
pip install -r requirements.txt
python -m pytest tests -v

# Backend linting
pip install ruff
ruff check app/ tests/

# Frontend linting
cd frontend
npm ci
npm run lint

# Frontend build
npm run build

# Docker builds
docker build -f backend/Dockerfile -t crowd-flow-backend:test .
docker build -f frontend/Dockerfile -t crowd-flow-frontend:test .
```

## Status Badges

Add to your README.md:

```markdown
## CI/CD Status

![CI Pipeline](https://github.com/YOUR_USERNAME/crowd-flow-optimiser/actions/workflows/ci.yml/badge.svg)
![Deploy](https://github.com/YOUR_USERNAME/crowd-flow-optimiser/actions/workflows/deploy.yml/badge.svg)
```

## Troubleshooting

### CI Fails with "Module not found"

**Backend**: Ensure `requirements.txt` is in the backend directory
```bash
cd backend
pip install -r requirements.txt
```

**Frontend**: Ensure `package-lock.json` exists
```bash
cd frontend
npm ci  # Regenerates lock file if needed
```

### Linting Fails in CI but Works Locally

```bash
# Ensure same versions locally
pip install ruff@VERSION_FROM_CI
npm install eslint@VERSION_FROM_CI
```

### Docker Build Fails

- Check Dockerfile syntax: `docker build -f Dockerfile .`
- Verify all dependency files present (requirements.txt, package.json)
- Check for missing environment variables at runtime

### Deployment Fails

**Vercel**: Check that `VITE_API_URL` is set correctly for production
**HF Spaces**: Ensure Docker image builds locally first
**Render**: Verify RENDER_DEPLOY_HOOK URL is valid

## Advanced Configuration

### Branch Protection Rules

Recommended settings for `main` branch:

```
Status checks that must pass before merging:
☑ Backend Tests & Lint
☑ Frontend Build & Lint
☑ Docker Build

Require branches to be up to date before merging: ☑
Require code review before merging: ☑ (1 approver)
Dismiss stale pull request approvals when new commits are pushed: ☑
```

### Custom Notifications

Workflows can be extended with Slack, Discord, or email notifications. Example:

```yaml
- name: Send Slack notification
  if: failure()
  uses: slackapi/slack-github-action@v1
  with:
    webhook-url: ${{ secrets.SLACK_WEBHOOK }}
    payload: |
      {"text": "CI Pipeline failed on main branch"}
```

### Matrix Testing

Test against multiple versions:

```yaml
strategy:
  matrix:
    python-version: ["3.9", "3.10", "3.11"]
    node-version: ["18.x", "20.x"]
```

## Security Considerations

- ✅ Secrets never logged (GitHub Actions masking)
- ✅ Dependency version pinning prevents supply chain attacks
- ✅ Dependabot updates reviewed before merge
- ✅ Docker images built with minimal base images
- ✅ Workflows run in isolated containers

## Further Reading

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Vercel GitHub Integration](https://vercel.com/docs/git)
- [HF Spaces Docker SDK](https://huggingface.co/docs/hub/spaces-sdks-docker)
- [Render Deploys](https://render.com/docs/deploy-hooks)
- [Dependabot](https://docs.github.com/en/code-security/dependabot)
