# Deploying kube-opex-analytics on Kubernetes

- [Requirements](#requirements)
- [Deployment manifests](#deployment-manifests)
- [Installation using kubectl and kustomize](#installation-using-kubectl-and-kustomize)
- [Installation using Helm](#installation-using-helm)
- [Get Access to UI Service](#get-access-to-ui-service)

## Requirements
`kube-opex-analytics` requires read-only access to the following Kubernetes API endpoints.

* `/api/v1`
* `/apis/metrics.k8s.io/v1beta1` (provided by [Kubernetes Metrics Server](https://github.com/kubernetes-sigs/metrics-server)).

Command to install Kubernetes Metrics Server
```shell
kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml
```

> For a deployment inside the Kubernetes cluster, use `https://kubernetes.default` as API base URL.

## Deployment methods for Kubernetes
`kube-opex-analytics` can be installed using one of the following methods:
* [kubectl + Kustomize](#installation-using-kubectl-and-kustomize) 
* [Helm](#installation-using-helm)

> **Security Context:**
> `kube-opex-analytics`'s pod is deployed with a unprivileged security context by default. However, if needed, it's possible to launch the pod in privileged mode by setting the Helm configuration value `securityContext.enabled` to `false`.

## Download artifacts
Clone the repository and move to the main folder.

```shell
git clone https://github.com/rchakode/kube-opex-analytics.git --depth=1
cd kube-opex-analytics
```

## Installation using kubectl and Kustomize
First review the default configuration settings in the deployment ConfigMap: `kustomize/kube-opex-analytics-config.yaml`.

Then, perform the following command to submit the deployment.
The target namespace (`kube-opex-analytics`) is assumed to exist. Otherwise, create it first.

```shell
kubectl -n kube-opex-analytics apply -k ./manifests/kustomize
```

## Installation using Helm
First review the default configuration settings in the Helm values file: `manifests/helm/values.yaml`. In particular, review the sections related to the persistent data volume, the Prometheus exporter and security context.

Then, perform the following commands to install `kube-opex-analytics` components. The first command creates the installation namespace (`kube-opex-analytics`) if it do not exist. 

```shell
kubectl create ns kube-opex-analytics
helm upgrade -n kube-opex-analytics --install kube-opex-analytics manifests/helm/
```

## Get Access to the kube-opex-anakytics's Web Interface
The Helm deploys an HTTP service named `kube-opex-analytics` on port `80` in the selected namespace, providing to the built-in dashboard of `kube-opex-analytics`.
