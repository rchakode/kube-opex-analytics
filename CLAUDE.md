# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

`kube-opex-analytics` is a Kubernetes usage analytics and cost optimization tool. It provides hourly, daily, and monthly resource consumption analytics to help organizations track and optimize Kubernetes cluster costs.

**Tech Stack:**
- Python 3 (Flask backend with RRDtool for time-series data)
- JavaScript frontend (RequireJS + Britecharts for visualization)
- Docker containerized deployment
- Kubernetes native integration

## Development Commands

### Testing
```bash
# Run tests
pytest

# Run tests with linting (recommended)
tox

# Run only linting
tox -e lint
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
- **`js/frontend.js`**: Frontend application using RequireJS module system and Britecharts for data visualization
- **`index.html`**: Jinja2 template serving the web dashboard
- **RRDtool databases**: Time-series storage for metrics (stored in `/data` volume)

### Data Flow
1. Kubernetes API polling every 5 minutes (configurable via `KOA_POLLING_INTERVAL_SEC`)
2. Metrics processing and consolidation into hourly/daily/monthly aggregates
3. RRDtool database storage for time-series data
4. Flask API endpoints serve data to frontend
5. Britecharts renders interactive dashboards

### Key Classes and Functions
- `K8sUsage`: Main metrics collection and processing class
- `PrometheusExporter`: Prometheus metrics integration
- `ConfigLoader`: Environment variable configuration management
- `decode_capacity()`: Kubernetes resource unit parsing (CPU/memory)

## Configuration

The application uses environment variables for configuration:

### Essential Variables
- `KOA_K8S_API_ENDPOINT`: Kubernetes API server URL
- `KOA_K8S_AUTH_TOKEN`: Service account token for API access
- `KOA_DB_LOCATION`: Path for RRDtool databases (default: `/data`)
- `KOA_COST_MODEL`: Billing model - `CUMULATIVE_RATIO` (default), `RATIO`, or `CHARGE_BACK`

### Optional Variables
- `KOA_BILLING_HOURLY_RATE`: Hourly cost rate for charge-back model (default: 9.92)
- `KOA_BILLING_CURRENCY_SYMBOL`: Currency symbol (default: '$')
- `KOA_POLLING_INTERVAL_SEC`: Metrics collection interval (default: 300)
- `KOA_K8S_API_VERIFY_SSL`: SSL verification for API calls (default: true)

## Testing Strategy

- `test_backend.py`: Unit tests for core functionality (CPU/memory capacity decoding)
- `tox.ini`: Comprehensive testing with flake8 linting
- Tests focus on Kubernetes resource unit parsing and data processing logic

## Frontend Architecture

- **Module System**: RequireJS for dependency management
- **Visualization**: Britecharts library for charts (bar, line, heatmap, donut)
- **Data Types**: CPU, memory, and consolidated usage metrics
- **API Integration**: RESTful endpoints for fetching time-series data

## Development Notes

- The application runs on port 5483 by default
- Uses Waitress WSGI server in production
- Supports both standalone and Kubernetes deployment via Helm charts
- Frontend assets include Bootstrap for styling and D3.js for chart foundations
- Prometheus exporter available at `/metrics` endpoint for integration with monitoring systems