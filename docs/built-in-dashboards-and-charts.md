# Quick tour of kube-opex-analytics built-in dashboards and charts
This section describes the built-in dashboards and charts provided by `kube-opex-analytics`.

In addition, or alternatively, it's also possible to use Grafana for visualization thanks to the Prometheus exporter natively enabled by `kube-opex-analytics`. [Learn more](prometheus-exporter-grafana-dashboard.md).

## Hourly Resource Usage Trends (7 last days)
For the different namespaces discovered in the Kubernetes cluster, these charts show hourly usage trends for CPU and memory resources during the last week (7 days).

![](./screenshots/sample-one-week-hourly-usage.png)

## Hourly Usage/Requests Efficiency Trends (7 last days)
For the different namespaces discovered in the Kubernetes cluster, these charts show hourly usage/requests efficiency trends for CPU and memory resources during the last week (7 days).

![](./screenshots/sample-one-week-hourly-usage.png)


## Daily CPU and Memory Usage (14 last days)
For the different namespaces discovered in the Kubernetes cluster, these charts show daily cumulative usage for CPU and memory resources during the last 2 weeks.

![](./screenshots/sample-two-weeks-daily-usage.png)

## Monthly CPU and Memory Usage (12 last months)
For the different namespaces discovered in the Kubernetes cluster, these charts show monthly cumulative usage for CPU and memory resources during the last 12 months.

![](./screenshots/sample-one-year-monthly-usage.png)

## Nodes' Occupation by Pods
For the different nodes discovered in the Kubernetes cluster, these charts show for each node the CPU and the memory resources currently consumed by running pods.

![](./screenshots/sample-last-nodes-occupation-by-pods.png)


## Export Charts and Datasets (PNG, CSV, JSON)
Any chart provided by kube-opex-analytics can be exported, either as PNG image, CSV or JSON data files.

* Go to the target chart section.
* Click on the link `export`, then select the target exportion format.
 
  ![](./screenshots/export-menu.png)

* You're done, the last step shall download the result file instantly.

