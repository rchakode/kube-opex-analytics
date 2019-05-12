# Table of Contents
* [What is Kubernetes Opex Analytics](#what-is-koa)
  * [Overview](#overview)
  * [Features](#features)
  * [Cost Models](#cost-models)
  * [Screenshots](#screenshorts)
* [Getting Started](#getting-started)
  * [Get Kubernetes API Endpoint](#get-kubernetes-api-endpoint)
  * [Starting Kubernetes Opex Analytics on Docker](#start-koa-on-docker)
  * [Starting Kubernetes Opex Analytics on Kubernetes](#start-koa-on-k8s)
  * [Configuration Variables](#config-variables)
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

* `CUMALITIVE_RATIO`: (default value) compute cost as cumulative resource usage for each period of time (daily, monthly).
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
If you're planning an installation inside a Kubernetes cluster, you can connect to the local cluster API endpoint at: `https://kubernetes.default`.


Alternatively, if you're planning an installation outside a Kubernetes cluster you can use a proxied access to Kubernetes API as follows:

```
$ kubectl proxy
```

This will open a proxied API access at `http://127.0.0.1:8001`.

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
 Once the container started you can open access the Kubernetes Opex Analytics's web interface at `http://<DOCKER_HOST>:5483/`. Where `<DOCKER_HOST>` should be replaced by the IP address or the hostmane of the Docker server. E.g. If you're running Docker on your local machine, the address will be available at: `http://127.0.0.1:5483/`

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

Check the [values.yaml](./helm/kube-opex-analytics/values.yaml) file for the available configuration options.

## <a name="config-variables"></a>Configuration Variables
Kubernetes Opex Analytics supports the following environment variables when starting up:
* `KOA_DB_LOCATION` sets the path to use to store internal data. Typically when you consider to set a volume to store those data, you should also take care to set this path to belong to the mounting point.
* `KOA_K8S_API_ENDPOINT` sets the endpoint to the Kubernetes API.
* `KOA_COST_MODEL` (version >= `0.2.0`): sets the model of cost allocation to use. Possible values are: `CUMALITIVE_RATIO` (default) indicates to compute cost as cumulative resource usage for each period of time (daily, monthly); `CHARGE_BACK` calculates cost based on a given cluster hourly rate (see `KOA_BILLING_HOURLY_RATE`); `RATIO` indicates to compute cost as a normalized percentage of resource usage during each period of time. 
* `KOA_BILLING_HOURLY_RATE` (required if cost model `CHARGE_BACK`): defines a positive floating number corresponding to an estimated hourly rate for the Kubernetes cluster. For example if your cluster cost is $5,000 dollars a month (i.e. ~30*24 hours), its estimated hourly cost would be 6.95 = 5000/(30*24).
* `KOA_BILLING_CURRENCY_SYMBOL` (optional, default is `$`): sets a currency string to use to annotate costs on charts. 

# <a name="license-copyrights"></a>License & Copyrights
This tool (code and documentation) is licensed under the terms of Apache License 2.0. Read the `LICENSE` file for more details on the license terms.

The tool includes and is bound to third-party libraries provided with their owns licenses and copyrights. Read the `NOTICE` file for additional information.

# <a name="contributions"></a>Support & Contributions
Kubernetes Opex Analytics is a currently at a early stage but is already useful and ready to use. We encourage feedback and will make our best to be proactive to handle any troubles you may encounter when using it.

Meanwhile we already have some ideas of improvments for next releases https://github.com/rchakode/kube-opex-analytics/issues.

Other ideas are welcomed, please open an issue to submit your idea if you have any one.

Contributions are accepted subject that the code and documentation be released under the terms of Apache License 2.0.

To contribute bug patches or new features, you can use the Github Pull Request model.
