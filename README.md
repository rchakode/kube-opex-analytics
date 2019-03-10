

![](./screenshots/kube-opex-analytics-overview.png)

## What is Kubernetes Opex Analytics
Kubernetes Opex Analytics provides short-, mid- and long-term resource usage dashboards to allow organizations to understand how their Kubernetes clusters' operating costs are spending by their differents projects. The final **goal is to help to make cost sharing and capacity planning decisions** with factual analytics. 

To meet this goal, Kubernetes Opex Analytics collects CPU and memory usage metrics from Kubernetes's metrics APIs, processes and consolidate them over time to produce resource usage analytics on the basis of namespaces and with different time aggregation perspectives that cover up to a year. These perspectives also show a special usage item labelled _non-allocatable_ highlighting the **share of non-allocatable capacity** for both CPU and memory.

Its current features cover the following analytics:

* **One-week CPU and Memory Usage Trends** as consolidated hourly usage per namespace and globally for a cluster over the last 7 days.
* **Two-weeks Daily CPU and Memory Usage** per namespace as cumulative hourly usage for each namespace during each day of the last 14 ones.
* **One-year Monthly CPU and Memory Usage** per namespace as cumulative daily usage for each namespace during each month of the last 12 ones.
* **Last Nodes' Occupation by Pods** providing for each node the share of resources used active pods on the node.

You can see some screenshorts of these analytics hereafter.

### Last Week Hourly Resource Usage Trends

![](./screenshots/sample-one-week-hourly-usage.png)


### Two-weeks Daily CPU and Memory Usage


![](./screenshots/sample-two-weeks-daily-usage.png)


### One-year Monthly CPU and Memory Usage


![](./screenshots/sample-one-year-monthly-usage.png)


### Last Nodes' Occupation by Pods
![](./screenshots/sample-last-nodes-occupation-by-pods.png)


## Getting Started

Choose a directory for Kubernetes Opex Analytics database. 

```
export KOA_DB_LOCATION=$HOME/.Kubernetes Opex Analytics  # you can choose another folder at your convenience
mkdir $KOA_DB_LOCATION
```

Launch Kubernetes Opex Analytics in a Docker container
```
docker run -d \
        --net="host" \
        --name 'Kubernetes Opex Analytics' \
        -v /var/lib/kube-opex-analytics:/data \
        -e KOA_K8S_API_ENDPOINT=http://127.0.0.1:8001
        -e KOA_DB_LOCATION=/data/db \
        rchakode/Kubernetes Opex Analytics
```

> 
  Remark that, in this command we provide the local path `/var/lib/kube-opex-analytics` as a volume mounted to `/data` in the container. That where Kubernetes Opex Analytics stored in internal analytics data. You can change the local path to another location, but you SHOULD NOT change the mount point.

## Gettting Started

TODO



## Authors, License, Copyrights, Contributions
Kubernetes Opex Analytics is authored by [Rodrigue Chakode](https://github.com/rchakode/) as part of the 
[RealOpInsight Labs Project](http://realopinsight.com) and licensed under the terms of Apache 2.0 License. 

Contributions and third-party libraries are properties of their respective authors.

This product includes third-party librairies with their own licenses and copyrights:

 * Bootstrap Library: http://getbootstrap.com/. 
 * BriteCharts: https://github.com/eventbrite/britecharts. 
 * RRDtool: https://oss.oetiker.ch/rrdtool/

Contributions are accepted subject that the code and documentation be released under Apache 2.0 License.

To contribute bug patches or new features, you can use the Github Pull Request model. 

