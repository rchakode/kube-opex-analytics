# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

`kube-opex-analytics` is a Kubernetes usage analytics and cost optimization tool. It provides hourly, daily, and monthly resource consumption analytics (CPU, Memory, GPU) to help organizations track and optimize Kubernetes cluster costs.

**Tech Stack:**

- **Backend**: Python 3 with Flask, RRDtool for time-series storage, Prometheus client for metrics export
- **Frontend**: JavaScript with jQuery, Bootstrap/Bootswatch, RequireJS (module loading), D3.js (visualization)
- **Data Sources**: Kubernetes Metrics Server (CPU/memory), NVIDIA DCGM Exporter (GPU)
- **Deployment**: Docker containerized, Kubernetes native (Helm charts)

## Development Commands

### Dependency Management

```bash
# Install dependencies
uv sync
```

### Testing & Linting

```bash
# Run tests
uv run pytest

# Run linting
uv run ruff check .

# Format code
uv run ruff format .
```

### Local Development

```bash
# Debug mode (requires kubectl access to cluster)
./run-debug.sh <cluster_name>

# Docker debug mode
./run-debug-docker.sh
```

### Building

```bash
# Build Docker image
docker build -t kube-opex-analytics .
```

## Architecture

### Core Components

- **`backend.py`**: Main Flask application (1113 lines) - handles Kubernetes API polling, data processing, and web API
- **`js/frontend.js`**: Frontend application using RequireJS module system and D3.js for data visualization
- **`index.html`**: Jinja2 template serving the web dashboard
- **RRDtool databases**: Time-series storage for metrics (stored in `/data` volume)

### Data Flow

1. Metrics polling every 5 minutes (configurable via `KOA_POLLING_INTERVAL_SEC`):
   - CPU/Memory: Kubernetes Metrics Server API
   - GPU: NVIDIA DCGM Exporter metrics
2. Metrics processing and consolidation into hourly/daily/monthly aggregates
3. RRDtool database storage for time-series data
4. Flask API endpoints serve data to frontend
5. D3.js renders interactive dashboards

### Key Classes and Functions

- `K8sUsage`: Metrics collection and processing (pods/nodes aggregation)
- `Rrd`: Encapsulates RRD persistence, trend/histogram exports, Prometheus gauges
- `Config`: Environment-backed configuration loader
- `decode_capacity()`: Kubernetes resource unit parsing (CPU/memory)

## Configuration

The application uses environment variables for configuration:

### Essential Variables

- `KOA_K8S_API_ENDPOINT`: Kubernetes API server URL
- `KOA_K8S_AUTH_TOKEN`: Service account token for API access
- `KOA_DB_LOCATION`: Path for RRDtool databases (default: `/data`)
- `KOA_COST_MODEL`: Billing model - `CUMULATIVE_RATIO` (default), `RATIO`, or `CHARGE_BACK`

### Optional Variables

- `KOA_BILLING_HOURLY_RATE`: Hourly cost rate for charge-back model (default: -1.0 unless set)
- `KOA_BILLING_CURRENCY_SYMBOL`: Currency symbol (default: '$')
- `KOA_POLLING_INTERVAL_SEC`: Metrics collection interval (default: 300)
- `KOA_K8S_API_VERIFY_SSL`: SSL verification for API calls (default: true)

## Testing Strategy

- `test_backend.py`: Unit tests for core functionality (CPU/memory capacity decoding)
- Tooling relies on `uv`; sync environments with `uv sync --frozen --group dev` and run checks via `uv run`
- Tests focus on Kubernetes resource unit parsing and data processing logic

## Frontend Architecture

- **Module System**: RequireJS for dependency management
- **UI Framework**: Bootstrap via Bootswatch theme, jQuery for DOM manipulation
- **Visualization**: D3.js library for charts (line, area, donut, legends)
- **Data Types**: CPU, memory, GPU, and consolidated usage metrics
- **API Integration**: RESTful endpoints for fetching time-series data

## Versioning

The project uses [Calendar Versioning](https://calver.org/) with format `YY.MM.MICRO`. Version must be updated in these files:

| File | Location |
|------|----------|
| `backend.py` | `Config.version` (line ~56) |
| `pyproject.toml` | `version` field |
| `manifests/helm/Chart.yaml` | `version` and `appVersion` fields |
| `manifests/kustomize/kustomization.yaml` | `images[].newTag` field |

## Development Notes

- The application runs on port 5483 by default
- Uses Waitress WSGI server in production
- Supports both standalone and Kubernetes deployment via Helm charts
- Frontend assets include Bootstrap for styling
- Prometheus exporter available at `/metrics` endpoint for integration with monitoring systems
