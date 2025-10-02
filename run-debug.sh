#!/bin/bash
set -u
set -e

if [ $# -ne 1 ]; then
    echo -e "usage: \n\t`basename $0` <cluster_name>\n"
    exit 1
fi

CLUSTER_NAME=$1
KOA_K8S_API_ENDPOINT=$(kubectl config view -o jsonpath="{.clusters[?(@.name==\"$CLUSTER_NAME\")].cluster.server}")
if [ "$KOA_K8S_API_ENDPOINT" == "" ]; then
    echo "cannot find KOA_K8S_API_ENDPOINT"
    exit 1
fi

KOA_K8S_AUTH_TOKEN=$(kubectl get secrets -n kube-opex-analytics -o jsonpath="{.items[?(@.metadata.annotations['kubernetes\.io/service-account\.name']=='kube-opex-analytics')].data.token}"|base64 -d)
if [ "$KOA_K8S_AUTH_TOKEN" == "" ]; then
    echo "cannot find KOA_K8S_AUTH_TOKEN"
    exit 1
fi

export KOA_DB_LOCATION=${KOA_DB_LOCATION:-$PWD/db}
export KOA_K8S_API_ENDPOINT
export KOA_K8S_AUTH_TOKEN
export KOA_ENABLE_DEBUG=true
export KOA_K8S_API_VERIFY_SSL=false
export KOA_BILLING_HOURLY_RATE=${KOA_BILLING_HOURLY_RATE:-9.92}
export KOA_BILLING_CURRENCY_SYMBOL=${KOA_BILLING_CURRENCY_SYMBOL:-'$'}
export KOA_COST_MODEL=${KOA_COST_MODEL:-CUMULATIVE_RATIO}
export KOA_POLLING_INTERVAL_SEC=${KOA_POLLING_INTERVAL_SEC:-300}

fuser -k 5483/tcp || true
./entrypoint.sh
