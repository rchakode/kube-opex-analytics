![logo](https://github.com/rchakode/kube-opex-analytics/blob/master/kube-opex-analytics.png)

![Apache License](https://img.shields.io/github/license/rchakode/kube-opex-analytics.svg?label=License)
[![Latest build status](https://github.com/rchakode/kube-opex-analytics/workflows/Build/badge.svg)](https://github.com/rchakode/kube-opex-analytics/actions)
[![Calendar Versioning](https://img.shields.io/badge/calver-YY.MM.MICRO-bb8fce.svg)](http://calver.org)
![Docker pulls](https://img.shields.io/docker/pulls/rchakode/kube-opex-analytics.svg?label=Docker%20Pulls)

---

## Overview

`kube-opex-analytics` (literally *Kubernetes Opex Analytics*) is a Kubernetes usage analytics tool to help organizations track the resources being consumed by their Kubernetes clusters over time (hourly, daily, monthly). Doing so, `kube-opex-analytics` aims to prevent overpaying by enabling each organization to understand how their Kubernetes resources are consumed over time, and hence be able to take appropriated cost optimization decisions.

Key features:

 * **Usage accounting and trends per namespace.** This allows assessing what capacities each namespace is consuming over various period of time (hourly, daily, monthly).
 * **Accounting of non-allocatable capacities.** At node and cluster levels, `kube-opex-analytics` tracks and consolidates the share of non-allocatable capacities and highlights them against usable capacities (i.e. capacities used by actual application workloads). In contrary to usable capacities, non-allocatable capacities are dedicated to Kubernetes operations (OS, kubelets, etc).
 * **Cluster usage accounting and capacity planning.** This feature makes it easy to account and visualize capacities consumed on a cluster, globally, instantly and over time.
 * **Usage/requests efficiency.** Based on hourly-consolidated trends, this functionality helps know how efficient resource requests set on Kubernetes workloads are, compared against the actual resource usage over time.
 * **Cost allocation and charge back analytics:** automatic processing and visualization of resource usage accounting per namespace on daily and monthly periods.
 * **Insightful and extensible visualization.** `kube-opex-analytics` enables built-in analytics dashboards, as well as a native Prometheus exporter that exposes its analytics metrics for third-party visualization tools like Grafana.


![kube-opex-analytics-overview](https://github.com/rchakode/kube-opex-analytics/blob/master/screenshots/kube-opex-analytics-demo.gif)

## Getting Started
Checkout the [documentation](https://github.com/rchakode/kube-opex-analytics#readme) to getting started. 
