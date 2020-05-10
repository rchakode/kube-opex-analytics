{{/* vim: set filetype=mustache: */}}
{{/*
Expand the name of the chart.
*/}}
{{- define "kube-opex-analytics.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{/*
Create a default fully qualified app name.
We truncate at 63 chars because some Kubernetes name fields are limited to this (by the DNS naming spec).
If release name contains chart name it will be used as a full name.
*/}}
{{- define "kube-opex-analytics.fullname" -}}
{{- if .Values.fullnameOverride -}}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" -}}
{{- else -}}
{{- $name := default .Chart.Name .Values.nameOverride -}}
{{- if contains $name .Release.Name -}}
{{- .Release.Name | trunc 63 | trimSuffix "-" -}}
{{- else -}}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" -}}
{{- end -}}
{{- end -}}
{{- end -}}

{{/*
Create chart name and version as used by the chart label.
*/}}
{{- define "kube-opex-analytics.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{/*
Common labels
*/}}
{{- define "kube-opex-analytics.labels" -}}
helm.sh/chart: {{ include "kube-opex-analytics.chart" . }}
app.kubernetes.io/name: {{ include "kube-opex-analytics.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- if .Values.metadata.labels }}
  {{- range $key, $val := .Values.metadata.labels }}
{{ $key -}}: {{ $val }}
  {{- end}}
{{- end }}
{{- end -}}

{{- define "kube-opex-analytics.imageVersion" }}
{{- if .Values.image.version -}}
{{- .Values.image.version -}}
{{- else -}}
{{- .Chart.Version -}}
{{- end -}}
{{- end }}

{{- define "imagePullSecret" }}
{{- printf "{\"auths\": {\"%s\": {\"auth\": \"%s\"}}}" .Values.imageCredentials.registry (printf "%s:%s" .Values.imageCredentials.username .Values.imageCredentials.password | b64enc) | b64enc }}
{{- end }}

{{- define "kube-opex-analytics.prometheusLabels" -}}
{{- if .Values.prometheusOperator.enabled }}
  {{- range $key, $val := .Values.prometheusOperator.labels }}
{{ $key -}}: {{ $val }}
  {{- end}}
{{- end }}
{{- end -}}
