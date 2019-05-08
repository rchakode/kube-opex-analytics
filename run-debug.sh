#!/bin/bash
set -u
set -e

if [ $# -ne 1 ]; then
    echo -e "usage: \n\t`basename $0` <cluster_name>\n"
    exit 1
fi

CLUSTER_NAME=$1
KOA_K8S_API_ENDPOINT=$(kubectl config view -o jsonpath="{.clusters[?(@.name==\"$CLUSTER_NAME\")].cluster.server}")
if [ "$KOA_K8S_API_ENDPOINT" != "" ]; then
    KOA_K8S_AUTH_TOKEN=$(kubectl get secrets -o jsonpath="{.items[?(@.metadata.annotations['kubernetes\.io/service-account\.name']=='default')].data.token}"|base64 -d)
else
    echo "cannot find KOA_K8S_API_ENDPOINT"
fi

if [ "$KOA_K8S_AUTH_TOKEN" != "" ]; then
    export KOA_K8S_API_ENDPOINT
    export KOA_K8S_AUTH_TOKEN
    export KOA_ENABLE_DEBUG=true
    export KOA_K8S_API_VERIFY_SSL=false
    export KOA_BILLING_HOURLY_RATE=7.95
    export KOA_BILLING_CURRENCY_SYMBOL='$'
    fuser -k 5483/tcp || true
    ./entrypoint.sh
else
    echo "cannot find KOA_K8S_AUTH_TOKEN"
fi
