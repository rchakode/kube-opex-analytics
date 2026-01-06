# Security Policy

## Supported Versions

kube-opex-analytics follows [Calendar Versioning](http://calver.org) (YY.MM.MICRO).

| Version       | Supported          |
| ------------- | ------------------ |
| 26.x (latest) | :white_check_mark: |
| 25.x          | :white_check_mark: |
| < 25.x        | :x:                |

## Reporting a Vulnerability

We take security vulnerabilities seriously. If you discover a security issue, please report it responsibly.

**Please do NOT report security vulnerabilities through public GitHub issues.**

### How to Report

Send an email to: **security@realopslabs.com**

Include the following information:

- Description of the vulnerability
- Steps to reproduce
- Affected versions
- Potential impact
- Suggested fix (if any)

### Response Timeline

- **Acknowledgment**: within 48 hours
- **Initial assessment**: within 7 days
- **Resolution target**: within 30 days (depending on severity)

### What to Expect

1. We will acknowledge receipt of your report
2. We will investigate and validate the issue
3. We will work on a fix and coordinate disclosure
4. We will credit you in the release notes (unless you prefer anonymity)

## Security Model

### Kubernetes RBAC

kube-opex-analytics requires **read-only** access to the following Kubernetes resources:

- `pods` (all namespaces)
- `nodes`
- `namespaces`
- Metrics API (`metrics.k8s.io`)

The provided manifests include a minimal RBAC configuration. Review and adjust according to your security policies.

### Network Access

The application requires:

- **Inbound**: HTTP on port 5483 (dashboard and Prometheus metrics)
- **Outbound**: Kubernetes API server, DCGM Exporter (if GPU metrics enabled)

Consider using NetworkPolicies to restrict traffic in production environments.

### Data Storage

- Analytics data is stored locally in RRDtool databases
- No sensitive cluster data (secrets, configmaps content) is collected
- Only resource usage metrics (CPU, memory, GPU) are processed

## Security Best Practices for Deployment

### Kubernetes/OpenShift

```yaml
# Use a dedicated namespace
kubectl create namespace kube-opex-analytics

# Apply Pod Security Standards (restricted)
kubectl label namespace kube-opex-analytics \
  pod-security.kubernetes.io/enforce=restricted

# Use NetworkPolicy to limit ingress
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: kube-opex-analytics
  namespace: kube-opex-analytics
spec:
  podSelector:
    matchLabels:
      app: kube-opex-analytics
  policyTypes:
    - Ingress
  ingress:
    - from:
        - namespaceSelector:
            matchLabels:
              name: monitoring
      ports:
        - port: 5483
```

### Docker

- Run with a non-root user (default in our image)
- Use read-only filesystem where possible
- Limit container capabilities
- Restrict network access to kubectl proxy only

```bash
docker run -d \
  --read-only \
  --cap-drop=ALL \
  --security-opt=no-new-privileges \
  -v /var/lib/kube-opex-analytics:/data \
  rchakode/kube-opex-analytics
```

### General Recommendations

- Keep the Docker image updated to the latest version
- Enable TLS/HTTPS via ingress controller or reverse proxy
- Restrict dashboard access using authentication (OAuth2 Proxy, Ingress auth)
- Review RBAC permissions periodically
- Monitor access logs for suspicious activity

## Dependency Security

This project uses automated security scanning:

- **Dependabot** for Python dependency updates
- **Trivy** for Docker image vulnerability scanning
- **GitHub Security Advisories** monitoring

Security updates to dependencies are prioritized and released promptly.

## Prometheus Metrics Endpoint

The `/metrics` endpoint exposes analytics data for Prometheus scraping. This endpoint:

- Does not require authentication by default
- Exposes resource usage metrics (not sensitive data)
- Should be protected via NetworkPolicy or service mesh in production

## Container Image Security

Official images are published to Docker Hub (`rchakode/kube-opex-analytics`):

- Built from minimal base images
- Scanned for vulnerabilities before release
- Signed (when supported by registry)
- No secrets or credentials embedded
