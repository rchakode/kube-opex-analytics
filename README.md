## Overview
--------
kube-opex-analytics is a Kubernetes operating expenditure analytics tool helping to answer questions related to:

* Cost sharing on mutualized Kubernetes clusters.
* Capacity planning based on historic of resource usage.
* Range/amount of resources used by each individual project over time.

Here is a screenshot

![oneInsight Screenshot](images/oneinsight-screenshot-2.png)

## Quick Installation

Choose a directory for kube-opex-analytics database. 

```
export KOA_DB_LOCATION=$HOME/.kube-opex-analytics  # you can choose another folder at your convenience
mkdir $KOA_DB_LOCATION
```

Launch kube-opex-analytics as a Docker container
```
docker run -d \
        --net="host" \
        --name 'kube-opex-analytics' \
#        -p5483:5483 \ 
        -v $KOA_DB_LOCATION:/data \
        -e KOA_DB_LOCATION=/data/db \
        rchakode/kube-opex-analytics
```
> 
  Please note that the environment variable `KOA_DB_LOCATION` should have been prealably set.


Display cost estimate
```
docker run -d \
        --net="host" \
        --name 'kube-opex-analytics' \
        -p5483:5483 \
        -v $KOA_DB_LOCATION:/data \
        -e KOA_DB_LOCATION=/data/db \
        -e KOA_BILING_HOURLY_RATE=7.95 \      # optional
        -e KOA_BILLING_CURRENCY_SYMBOL='$' \  # optional
        rchakode/kube-opex-analytics
```

>
  `-e KOA_BILING_HOURLY_RATE=7.95` is optional
  ` -e KOA_BILLING_CURRENCY_SYMBOL='$'`is optional

## Gettting Started

TODO



## Authors, License, Copyrights, Contributions
kube-opex-analytics is authored by [Rodrigue Chakode](https://github.com/rchakode/) as part of the 
[RealOpInsight Labs Project](http://realopinsight.com) and licensed under the terms of Apache 2.0 License. 

Contributions and third-party libraries are properties of their respective authors.

This product includes third-party librairies with their own licenses and copyrights:

 * Bootstrap Library: http://getbootstrap.com/. 
 * BriteCharts: https://github.com/eventbrite/britecharts. 
 * RRDtool: https://oss.oetiker.ch/rrdtool/

Contributions are accepted subject that the code and documentation be released under Apache 2.0 License.

To contribute bug patches or new features, you can use the Github Pull Request model. 

