![logo](https://github.com/rchakode/kube-opex-analytics/blob/master/kube-opex-analytics.png)

![Apache License](https://img.shields.io/github/license/rchakode/kube-opex-analytics.svg?label=License)
[![Latest build status](https://github.com/rchakode/kube-opex-analytics/workflows/Build/badge.svg)](https://github.com/rchakode/kube-opex-analytics/actions)
[![Calendar Versioning](https://img.shields.io/badge/calver-YY.MM.MICRO-bb8fce.svg)](http://calver.org)
![Docker pulls](https://img.shields.io/docker/pulls/rchakode/kube-opex-analytics.svg?label=Docker%20Pulls)

---

- [Overview](#overview)
- [Getting Started](#getting-started)
- [License](#license)
- [Support & Contributions](#support--contributions)
 
# Overview
<<<<<<< HEAD
<<<<<<< HEAD
In a nutshell, `kube-opex-analytics` or literally *Kubernetes Opex Analytics* is a tool to help organizations track the resources being consumed by their Kubernetes clusters to prevent overpaying. To this end, it generates short-, mid- and long-term usage reports showing relevant insights on what amount of resources each project is consuming over time. The final **goal being to ease cost allocation and capacity planning decisions** with factual analytics.

> **Multi Kubernetes clusters analytics:** `kube-opex-analytics` tracks the usage for a single instance of Kubernetes. For a centralized multi-Kubernetes usage analytics, you may have to consider our [Krossboard](https://krossboard.app/) project. Watch a [demo video here](https://youtu.be/lfkUIREDYDY). 

![](screenshots/kube-opex-analytics-overview.png)


# Concepts
`kube-opex-analytics` periodically collects CPU and memory usage metrics from Kubernetes's API, processes and consolidates them over various time-aggregation perspectives (hourly, daily, monthly), to produce resource **usage reports covering up to a year**. The reports focus on namespace level, while a special care is taken to also account and highlight **shares of non-allocatable capacities**.

## Fundamentals Principles
`kube-opex-analytics` is designed atop the following core concepts and features:

* **Namespace-focused:** Means that consolidated resource usage metrics consider individual namespaces as fundamental units for resource sharing. A special care is taken to also account and highlight `non-allocatable` resources .
* **Hourly Usage & Trends:** Like on public clouds, resource consumption for each namespace is consolidated on a hourly-basic. This actually corresponds to the ratio (%) of resource used per namespace during each hour. It's the foundation for cost allocation and also allows to get over time trends about resources being consuming per namespace and also at the Kubernetes cluster scale.
* **Daily and Monthly Usage Costs:** Provides for each period (daily/monthly), namespace, and resource type (CPU/memory), consolidated cost computed given one of the following ways: (i) accumulated hourly usage over the period; (ii) actual costs computed based on resource usage and a given hourly billing rate; (iii) normalized ratio of usage per namespace compared against the global cluster usage.
* **Occupation of Nodes by Namespaced Pods:** Highlights for each node the share of resources used by active pods labelled by their namespace.
* **Efficient Visualization:** For metrics generated, `kube-opex-analytics` provides dashboards with relevant charts covering as well the last couple of hours than the last 12 months (i.e. year). For this there are **built-in charts**, a **Prometheus Exporter** along with **Grafana Dashboard** that all work out of the box.


## Cost Models
Cost allocation models can be set through the startup configuration variable `KOA_COST_MODEL`. Possible values are:

* `CUMULATIVE_RATIO`: (default value) compute costs as cumulative resource usage for each period of time (daily, monthly).
* `RATIO`: compute costs as normalized ratios (`%`) of resource usage during each period of time.
* `CHARGE_BACK`: compute actual costs using a given cluster hourly rate and the cumulative resource usage during each period of time.

Read the [Configuration](#configuration-variables) section for more details.

# Screenshots
The below screenshots illustrate some reports leveraged via the `kube-opex-analytics`'s built-in charts or via Grafana backed by the `kube-opex-analytics`'s Prometheus exporter.

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

## Grafana Dashboard
This is a screenshot of our [official one](https://grafana.com/dashboards/10282) backed by the `kube-opex-analytics`'s built-in Prometheus Exporter.

![](./screenshots/kube-opex-analytics-grafana.png)
=======
In a nutshell `kube-opex-analytics` (literally *Kubernetes Opex Analytics*) is a tool to help organizations track the resources being consumed by their Kubernetes clusters over time (hourly, daily, monthly). Doing so `kube-opex-analytics` aims to prevent overpaying by enabling each organization to understand how their Kubernetes resources are consumed over time, and hence be able to take appropriated decisions when applicable.
=======
`kube-opex-analytics` (literally *Kubernetes Opex Analytics*) is a Kubernetes usage analytics tool to help organizations track the resources being consumed by their Kubernetes clusters over time (hourly, daily, monthly). Doing so `kube-opex-analytics` aims to prevent overpaying by enabling each organization to understand how their Kubernetes resources are consumed over time, and hence be able to take appropriated decisions when applicable.
>>>>>>> 3d78665 (Update README.md)

 * **Usage accounting per namespace:** what capacities each namespace is consuming over time (hourly, daily, monthly).
 * **Accounting of `non-allocatable` capacities**: these are capacities dedicated to the operations of Kubernetes components on each node. From node to cluster level, `kube-opex-analytics` tracks and consolidates the share of non-allocatable capacities and highlights them against usable capacities (i.e. capacities used by actual application workloads). 
 * **Cluster usage accounting and capacity planning:** This feature makes it easy to account and visualize capacities consumed on a cluster, globally, instantly and over time.
 * **Usage/request efficiency per namespace:** Based on hourly-consolidated trends, this original feature help know how efficient resource requests set on Kubernetes are, compared against the actual resource usage over time.
 * **Cost allocation and charge back analytics:** automatic processing and visualization of resource usage accounting per namespace over various period of time (daily, monthly).
 * **Flexible visualization:** `kube-opex-analytics` enables built-in analytics dashboards, as well as a native Prometheus exporter that exposes its analytics metrics for third-party visualization tools like Grafana. 
 
> **Multi-cluster analytics:** `kube-opex-analytics` tracks the usage for a single instance of Kubernetes. For a centralized multi-Kubernetes usage analytics, you may have to consider our [Krossboard](https://krossboard.app/) product. Watch a [demo video here](https://youtu.be/lfkUIREDYDY).
>>>>>>> 831502b (reorganize docs in separated files)

Read the [design fundamentals](./docs/design-fundamentals.md) to learn more.

# Getting Started
  * [Design Fundamentals](./docs/design-fundamentals.md)
  * [Installation on Kubernetes cluster](./docs/installation-on-kubernetes.md)
  * [Installation on a Docker machine](./docs/installation-on-docker.md)
  * [Quick tour of built-in dashboards adn charts](./docs/built-in-dashboards-and-charts.md)
  * [Prometheus Exporter and Grafana Dashboards](./docs/prometheus-exporter-grafana-dashboard.md)
  * [Centralized multi-cluster analytics](./docs/multi-cluster-analytics.md)
  * [Configuration Settings](./docs/configuration-settings.md)

# License
`kube-opex-analytics` (code and documentation) is licensed under the terms of Apache License 2.0. Read the [LICENSE](./LICENSE) terms for more details.

Besides, `kube-opex-analytics` is bound to third-party libraries each with its specific license terms. Read the [NOTICE](./NOTICE) for additional information.

# Support & Contributions
We encourage feedback and always make our best to handle any troubles you may encounter when using it.

Here is the link to submit issues: https://github.com/rchakode/kube-opex-analytics/issues.

New ideas are welcomed, if you have any idea to improve it please open an issue to submit it.

Contributions are accepted subject that the code and documentation be released under the terms of Apache 2.0 License.

To contribute bug patches or new features, please submit a Pull Request.
