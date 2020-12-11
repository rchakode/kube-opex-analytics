![logo](https://github.com/rchakode/kube-opex-analytics/blob/master/kube-opex-analytics.png)

![Apache License](https://img.shields.io/github/license/rchakode/kube-opex-analytics.svg?label=License)
[![Latest build status](https://github.com/rchakode/kube-opex-analytics/workflows/Build/badge.svg)](https://github.com/rchakode/kube-opex-analytics/actions)
[![Calendar Versioning](https://img.shields.io/badge/calver-YY.MM.MICRO-bb8fce.svg)](http://calver.org)
![Docker pulls](https://img.shields.io/docker/pulls/rchakode/kube-opex-analytics.svg?label=Docker%20Pulls)



# Overview
In a nutshell, `kube-opex-analytics` or literally *Kubernetes Opex Analytics* is a tool to help organizations track the resources being consumed by their Kubernetes clusters to prevent overpaying. To this end, it generates short-, mid- and long-term usage reports showing relevant insights on what amount of resources each project is spending over time. The final **goal being to ease cost allocation and capacity planning decisions** with factual analytics.

> **Multi-cluster analytics:** `kube-opex-analytics` tracks the usage for a single instance of Kubernetes. For a centralized multi-Kubernetes usage analytics, you may have to consider our [Krossboard](https://krossboard.app/) project. Watch a [demo video here](https://youtu.be/lfkUIREDYDY). 

![](screenshots/kube-opex-analytics-overview.png)

# Table of Contents
- [Overview](#overview)
- [Table of Contents](#table-of-contents)
- [Concepts](#concepts)
  - [Fundamentals Principles](#fundamentals-principles)
  - [Cost Models](#cost-models)
- [Screenshots](#screenshots)
  - [Last Week Hourly Resource Usage Trends](#last-week-hourly-resource-usage-trends)
  - [Two-weeks Daily CPU and Memory Usage](#two-weeks-daily-cpu-and-memory-usage)
  - [One-year Monthly CPU and Memory Usage](#one-year-monthly-cpu-and-memory-usage)
  - [Nodes' Occupation by Pods](#nodes-occupation-by-pods)
  - [Grafana Dashboard](#grafana-dashboard)
- [Getting Started](#getting-started)
  - [Kubernetes API Access](#kubernetes-api-access)
  - [Configuration Variables](#configuration-variables)
  - [Deployment on Docker](#deployment-on-docker)
    - [Get Access to the User Interface](#get-access-to-the-user-interface)
  - [Deployment on a Kubernetes cluster](#deployment-on-a-kubernetes-cluster)
    - [Installation using Helm](#installation-using-helm)
    - [Installation using Kubectl](#installation-using-kubectl)
    - [Get Access to UI Service](#get-access-to-ui-service)
  - [Export Charts and Datasets (PNG, CSV, JSON)](#export-charts-and-datasets-png-csv-json)
  - [Prometheus Exporter](#prometheus-exporter)
  - [Grafana Dashboards](#grafana-dashboards)
- [Multi-cluster analytics](#multi-cluster-analytics)
- [License & Copyrights](#license--copyrights)
- [Support & Contributions](#support--contributions)

# Concepts
`kube-opex-analytics` periodically collects CPU and memory usage metrics from Kubernetes's APIs, processes and consolidates them over various time-aggregation perspectives (hourly, daily, monthly), to produce resource **usage reports covering up to a year**. The reports focus on namespace level, while a special care is taken to also account and highlight **shares of non-allocatable capacities**.

## Fundamentals Principles
`kube-opex-analytics` is designed atop the following core concepts and features:

* **Namespace-focused:** Means that consolidated resource usage metrics consider individual namespaces as fundamental units for resource sharing. A special care is taken to also account and highlight `non-allocatable` resources .
* **Hourly Usage & Trends:** Like on public clouds, resource consumption for each namespace is consolidated on a hourly-basic. This actually corresponds to the ratio (%) of resource used per namespace during each hour. It's the foundation for cost calculation and also allows to get over time trends about resources being consuming per namespace and also at the Kubernetes cluster scale.
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
Before diving to concepts and technical details in the next sections, the below screenshots illustrate reports leveraged via the `kube-opex-analytics`'s built-in charts or via Grafana backed by the `kube-opex-analytics`'s built-in Prometheus exporter.

## Last Week Hourly Resource Usage Trends

![](./screenshots/sample-one-week-hourly-usage.png)

## Two-weeks Daily CPU and Memory Usage

![](./screenshots/sample-two-weeks-daily-usage.png)

## One-year Monthly CPU and Memory Usage

![](./screenshots/sample-one-year-monthly-usage.png)

## Nodes' Occupation by Pods
![](./screenshots/sample-last-nodes-occupation-by-pods.png)

## Grafana Dashboard
This is a screenshot of our [official one](https://grafana.com/dashboards/10282) backed by the `kube-opex-analytics`'s built-in Prometheus Exporter.
![](./screenshots/kube-opex-analytics-grafana.png)

# Getting Started

## Kubernetes API Access
`kube-opex-analytics` needs read-only access to the following Kubernetes APIs.

* /apis/metrics.k8s.io/v1beta1
* /api/v1

You need to provide the base URL of the Kubernetes API when starting the program (see example below).

Typically if you're planning an installation inside a Kubernetes cluster, you can connect to the local cluster API endpoint at: `https://kubernetes.default`.

Likewise, if you're planning an installation outside a Kubernetes cluster you would need either the URL to the Kubernetes API or a proxied access as follows. 

```
$ kubectl proxy
```

This will open a proxied access to Kubernetes API at `http://127.0.0.1:8001`.

If you use a direct access to the Kubernetes API, you may have to set the required credentials through specific environment variables (see [Configuration Variables](#configuration-variables)).


## Configuration Variables
These configuration variables shall be set as environment variables before the startup of the service. 

`kube-opex-analytics` supports the following environment variables when it starts:
* `KOA_DB_LOCATION` sets the path to use to store internal data. Typically when you consider to set a volume to store those data, you should also take care to set this path to belong to the mounting point.
* `KOA_K8S_API_ENDPOINT` sets the endpoint to the Kubernetes API.
* `KOA_K8S_CACERT` sets the path to CA file for a self-signed certificate.
* `KOA_K8S_AUTH_TOKEN` sets a Bearer token to authenticate against the Kubernetes API.
* `KOA_K8S_AUTH_CLIENT_CERT` sets the path to the X509 client certificate to authenticate against the Kubernetes API.
* `KOA_K8S_AUTH_CLIENT_CERT_KEY` sets the path to the X509 client certificate key.
* `KOA_K8S_AUTH_USERNAME` sets the username to authenticate against the Kubernetes API using Basic Authentication.
* `KOA_K8S_AUTH_PASSWORD` sets the password for Basic Authentication.
* `KOA_COST_MODEL` (version >= `0.2.0`): sets the model of cost allocation to use. Possible values are: _CUMULATIVE_RATIO_ (default) indicates to compute cost as cumulative resource usage for each period of time (daily, monthly); _CHARGE_BACK_ calculates cost based on a given cluster hourly rate (see `KOA_BILLING_HOURLY_RATE`); _RATIO_ indicates to compute cost as a normalized percentage of resource usage during each period of time.
* `KOA_BILLING_HOURLY_RATE` (required if cost model is _CHARGE_BACK_): defines a positive floating number corresponding to an estimated hourly rate for the Kubernetes cluster. For example if your cluster cost is $5,000 dollars a month (i.e. `~30*24` hours), its estimated hourly cost would be `6.95 = 5000/(30*24)`.
* `KOA_BILLING_CURRENCY_SYMBOL` (optional, default is '`$`'): sets a currency string to use to annotate costs on reports.



## Deployment on Docker
`kube-opex-analytics` is released as a Docker image. So you can quickly start an instance of the service by running the following command:

```
$ docker run -d \
        --net="host" \
        --name 'kube-opex-analytics' \
        -v /var/lib/kube-opex-analytics:/data \
        -e KOA_DB_LOCATION=/data/db \
        -e KOA_K8S_API_ENDPOINT=http://127.0.0.1:8001 \
        rchakode/kube-opex-analytics
```

In this command:

 * We provide a local path `/var/lib/kube-opex-analytics` as data volume for the container. That's where `kube-opex-analytics` will store its internal analytics data. You can change this local path to another location, but please keep the container volume `/data` as is.
 * The environment variable `KOA_DB_LOCATION` points to the container path to store data. You may note that this directory belongs to the data volume atached to the container.
 * The environment variable `KOA_K8S_API_ENDPOINT` set the address of the Kubernetes API endpoint.

### Get Access to the User Interface
 Once the container started you can open access the `kube-opex-analytics`'s web interface at `http://<DOCKER_HOST>:5483/`. Where `<DOCKER_HOST>` should be replaced by the IP address or the hostmane of the Docker server.

For instance, if you're running Docker on your local machine the interface will be available at: `http://127.0.0.1:5483/`

 > You typically need to wait almost an hour to have all charts filled. This is a normal operations of `kube-opex-analytics` which is an hourly-based analytics tool.

## Deployment on a Kubernetes cluster
There is a [Helm chart](./helm/) to ease the deployment on Kubernetes using either `Helm` or `kubectl`.

First review the [values.yaml](./helm/kube-opex-analytics/values.yaml) file to customize the configuration options according to your specific environment. 

In particular, you may need to customize the default settings used for the persistent data volume, the Prometheus Operator and its ServiceMonitor, the security context, and many others.

> **Security Context:**
> `kube-opex-analytics`'s pod is deployed with a unprivileged security context by default. However, if needed, it's possible to launch the pod in privileged mode by setting the Helm configuration value `securityContext.enabled` to `false`.

In the next deployment commands, it's assumed that the target namespace `kube-opex-analytics` exists. You thus need to create it first or, alternatively, adapt the commands to use any other namespace of your choice.

### Installation using Helm
The deployment, which is validated with Helm 2 and 3, can be performed as follows.

```bash
helm upgrade \
  --namespace kube-opex-analytics \
  --install kube-opex-analytics \
  helm/kube-opex-analytics/
```

### Installation using Kubectl
This approach requires to have the Helm client (version 2 or 3) installed to generate a raw template for kubectl.

```
$ helm template \
  kube-opex-analytics \
  --namespace kube-opex-analytics \
  helm/kube-opex-analytics/ | kubectl apply -f -
```

### Get Access to UI Service
The Helm deploys an HTTP service named `kube-opex-analytics` on port `80` in the selected namespace, providing to the built-in dashboard of `kube-opex-analytics`.


## Export Charts and Datasets (PNG, CSV, JSON)
Any chart provided by kube-opex-analytics can be exported, either as PNG image, CSV or JSON data files.

The exportation steps are the following:

* Get access to kube-opex-analytics's interface.
* Go to the chart that you want to export dataset.
* Click on the `tricolon` icon near the chart title, then select the desired export format.
 
  ![](./screenshots/export-menu.png)

* You're done, the last step shall download the result file instantly.


## Prometheus Exporter
Starting from version `0.3.0`, `kube-opex-analytics` enables a Prometheus exporter through the endpoint `/metrics`.

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


## Grafana Dashboards
You can either build your own Grafana dashboard or use our [official one](https://grafana.com/dashboards/10282).

This official Grafana dashboard looks as below and is designed to work out-of-the box with the `kube-opex-analytics`'s [Prometheus exporter](#prometheus-exporter). It requires to set a Grafana variable named `KOA_DS_PROMETHEUS`, which shall point to your Prometheus server data source.

The dashboard currently provides the following reports:

* Hourly resource usage over time.
* Current day's ongoing resource usage.
* Current month's ongoing resource usage.

> You should notice those reports are less rich compared against the ones enabled by the built-in `kube-opex-analytics` dashboard. In particular, the daily and the monthly usage for the different namespaces are not stacked, neither than there are not analytics for past days and months. These limitations are inherent to how Grafana handles timeseries and bar charts.

![](./screenshots/kube-opex-analytics-grafana.png)

# Multi-cluster analytics
Thanks to a partnership with the [2Alchemists SAS](https://krossboard.app/aboutus/) company, this feature is now implemented by [Krossboard](https://krossboard.app/).

It's actively tested against Amazon EKS, Microsoft AKS, Google GKE Red Hat OpenShift, Rancher RKE, and various vanilla deployments. [Learn more...]

  ![](https://github.com/2-alchemists/krossboard/blob/master/assets/krossboard-demo-v1.1.0.gif)

# License & Copyrights
`kube-opex-analytics` (code and documentation) is licensed under the terms of Apache License 2.0. Read the `LICENSE` file for more details on the license terms.

It includes and is bound to third-party libraries provided with their owns licenses and copyrights. Read the `NOTICE` file for additional information.

# Support & Contributions
We encourage feedback and always make our best to handle any troubles you may encounter when using it.

Here is the link to submit issues: https://github.com/rchakode/kube-opex-analytics/issues.

New ideas are welcomed, if you have any idea to improve it please open an issue to submit it.

Contributions are accepted subject that the code and documentation be released under the terms of Apache 2.0 License.

To contribute bug patches or new features, you can use the Github Pull Request model.
