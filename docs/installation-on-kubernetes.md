# Deploy kube-opex-analytics on a Kubernetes cluster
This section describes how to deploy `kube-opex-analytics` on a Kubernetes cluster.

- [Deploy kube-opex-analytics on a Kubernetes cluster](#deploy-kube-opex-analytics-on-a-kubernetes-cluster)
  - [Requirements](#requirements)
  - [Deployment manifests](#deployment-manifests)
  - [Installation using Helm](#installation-using-helm)
  - [Installation using Kubectl](#installation-using-kubectl)
  - [Get Access to UI Service](#get-access-to-ui-service)

## Requirements
`kube-opex-analytics` needs read-only access to the following Kubernetes APIs.

* /api/v1
* /apis/metrics.k8s.io/v1beta1 (provided by [Kubernetes Metrics Server](https://github.com/kubernetes-sigs/metrics-server), which shall be installed on the cluster if it's not yet the case).

On a typically deployment inside the Kubernetes cluster, the following Kubernetes API base URL shall be used: `https://kubernetes.default`.

## Deployment manifests
There is a [Helm chart](./helm/) to ease the deployment on Kubernetes using either `Helm` or `kubectl`.

First review the [values.yaml](./helm/kube-opex-analytics/values.yaml) file to customize the configuration options according to your specific environment. 

In particular, you may need to customize the default settings used for the persistent data volume, the Prometheus Operator and its ServiceMonitor, the security context, and many others.

> **Security Context:**
> `kube-opex-analytics`'s pod is deployed with a unprivileged security context by default. However, if needed, it's possible to launch the pod in privileged mode by setting the Helm configuration value `securityContext.enabled` to `false`.

## Installation using Helm
The following deployment command shall deploy `kube-opex-analytics` in the namespace `kube-opex-analytics`. It's assumed that the namespace exists, otherwise create it first.

```bash
helm upgrade \
  --namespace kube-opex-analytics \
  --install kube-opex-analytics \
  helm/kube-opex-analytics/
```

## Installation using Kubectl
This approach requires to have the Helm client (version 2 or 3) installed to generate a raw template for kubectl.

```
$ helm template \
  kube-opex-analytics \
  --namespace kube-opex-analytics \
  helm/kube-opex-analytics/ | kubectl apply -f -
```

## Get Access to UI Service
The Helm deploys an HTTP service named `kube-opex-analytics` on port `80` in the selected namespace, providing to the built-in dashboard of `kube-opex-analytics`.