#!/bin/bash
set -u
set -e

if [ $# -ne 2 ]; then
    echo -e "usage: \n\t`basename $0` <cluster_name> <docker_image>\n"
    exit 1
fi

CLUSTER_NAME=$1
DOCKER_IMAGE=$2
KOA_K8S_API_ENDPOINT=$(kubectl config view -o jsonpath="{.clusters[?(@.name==\"$CLUSTER_NAME\")].cluster.server}")
if [ "$KOA_K8S_API_ENDPOINT" != "" ]; then
    KOA_K8S_AUTH_TOKEN=$(kubectl get secrets -o jsonpath="{.items[?(@.metadata.annotations['kubernetes\.io/service-account\.name']=='default')].data.token}"|base64 -d)
else
    echo "cannot find KOA_K8S_API_ENDPOINT"
fi

if [ "$KOA_K8S_AUTH_TOKEN" != "" ]; then
    fuser -k 5483/tcp || true
    
    export KOA_K8S_API_ENDPOINT
    export KOA_K8S_AUTH_TOKEN
    export KOA_ENABLE_DEBUG=true
    export KOA_K8S_API_VERIFY_SSL=false
    export KOA_BILLING_HOURLY_RATE=9.92
    export KOA_BILLING_CURRENCY_SYMBOL='$'
    export KOA_COST_MODEL='CHARGE_BACK'

    docker run -d \
    --net="host" \
    --name 'kube-opex-analytics'  \
    -v /var/lib/kube-opex-analytics:/data \
    -e KOA_DB_LOCATION=/data/db \
    -e KOA_K8S_API_ENDPOINT=$KOA_K8S_API_ENDPOINT \
    -e KOA_K8S_AUTH_TOKEN=$KOA_K8S_AUTH_TOKEN \
    -e KOA_ENABLE_DEBUG=$KOA_ENABLE_DEBUG \
    -e KOA_K8S_API_VERIFY_SSL=$KOA_K8S_API_VERIFY_SSL \
    -e KOA_BILLING_HOURLY_RATE=$KOA_BILLING_HOURLY_RATE \
    -e KOA_BILLING_CURRENCY_SYMBOL=$KOA_BILLING_CURRENCY_SYMBOL \
    -e KOA_COST_MODEL=$KOA_COST_MODEL \
    $DOCKER_IMAGE
else
    echo "cannot find KOA_K8S_AUTH_TOKEN"
fi
