# Deploying kube-opex-analytics on Kubernetes and OpenShift

- [Requirements](#requirements)
- [Deployment Methods](#deployment-methods)
- [Installation with Kustomize (Default Settings)](#installing-with-kustomize-default-settings)
- [Customizing the Installation with Helm](#customizing-the-installation-with-helm)
- [Accessing the Web Interface](#accessing-the-web-interface)

## Requirements

`kube-opex-analytics` requires read-only access to the following Kubernetes API endpoints:

- `/api/v1`
- `/apis/metrics.k8s.io/v1beta1` (provided by the [Kubernetes Metrics Server](https://github.com/kubernetes-sigs/metrics-server)).


### Installing Kubernetes Metrics Server (Skip if using OpenShift)

To install the Kubernetes Metrics Server, run the following command:

```shell
# This step not needed if using OpenShift. 
kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml
```

## Deployment methods for Kubernetes
`kube-opex-analytics` can be installed on a Kubernetes cluster using one of the following methods:

* [kubectl + Kustomize](#Installing-with-Kustomize-Default-Settings) - Quick installation with default settings.
* [Helm](#Customizing-the-Installation-with-Helm) - For more advanced customization.

## Downloading the Deployment Artifacts
Clone the repository and navigate to the main folder:

```shell
git clone https://github.com/rchakode/kube-opex-analytics.git --depth=1
cd kube-opex-analytics
```

## Installing with Kustomize (Default Settings)

This approach provides a quick way to deploy kube-opex-analytics using the default settings (You can review the Kustomize resources located in the `./manifests/kustomize/resources/` folder).

If these default settings do not meet your requirements, consider using the [Helm-based installation](#customizing-the-installation-with-helm) described below, which offers greater customization options.

### Default Settings:
- A persistent volume with a `1Gi`  storage request.
- The Kubernetes distribution is **not OpenShift**, as OpenShift requires additional SCC settings.
- The pod is configured with security contexts that allow UID `4583` and GID `4583` inside the container.

### Installation Steps
Follow these steps to install kube-opex-analytics using Kustomize:

```shell
# Create the installation namespace if it does not exist
kubectl create ns kube-opex-analytics

#  Create kube-opex-analytics resources
kubectl -n kube-opex-analytics apply -k ./manifests/kustomize

# Check that the status of the pod and wait that it starts
kubectl -n kube-opex-analytics get po -w

# If not pod is found, check events for additional information.
kubectl -n kube-opex-analytics get ev
```

## Customizing the Installation with Helm

This approach is recommended when deploying on **OpenShift** or when advanced configuration is required.

Customization is done by modifying the Helm values file at the following location `./manifests/helm/values.yaml`.

### Common Customizations

Below are some frequently used customizations:

- **Use `emptyDir` for local testing**  
  Set `.dataVolume.persist` to `false`.

- **Enable deployment on OpenShift**  
  Set `.securityContext.openshift` to `true`. This binds the SCC `nonroot-v2` to the `kube-opex-analytics` service account.  
  If `emptyDir` is enabled, the SCC `hostaccess` is also bound to the service account.

- **Customize CPU and memory requests**  
  Adjust `.resources.requests.cpu` and `.resources.requests.memory` as needed.

- **Customize the integration with Kubernetes**
Set the different environment variables under the value `.envs` section. See [kube-opex-analytics configuration variables](./configuration-settings.md)

### Installation Steps

The installation consists of the following steps. The installation namespace (`kube-opex-analytics`) is created it does not exist.

```shell
# Create the installation namespace if it does not exist
kubectl create ns kube-opex-analytics

#  Create kube-opex-analytics resources
helm upgrade -n kube-opex-analytics --install kube-opex-analytics manifests/helm/

# Check that the status of the pod and wait that it starts
kubectl -n kube-opex-analytics get po -w

# If not pod is found, check events for additional information.
kubectl -n kube-opex-analytics get ev
```

## Get Access to the kube-opex-anakytics's Web Interface
The deployment create an HTTP service named `kube-opex-analytics` on port `80` in the selected namespace. This service provides access to the built-in `kube-opex-analytics` dashboard.
