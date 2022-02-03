# Quick tour of kube-opex-analytics built-in dashboards and charts
This section describe the built-in dashboards and charts provided by `kube-opex-analytics`.

You can also use Grafana dashboard based on the Prometheus exporter it natively enables. [Learn more](prometheus-exporter-grafana-dashboard.md).

## Last Week Hourly Resource Usage Trends
For the different namespaces discovered in the Kubernetes cluster, this section shows hourly usage trends for CPU and memory resources during the last week (last seven days).

![](./screenshots/sample-one-week-hourly-usage.png)

## Two-weeks Daily CPU and Memory Usage
For the different namespaces discovered in the Kubernetes cluster, this section shows daily cumulated usage for CPU and memory resources during the last 2 weeks.

![](./screenshots/sample-two-weeks-daily-usage.png)

## One-year Monthly CPU and Memory Usage
For the different namespaces discovered in the Kubernetes cluster, this section shows monthly cumulated usage for CPU and memory resources during the last 12 months.

![](./screenshots/sample-one-year-monthly-usage.png)

## Nodes' Occupation by Pods
For the different nodes discovered in the Kubernetes cluster, this section shows for each node the CPU and the memory resources currently consumed by running pods.

![](./screenshots/sample-last-nodes-occupation-by-pods.png)


## Export Charts and Datasets (PNG, CSV, JSON)
Any chart provided by kube-opex-analytics can be exported, either as PNG image, CSV or JSON data files.

* Go to the target chart section.
* Click on the link `export`, then select the target exportion format.
 
  ![](./screenshots/export-menu.png)

* You're done, the last step shall download the result file instantly.

