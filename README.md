## Overview
Kubernetes Opex Analytics provides short-, mid- and long-term resource usage dashboards to allow you understand how your Kubernetes clusters' operating costs are spending by your differents projects. The main goal of this tool is to help your organization and/or your business units to make cost sharing and capacity planning decisions with factual analytics.

To achieve this goal, Kubernetes Opex Analytics provides resource usage analytics per namespace basis with, with hourly, daily, weekly, and monthly perspectives:


### Capacity Planning:
In today's on-demand based cloud resource usage, be able to understand how allocated resources are used and be able to scale up/down thoses resources at the right time is safe money. To help you in this direction, Kubernetes Opex Analytics provides:

* Analytics of actual CPU and memory resource usage per namespace and globally, over days, days, weeks, monthes and year. 
* Understanding trends of resource usage (over days, weeks and monthes) you ca them plan predictive capacity planning process and accurately forecast future 

### Cost Sharing
* Cost sharing on mutualized Kubernetes clusters.
* Capacity planning based on historic of resource usage.
* Range/amount of resources used by each individual project over time.

Here is a screenshot

![oneInsight Screenshot](images/oneinsight-screenshot-2.png)

## Quick Installation

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
#        -p5483:5483 \ 
        -v $KOA_DB_LOCATION:/data \
        -e KOA_DB_LOCATION=/data/db \
        rchakode/Kubernetes Opex Analytics
```
> 
  Please note that the environment variable `KOA_DB_LOCATION` should have been prealably set.


Display cost estimate
```
docker run -d \
        --net="host" \
        --name 'Kubernetes Opex Analytics' \
        -p5483:5483 \
        -v $KOA_DB_LOCATION:/data \
        -e KOA_DB_LOCATION=/data/db \
        -e KOA_BILING_HOURLY_RATE=7.95 \      # optional
        -e KOA_BILLING_CURRENCY_SYMBOL='$' \  # optional
        rchakode/Kubernetes Opex Analytics
```

>
  `-e KOA_BILING_HOURLY_RATE=7.95` is optional
  ` -e KOA_BILLING_CURRENCY_SYMBOL='$'`is optional

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

