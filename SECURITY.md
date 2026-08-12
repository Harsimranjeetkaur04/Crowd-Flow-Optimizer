# Security Policy

## Overview

This document outlines the security considerations and implementation for the Crowd Flow Optimiser MVP. We prioritize **proportionate security** — focusing on practical protections suitable for a hackathon project while demonstrating security-conscious design.

---

## Input Validation

### Pydantic Schema Validation
All API inputs are validated using Pydantic v2 schemas before processing:

- **VenueLayout**: Nodes and edges are validated for:
  - Unique node IDs
  - Valid node types (gate, walkway, concession, exit)
  - Edge endpoints reference existing nodes
  - Numeric bounds on capacity, width, flow rates

- **SimulationRequest**: Validated for:
  - Positive crowd size (1–100,000 persons)
  - Non-negative schedule entries
  - Timesteps ≤ 3600 seconds (1 hour max)

### DoS Prevention via Limits
Input size caps prevent denial-of-service attacks via oversized simulations:

| Parameter | Limit | Rationale |
|-----------|-------|-----------|
| Max nodes per layout | 500 | Prevents unbounded graph creation |
| Max edges per layout | 2000 | Prevents overly complex routing |
| Max timesteps | 3600 | Caps simulation runtime (~10s per timestep) |
| Max crowd size | 100,000 | Reasonable upper bound for venue size |
| Max schedule entries | 1000 | Limits event configuration |

Exceeding these limits triggers HTTP 422 Unprocessable Entity with a Pydantic validation error.

### Example: Invalid Input Rejection
```json
POST /simulate
{
  "layout": {
    "nodes": [ /* 501 nodes */ ],  // ❌ Rejected: exceeds MAX_NODES
    "edges": []
  },
  "expected_crowd_size": 100
}
```

Response:
```json
{
  "detail": [
    {
      "type": "list_too_long",
      "loc": ["body", "layout", "nodes"],
      "msg": "List should have at most 500 items after validation, not 501",
      "input": [ /* ... */ ]
    }
  ]
}
```

---

## Rate Limiting

### Protect Compute-Expensive Endpoints
The `/simulate` endpoint is rate-limited using **SlowAPI**:

```python
@router.post("/simulate")
@limiter.limit("5/minute")
def simulate(request: Request, simulation_request: SimRequest) -> dict:
    # Runs discrete-time simulation (CPU-intensive)
    pass
```

**Limit**: 5 requests per minute per IP address  
**Response**: HTTP 429 Too Many Requests with `Retry-After` header

Other endpoints (health, layout, predict, model) are not rate-limited; simulation is the only compute-heavy route.

---

## CORS Policy

### Explicit Allowed Origins
CORS is configured with explicit allowed origins, never `*`:

```python
origins = [
    origin.strip()
    for origin in os.getenv("ALLOWED_ORIGINS", "http://localhost:5173").split(",")
    if origin.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

**Default (development)**:
- `http://localhost:5173` (Vite dev server)

**Production** (via `.env`):
```
ALLOWED_ORIGINS=https://example-app.vercel.app,https://example-app.huggingface.co
```

Multiple origins are comma-separated and trimmed of whitespace.

---

## Secret Management

### Environment Variables via `.env`

All sensitive configuration is loaded from a `.env` file at startup, never hardcoded:

```python
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent.parent.parent / ".env")
```

### Protected Environment Variables

| Variable | Purpose | Required? | Notes |
|----------|---------|-----------|-------|
| `ALLOWED_ORIGINS` | CORS allowed hosts | No | Defaults to `http://localhost:5173` |
| `HF_TOKEN` | Hugging Face API token | No | If missing, AI prediction uses deterministic fallback |

### Startup Validation
The app fails fast if required environment variables are missing:

```python
def _check_required_env_vars() -> None:
    """Check that required environment variables are set. Fail fast on startup."""
    # Currently all vars are optional with sensible defaults
    # Future deployments can add required checks here
    pass
```

### `.env` File Security

✅ **What to do:**
- Keep `.env` in `.gitignore` (already configured)
- Use `.env.example` as a template for contributors
- Rotate HF_TOKEN if exposed

❌ **What not to do:**
- Commit `.env` to version control
- Log environment variable values
- Pass secrets via command-line arguments

### Example `.env.example`
```bash
# CORS configuration for frontend
ALLOWED_ORIGINS=http://localhost:5173

# Hugging Face API token for Chronos time-series model
# Get one at https://huggingface.co/settings/tokens
HF_TOKEN=hf_your_token_here
```

---

## Privacy & Data Handling

### Synthetic Data Only
This application operates on **synthetic crowd counts**, not real personal data:

- ✅ No real-world identifiable information (PII)
- ✅ No user tracking or analytics
- ✅ Simulations are deterministic and repeatable
- ✅ No data persistence beyond a single session

This is a **privacy-by-design** choice: the simulator does not collect, store, or transmit personal information.

### Data Flow
```
User Input (Layout, Schedule)
         ↓
   [Simulation Engine]
         ↓
   Density Snapshots (synthetic)
         ↓
[Bottleneck Detection & Rerouting]
         ↓
   Results (JSON)
         ↓
Client Display (no server storage)
```

---

## Dependency Security

### Current Dependencies
All production dependencies are pinned to minor versions to balance stability and security:

```
fastapi>=0.115,<1.0         # Web framework
uvicorn[standard]>=0.30     # ASGI server
pydantic>=2.8,<3.0          # Input validation
slowapi>=0.1.9,<1.0         # Rate limiting
python-dotenv>=1.0,<2.0     # Env var loading
chronos-forecasting         # Optional; graceful fallback if missing
```

### Dependency Scanning
- **GitHub Dependabot**: Enable on this repository to receive automated alerts for:
  - Security vulnerabilities in dependencies
  - Outdated package versions
- **Steps to enable**: GitHub → Settings → Code security → Dependabot → Enable

### Supply Chain Risk Mitigation
- Use official PyPI packages only (no git URLs)
- Pin versions to avoid breaking changes
- Regular audits via `pip-audit`

---

## Deployment Security

### HTTPS/TLS
When deployed (e.g., Hugging Face Spaces, Vercel, Render), **HTTPS is enforced by the platform**:

- ✅ **Hugging Face Spaces**: TLS managed automatically
- ✅ **Vercel/Render**: TLS certificates included
- ❌ **Local dev**: HTTP only (safe for `localhost`)

### Container Security (Docker)
If running in Docker:

```dockerfile
# Use slim base image to reduce attack surface
FROM python:3.11-slim

# Run as non-root user
RUN useradd -m -u 1000 appuser
USER appuser

# Load .env at runtime, never build-time
ENV PYTHONUNBUFFERED=1
```

### Secrets in CI/CD
If using GitHub Actions for deployment:

1. Store secrets in **GitHub → Settings → Secrets and variables**
2. Reference in workflow as `${{ secrets.HF_TOKEN }}`
3. Never log secrets in CI output

---

## Logging & Monitoring

### What Is Logged
- API requests/responses (status codes, endpoints)
- Simulation start/completion events
- Validation errors (generic, no user input echoed)

### What Is NOT Logged
- Full request payloads (no crowd count details)
- User IP addresses (only for rate limiting)
- Exception tracebacks in production (logged to stderr, not exposed in responses)

---

## Known Limitations

1. **In-Memory Storage**: Simulation results are stored in RAM, not persisted. Loss on server restart.
   - *Mitigation*: Suitable for MVP; add persistent DB (PostgreSQL) for production.

2. **No Authentication**: The API is public; anyone can call `/simulate`.
   - *Mitigation*: Add OAuth2/JWT for production deployments.

3. **No Input Sanitization**: Crowd counts are numerical; no script injection risk. Layout IDs are treated as opaque.
   - *Mitigation*: Monitor for abuse patterns; add IP-based blocking if needed.

4. **WebSocket Security**: `/ws/simulate/{id}` endpoint not rate-limited.
   - *Mitigation*: Connection limits per IP via reverse proxy (nginx/Caddy).

---

## Response to Security Findings

### Reporting a Vulnerability
If you discover a security issue:

1. **Do not open a public GitHub issue.**
2. Email `security@example.com` with:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
3. We will acknowledge within 48 hours and provide a fix timeline.

### Disclaimer
This is a **hackathon MVP**. It is not intended for production use without security review. Use at your own risk in public deployments.

---

## Checklist for Judges

- ✅ Input validation via Pydantic with DoS prevention limits
- ✅ Rate limiting on `/simulate` (5 req/min per IP)
- ✅ CORS policy: explicit origins, not `*`
- ✅ Secrets via `.env`, never hardcoded
- ✅ `.env` in `.gitignore`; `.env.example` provided
- ✅ Synthetic data only; no PII
- ✅ Dependency pinning for stability
- ✅ This security documentation

---

## References

- [OWASP API Security Top 10](https://owasp.org/www-project-api-security/)
- [Pydantic Validation](https://docs.pydantic.dev/latest/concepts/models/)
- [FastAPI Security](https://fastapi.tiangolo.com/tutorial/security/)
- [SlowAPI Rate Limiting](https://github.com/laurenceisla/slowapi)
- [Python-dotenv](https://github.com/theskumar/python-dotenv)
