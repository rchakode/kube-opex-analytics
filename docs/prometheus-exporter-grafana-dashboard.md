# Promehtheus Exporter and Grafana dashboards
This section describes how to set up custom Grafana dashboards based on the Prometheus exporter natively enabled by `kube-opex-analytics`.

- [Promehtheus Exporter and Grafana dashboards](#promehtheus-exporter-and-grafana-dashboards)
  - [Prometheus Exporter](#prometheus-exporter)
  - [Grafana Dashboard](#grafana-dashboard)
    - [Importation and configuration](#importation-and-configuration)
    - [Overview of the dashboard](#overview-of-the-dashboard)

## Prometheus Exporter
`kube-opex-analytics` enables a Prometheus exporter through the endpoint `/metrics`.

The exporter exposes the following metrics:

* `koa_namespace_hourly_usage` exposes for each namespace its current hourly resource usage for both CPU and memory.
* `koa_namespace_daily_usage` exposes for each namespace and for the ongoing day, its current resource usage for both CPU and memory.
* `koa_namespace_monthly_usage` exposes for each namespace and for the ongoing month, its current resource usage for both CPU and memory.

The Prometheus scraping job can be configured like below (adapt the target URL if needed). A scraping interval less than 5 minutes (i.e. `300s`) is useless as `kube-opex-analytics` would not generate any new metrics in the meantime.


```
scrape_configs:
  - job_name: 'kube-opex-analytics'
    scrape_interval: 300s
    static_configs:
      - targets: ['kube-opex-analytics:5483']
```

> When the option `prometheusOperator` is enabled during the deployment (see Helm [values.yaml](./helm/kube-opex-analytics/values.yaml) file), you have nothing to do as the scraping should be automatically configured by the deployed `Prometheus ServiceMonitor`.

## Grafana Dashboard
There is an official Grafana dashboard which can be downloaded [here](https://grafana.com/dashboards/10282).

The dashboard looks as below and is designed to work out-of-the box with the [Prometheus exporter](#prometheus-exporter). It would just require a couple of minutes to make it work. 

### Importation and configuration

 * Download the dashboard and import it in Grafana.
 * Create a Grafana variable named `KOA_DS_PROMETHEUS` and point to your Prometheus server data source.
 * You're done.

### Overview of the dashboard
The dashboard currently provides the following charts (see screenshot below):

* Hourly resource usage over time.
* Current day's ongoing resource usage.
* Current month's ongoing resource usage.

> You should notice those charts are less rich compared against the ones enabled by the built-in `kube-opex-analytics` dashboard. In particular, the daily and the monthly usage for the different namespaces are not stacked, neither than there are not analytics for past days and months. These limitations are inherent to how Grafana handles timeseries and bar charts.

![](./screenshots/kube-opex-analytics-grafana.png)