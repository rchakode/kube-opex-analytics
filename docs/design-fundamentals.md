
# Design Fundamentals
This section highlights fundamental assumptions and decisions made when designing `kube-opex-analytics`.

- [Design Fundamentals](#design-fundamentals)
  - [Data Collection and Analytics](#data-collection-and-analytics)
  - [Usage Accounting Models](#usage-accounting-models)


## Data Collection and Analytics
`kube-opex-analytics` periodically collects CPU and memory usage metrics from Kubernetes's API, processes and consolidates them over various time-aggregation perspectives (hourly, daily, monthly), to produce resource **usage reports covering up to a year**. The reports focus on namespace level, while a special care is taken to also account and highlight **shares of non-allocatable capacities**.

* **Namespace-focused:** Means that consolidated resource usage metrics consider individual namespaces as fundamental units for resource sharing. A special care is taken to also account and highlight `non-allocatable` resources .
* **Hourly Usage & Trends:** Like on public clouds, resource consumption for each namespace is consolidated on a hourly-basic. This actually corresponds to the ratio (%) of resource used per namespace during each hour. It's the foundation for cost allocation and also allows to get over time trends about resources being consuming per namespace and also at the Kubernetes cluster scale.
* **Daily and Monthly Usage Costs:** Provides for each period (daily/monthly), namespace, and resource type (CPU/memory), consolidated cost computed given one of the following ways: (i) accumulated hourly usage over the period; (ii) actual costs computed based on resource usage and a given hourly billing rate; (iii) normalized ratio of usage per namespace compared against the global cluster usage.
* **Utilization of Nodes by Pods:** Highlights for each node the share of resources used by active pods labelled by their namespace.


## Usage Accounting Models
`kube-opex-analytics` support various usage accounting models with the aim to address use cases like cost allocation, usage show back, capacity planning, etc.

The target accounting model must be selected using the startup configuration variable `KOA_COST_MODEL` using one of the following values:

* `CUMULATIVE_RATIO`: (default value) compute costs as cumulative resource usage for each period of time (daily, monthly).
* `RATIO`: compute costs as normalized ratios (`%`) of resource usage during each period of time.
* `CHARGE_BACK`: compute actual costs using a given cluster hourly rate and the cumulative resource usage during each period of time.

Read the [Configuration Section](#configuration-variables) for more details.