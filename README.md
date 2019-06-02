# Table of Contents
* [What is Kubernetes Opex Analytics](#what-is-koa)
  * [Overview](#overview)
  * [Features](#features)
  * [Cost Models](#cost-models)
  * [Screenshots](#screenshorts)
* [Getting Started](#getting-started)
  * [Get Kubernetes API Endpoint](#get-kubernetes-api-endpoint)
  * [Configuration Variables](#config-variables)
  * [Starting Kubernetes Opex Analytics on Docker](#start-koa-on-docker)
  * [Starting Kubernetes Opex Analytics on Kubernetes](#start-koa-on-k8s)
  * [Prometheus Exporter](#prometheus-exporter)
  * [Grafana Dashboard](#grafana-dashboard)
* [License & Copyrights](#license-copyrights)
* [Support & Contributions](#contributions)


# <a name="what-is-koa"></a>What is Kubernetes Opex Analytics

## <a name="overview"></a>Overview
Kubernetes Opex Analytics provides short-, mid- and long-term resource usage dashboards over Kubernetes clusters so to allow organizations to understand how their Kubernetes operating costs are spending by their different projects. The final **goal being to help them make cost allocatoion and capacity planning decisions** with factual analytics.

To meet this goal, Kubernetes Opex Analytics collects CPU and memory usage metrics from Kubernetes's metrics APIs, processes and consolidates them over time to produce resource usage analytics on the basis of namespaces and with different time aggregation perspectives that cover up to a year. These perspectives also show a special usage item labelled _non-allocatable_ highlighting the **share of non-allocatable capacity** for both CPU and memory.


## <a name="features"></a>Features
Its current features cover the following analytics. Each chart enables a tooltip activable with mouse hover action.

* **One-week CPU and Memory Usage Trends** as consolidated hourly usage per namespace and globally for a cluster over the last 7 days.
* **Two-weeks Daily CPU and Memory Usage** per namespace as cumulative cost based on hourly usage for each namespace, during each day of the last 14 ones. 
* **One-year Monthly CPU and Memory Usage** per namespace as cumulative cost based on daily usage for each namespace, during each month of the last 12 ones.
* **Last Nodes' Occupation by Pods** providing for each node the share of resources used by active pods on the node.


## <a name="cost-models"></a>Cost Models
Kubernetes Opex Analytics supports the following cost allocation models that can be set through the variable `KOA_COST_MODEL` when starting the container:

* `CUMULATIVE_RATIO`: (default value) compute cost as cumulative resource usage for each period of time (daily, monthly).
* `RATIO`: compute cost as a normalized percentage of cumulative resource usage during each period of time. 
* `CHARGE_BACK`: compute cost based on given cluster hourly rate, and the cumulative resource usage during each period of time.

Refer to the [Configuration](#config-variables) section to learn how to configure cost model. 

## <a name="screenshorts"></a>Screenshorts
You can see some screenshorts of the resulting analytics charts hereafter.

### Last Week Hourly Resource Usage Trends

![](./screenshots/sample-one-week-hourly-usage.png)

### Two-weeks Daily CPU and Memory Usage

![](./screenshots/sample-two-weeks-daily-usage.png)

### One-year Monthly CPU and Memory Usage

![](./screenshots/sample-one-year-monthly-usage.png)

### Last Nodes' Occupation by Pods
![](./screenshots/sample-last-nodes-occupation-by-pods.png)

## <a name="getting-started"></a>Getting Started

## <a name="get-kubernetes-api-endpoint"></a>Get Kubernetes API Endpoint
Kubernetes Opex Analytics needs read-only access to the following Kubernetes APIs:

* /apis/metrics.k8s.io/v1beta1
* /api/v1

You need to provide the base URL of the Kubernetes API when starting the program (see example below). 

Typically if you're planning an installation inside a Kubernetes cluster, you can connect to the local cluster API endpoint at: `https://kubernetes.default`.

Likewise if you're planning an installation outside a Kubernetes cluster you can use a proxied access to Kubernetes API as follows:

```
$ kubectl proxy
```

This will open a proxied access to Kubernetes API at `http://127.0.0.1:8001`.

## <a name="config-variables"></a>Configuration Variables
As shown on examples later on, Kubernetes Opex Analytics supports the following environment variables when starting it up:
* `KOA_DB_LOCATION` sets the path to use to store internal data. Typically when you consider to set a volume to store those data, you should also take care to set this path to belong to the mounting point.
* `KOA_K8S_API_ENDPOINT` sets the endpoint to the Kubernetes API.
* `KOA_COST_MODEL` (version >= `0.2.0`): sets the model of cost allocation to use. Possible values are: _CUMULATIVE_RATIO_ (default) indicates to compute cost as cumulative resource usage for each period of time (daily, monthly); _CHARGE_BACK_ calculates cost based on a given cluster hourly rate (see `KOA_BILLING_HOURLY_RATE`); _RATIO_ indicates to compute cost as a normalized percentage of resource usage during each period of time. 
* `KOA_BILLING_HOURLY_RATE` (required if cost model _CHARGE_BACK_): defines a positive floating number corresponding to an estimated hourly rate for the Kubernetes cluster. For example if your cluster cost is $5,000 dollars a month (i.e. ~30*24 hours), its estimated hourly cost would be 6.95 = 5000/(30*24).
* `KOA_BILLING_CURRENCY_SYMBOL` (optional, default is `$`): sets a currency string to use to annotate costs on charts. 


## <a name="start-koa-on-docker"></a>Starting Kubernetes Opex Analytics on Docker
Kubernetes Opex Analytics is released as a Docker image. So you can quickly start an instance of the service by running the following command:

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

 * We provide a local path `/var/lib/kube-opex-analytics` as data volume for the container. That's where Kubernetes Opex Analytics will store its internal analytics data. You can change the local path to another location, but you MUST take care to adapt the `KOA_DB_LOCATION` environment variable accordingly.
 * The environment variable `KOA_DB_LOCATION` points to the path to use by Kubernetes Opex Analytics to store its internal data. You can remark that this directory belongs to the data volume atached to the container.
 * The environment variable `KOA_K8S_API_ENDPOINT` set the address of the Kubernetes API endpoint.

### <a name="access-gui-docker"></a>Access GUI & Watch Analytics
 Once the container started you can open access the Kubernetes Opex Analytics's web interface at `http://<DOCKER_HOST>:5483/`. Where `<DOCKER_HOST>` should be replaced by the IP address or the hostmane of the Docker server. 
 
For instance, if you're running Docker on your local machine the interface will be available at: `http://127.0.0.1:5483/`

 > Due to the time needed to have sufficient data to consolidate, you may need to wait almost a hour to have all charts filled. This is a normal operations of Kubernetes Opex Analytics.

## <a name="start-koa-on-k8s"></a>Starting Kubernetes Opex Analytics on a Kubernetes cluster

You can use the helm chart in the [helm](./helm/) folder to deploy Kubernetes Opex Analytics in Kubernetes, if you have tiller deployed in your cluster you can use:

```
helm upgrade --install kube-opex-analytics --namespace=kube-opex-analytics helm/kube-opex-analytics/
```

if you don't, you can use helm to render the Kubernetes manifests and apply them with kubectl:

```
helm template --name kube-opex-analytics helm/kube-opex-analytics/ | kubectl apply -f -
```

Check the [values.yaml](./helm/kube-opex-analytics/values.yaml) file to modify configuration options according to your needs.

## <a name="prometheus-exporter"></a>Prometheus Exporter
Starting from version `0.3.0`, Kubernetes Opex Analytics enables a Prometheus exporter through the endpoint `/metrics`. 

### <a name="prometheus-exposed-metrics"></a>Exposed Metrics
The exporter exposes the following metrics:

* `koa_namespace_hourly_usage` exposes for each namespace its current hourly resource usage for both CPU and memory.
* `koa_namespace_daily_usage` exposes for each namespace and for the ongoing day, its current resource usage for both CPU and memory. 
* `koa_namespace_monthly_usage` exposes for each namespace and for the ongoing month, its current resource usage for both CPU and memory. 

### <a name="prometheus-scrapping-config"></a>Scrapping Configuration
The Prometheus scrapping job can be configured as below (adapt the target URL if needed). A scrapping interval less than 5 minutes (i.e. `300s`) is useless as Kubernetes Opex Analytics would not generate any new metrics in the meantime. 

```
scrape_configs:
  - job_name: 'kube-opex-analytics'
    scrape_interval: 300s
    static_configs:
      - targets: ['kube-opex-analytics:5483']  
```

## <a name="grafana-dashboard"></a>Grafana Dashboard
We provide an integrated Grafana dashboard for the Prometheus exporter. You can [download it here](https://grafana.com/dashboards/10282) and import it to your Grafana installation. The dashboard assumes that your Prometheus data source is defined through a variable named `KOA_DS_PROMETHEUS`. Make sure to create that variable and bind it to your Prometheus source.


![](./screenshots/kube-opex-analytics-grafana.png)

The dashboard shows the following analytics for both CPU and memory resources:
* Hourly resource usage over time.
* Current day's ongoing resource usage.
* Current month's ongoing resource usage.

> As you can notice those analytics are less rich than compared against the ones enabled by the built-in Kubernetes Opex Analytics dashboard. In particular the daily and the monthly usage for the different namespaces are not stacked, neither than there are not analytics for past days and months. These limitations are inherent to how Grafana handles timeseries and bar charts. It's not easy (actually not possible?), to build advanced analytics than the ones enabled by natively by Kubernetes Opex Analytics. 

 If you have some advanced expertises on Grafana and think you are able to design such an equivalent dashboard, we'll be happy if you can share it with the community. That'll be really appreciated. More generally, if for your specific needs you were given to create other dashboards that you think can be useful for the community, please make a pull request and we'll be happy to share it. 

# <a name="license-copyrights"></a>License & Copyrights
This tool (code and documentation) is licensed under the terms of Apache License 2.0. Read the `LICENSE` file for more details on the license terms.

The tool includes and is bound to third-party libraries provided with their owns licenses and copyrights. Read the `NOTICE` file for additional information.

# <a name="contributions"></a>Support & Contributions
Kubernetes Opex Analytics is a currently at a early stage but is already useful and ready to use. We encourage feedback and will make our best to be proactive to handle any troubles you may encounter when using it.

Meanwhile we already have some ideas of improvments for next releases https://github.com/rchakode/kube-opex-analytics/issues.

Other ideas are welcomed, please open an issue to submit your idea if you have any one.

Contributions are accepted subject that the code and documentation be released under the terms of Apache License 2.0.

To contribute bug patches or new features, you can use the Github Pull Request model.
