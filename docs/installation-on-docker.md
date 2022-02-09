# Deploying kube-opex-analytics using Docker

- [Requirements](#requirements)
- [Deployment](#deployment)
- [Access the web UI](#access-the-web-ui)

## Requirements
`kube-opex-analytics` requires read-only access to the following Kubernetes API endpoints.
  * `/api/v1`
  * `/apis/metrics.k8s.io/v1beta1` (provided by [Kubernetes Metrics Server](https://github.com/kubernetes-sigs/metrics-server), which shall be installed on the cluster if it's not yet the case).

You need to provide the base URL of the Kubernetes API when starting the program. 
As aforementioned endpoints would typically require authentication, you have to proceed with one of the following options to authenticated with Kubernetes API:
 * Provide a proxied access to Kubernetes API (e.g. `http://127.0.0.1:8001`, get through command `kubectl proxy` with sufficient credentials to get access to the above endpoints).
 * Provide a base Kubernetes API (e.g. https://1.2.3.4:6443), plus additional credentials information to authenticate to the Kubernetes API with sufficient permission to read through the above endpoints (see the list of [configuration variables](./docs/../configuration-settings.md)). 

## Deployment
It assumes that you have a proxied access to your Kubernetes cluster from the local machine.

As `kube-opex-analytics` is released as a Docker image, you can quickly start an instance of the service by running the following command:

```
docker run -d \
    --net="host" \
    --name 'kube-opex-analytics' \
    -v /var/lib/kube-opex-analytics:/data \
    -e KOA_DB_LOCATION=/data/db \
    -e KOA_K8S_API_ENDPOINT=http://127.0.0.1:8001 \
    rchakode/kube-opex-analytics
```

In this command:

 * We provide a local path `/var/lib/kube-opex-analytics` as data volume for the container. That's where `kube-opex-analytics` will store its internal analytics data. You can change this local path to another location, but please keep the container volume `/data` as is.
 * The environment variable `KOA_DB_LOCATION` points to the container path to store data. You may note that this directory belongs to the data volume atached to the container.
 * The environment variable `KOA_K8S_API_ENDPOINT` set the address of the Kubernetes API endpoint.

## Access the web UI
Once the container started you can open access the `kube-opex-analytics`'s web interface at `http://<DOCKER_HOST>:5483/` (e.g. http://127.0.0.1:5483/). *
 
`<DOCKER_HOST>` should be actually replaced by the IP address or the hostmane of the Docker server.

 > You typically need to wait almost an hour to have all charts filled. This is a normal operations of `kube-opex-analytics` which is an hourly-based analytics tool.
