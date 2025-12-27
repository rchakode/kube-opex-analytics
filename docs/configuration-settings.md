#  kube-opex-analytics Configuration Variables
This section provides an exhaustive list of configuration variables used by `kube-opex-analytics`. 

> These are **startup environment variables** that require to restart the service when they are updated. 

* `KOA_DB_LOCATION` sets the path to use to store internal data. Typically when you consider to set a volume to store those data, you should also take care to set this path to belong to the mounting point.
* `KOA_K8S_API_ENDPOINT` sets the endpoint to the Kubernetes API.
* `KOA_K8S_API_VERIFY_SSL` boolean to set whether to check validate Kubernetes certificate (defaut is `true`).
* `KOA_K8S_CACERT` sets the path to CA file for a self-signed certificate.
* `KOA_K8S_AUTH_TOKEN` sets a Bearer token to authenticate against the Kubernetes API.
* `KOA_K8S_AUTH_CLIENT_CERT` sets the path to the X509 client certificate to authenticate against the Kubernetes API.
* `KOA_K8S_AUTH_CLIENT_CERT_KEY` sets the path to the X509 client certificate key.
* `KOA_K8S_AUTH_USERNAME` sets the username to authenticate against the Kubernetes API using Basic Authentication.
* `KOA_K8S_AUTH_PASSWORD` sets the password for Basic Authentication.
* `KOA_COST_MODEL` (version >= `0.2.0`): sets the model of cost allocation to use. Possible values are: _CUMULATIVE_RATIO_ (default) indicates to compute cost as cumulative resource usage for each period of time (daily, monthly); _CHARGE_BACK_ calculates cost based on a given cluster hourly rate (see `KOA_BILLING_HOURLY_RATE`); _RATIO_ indicates to compute cost as a normalized percentage of resource usage during each period of time.
* `KOA_BILLING_HOURLY_RATE` (required if cost model is _CHARGE_BACK_): defines a positive floating number corresponding to an estimated hourly rate for the Kubernetes cluster. For example if your cluster cost is $5,000 dollars a month (i.e. `~30*24` hours), its estimated hourly cost would be `6.95 = 5000/(30*24)`.
* `KOA_BILLING_CURRENCY_SYMBOL` (optional, default is '`$`'): sets a currency string to use to annotate costs on reports.
* `KOA_INCLUDED_NAMESPACES` (optional, default is '`*`'): comma-separated list of namespaces to monitore. If any value is provided, only these namespaces will be accounted.
* `KOA_EXCLUDED_NAMESPACES` (optional, default is ''): comma-separated list of namespaces to ignore. If any value is provided, these namespaces will be discarded. This options takes precedence over `KOA_INCLUDED_NAMESPACES`.
* `KOA_NVIDIA_DCGM_ENDPOINT` (optional): sets the NVIDIA DCGM Exporter endpoint for GPU metrics collection. When set, kube-opex-analytics will poll the DCGM Exporter to collect GPU utilization metrics per pod/namespace. Example: `http://dcgm-exporter.gpu-operator:9400/metrics`. Requires [DCGM Exporter](https://github.com/NVIDIA/dcgm-exporter) deployed in the cluster.

## GPU Metrics with NVIDIA DCGM

To enable GPU metrics collection, you need:

1. **NVIDIA DCGM Exporter** deployed in your cluster (see [Prerequisites](../README.md#verify-dcgm-exporter-gpu-metrics))
2. **Configure the endpoint** via `KOA_NVIDIA_DCGM_ENDPOINT` environment variable

### Collected GPU Metrics

When DCGM integration is enabled, the following metrics are collected per pod:

| Metric | DCGM Source | Description |
|--------|-------------|-------------|
| GPU Utilization | `DCGM_FI_DEV_GPU_UTIL` | GPU compute utilization percentage |
| Memory Bandwidth | `DCGM_FI_DEV_MEM_COPY_UTIL` | GPU memory bandwidth utilization percentage |
| Memory Used | `DCGM_FI_DEV_FB_USED` | Framebuffer memory used (MiB) |
| Memory Free | `DCGM_FI_DEV_FB_FREE` | Framebuffer memory free (MiB) |

### Helm Configuration

When deploying with Helm, use the `dcgm` values:

```yaml
dcgm:
  enabled: true
  endpoint: http://dcgm-exporter.gpu-operator:9400/metrics
```

Or via command line:

```bash
helm upgrade --install kube-opex-analytics ./manifests/helm \
  --set dcgm.enabled=true \
  --set dcgm.endpoint=http://dcgm-exporter.gpu-operator:9400/metrics
```
