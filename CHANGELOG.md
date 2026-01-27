# Release Notes

## v26.01.0-beta2

### Highlights
This release enhances Helm chart distribution with OCI registry support and GitHub Pages hosting, fixes GPU capacity tracking issues, and improves security documentation.

### New Features

#### Helm Chart Distribution
- **OCI Registry Support**: Helm charts now pushed to GHCR as OCI artifacts
- **Latest Tag**: Charts automatically tagged as `latest` for easier installation
- **GitHub Pages Hosting**: Traditional Helm repository available via GitHub Pages
- **ORAS Integration**: Added ORAS tooling for OCI artifact management

#### GPU Capacity Tracking
- **Node GPU Capacity**: Track total GPU capacity per node alongside utilization
- **Improved Tooltips**: Node tooltips now display GPU capacity information

### Bug Fixes
- Fixed GPU capacity field names for correct data collection
- Fixed node tooltip display for GPU metrics
- Fixed Helm chart configuration issues

### Documentation
- Added detailed DCGM integration parameters documentation
- Enhanced SECURITY.md with comprehensive security guidelines
- Updated security contact email address
- Renamed RELEASES.md to CHANGELOG.md

### CI/CD
- Added Helm chart release workflow with automatic versioning
- GitHub Actions workflow for chart packaging and publishing

---

## v26.01.0-beta1

### Highlights
This release introduces comprehensive GPU metrics support via NVIDIA DCGM Exporter integration, modernized Python tooling, and significant UI/UX improvements including dark mode support.

### New Features

#### GPU Metrics Support
- **NVIDIA DCGM Integration**: Full support for GPU metrics collection via NVIDIA DCGM Exporter
- **GPU Compute & Memory Views**: Separate monitoring views for GPU utilization and memory usage
  - GPU Compute: Shows GPU utilization percentage per pod
  - GPU Memory: Shows GPU memory usage per pod
- **GPU Node Heatmap**: Heatmap visualization for GPU nodes showing compute and memory utilization
- **Per-pod GPU Usage Charts**: Breakdown of GPU usage by pod within each node
- **Conditional GPU Charts**: GPU charts display only when DCGM endpoint is configured
- **Helm Chart Support**: Added DCGM Exporter configuration options in Helm chart

#### Theme & UI Improvements
- **Light and Dark Themes**: Added support for light and dark mode color schemes
- **Theme-aware Legend Colors**: Legend text colors adapt to the selected theme
- **Enhanced Heatmap Labels**: Improved label visibility and positioning
- **Better Tooltip Positioning**: Tooltips now position correctly across all views

#### Node Heatmap
- **Node Heatmap API**: New `/api/nodes/heatmap` endpoint for cluster-wide node visualization
- **Resource Utilization View**: Visual representation of CPU, Memory, and GPU usage across nodes

### Infrastructure & Build

#### Python Tooling Modernization
- **pyproject.toml**: Migrated from setup.py to modern pyproject.toml-based configuration
- **uv Package Manager**: Adopted uv for faster, more reliable dependency management
- **Ruff Linter**: Integrated Ruff for code formatting and linting

#### Container & CI/CD
- **Ubuntu 24.04 Base Image**: Upgraded container base image for improved security and performance
- **Docker Workflow Improvements**: Enhanced CI/CD pipeline for main branch pushes and PR builds
- **Variable-based Docker Registry**: Flexible Docker repository naming via CI variables
- **GitHub Actions Updates**: Bumped astral-sh/setup-uv and github/codeql-action versions

### Bug Fixes
- Fixed regression in GPU metrics processing
- Fixed Y-axis rounding to 2 decimal places in stacked bar charts
- Fixed typo in pyproject.toml that was breaking Docker builds
- Removed logging of sensitive billing hourly rate
- Cleaned up unused variables and missing declarations
- Removed deprecated Azure and GCP pricing cost code

### Documentation
- Updated README with accurate tech stack and installation instructions
- Added CLAUDE.md with development guidelines and versioning information
- Documented minimum version requirements for GPU support

### Breaking Changes
- GPU metrics now require NVIDIA DCGM Exporter to be deployed in the cluster
- Environment variable `KOA_DCGM_EXPORTER_ENDPOINT` required for GPU monitoring

---

## v25.10.0

### Features
- Initial node heatmap API endpoint
- Light and dark theme support
- Improved error handling

---

For upgrade instructions, see the [README](README.md).