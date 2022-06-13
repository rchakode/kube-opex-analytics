#!/usr/bin/env python
__author__ = "Rodrigue Chakode"
__copyright__ = "Copyright 2019 Rodrigue Chakode and contributors"
__credits__ = ["Rodrigue Chakode and contributors"]
__license__ = "Apache"
__version__ = "2.0"
__maintainer__ = "Rodrigue Chakode"
__email__ = "Rodrigue Chakode <rodrigue.chakode @ gmail dot com"
__status__ = "Production"

import argparse
import base64
import calendar
import collections
import enum
import errno
import fnmatch
import json
import logging
import os
import sys
import threading
import time
import traceback
import urllib, urllib3
from typing import Any, List

import flask

from flask_cors import CORS, cross_origin

import prometheus_client

import requests

import rrdtool

from waitress import serve as waitress_serve

import werkzeug.middleware.dispatcher as wsgi

urllib3.disable_warnings()

def create_directory_if_not_exists(path):
    try:
        os.makedirs(path)
    except OSError as e:
        if e.errno != errno.EEXIST:
            raise


class Config:
    version = '22.02.3'
    db_round_decimals = 6
    db_non_allocatable = 'non-allocatable'
    db_billing_hourly_rate = '.billing-hourly-rate'
    static_content_location = '/static'
    frontend_data_location = '.%s/data' % (static_content_location)
    k8s_api_endpoint = os.getenv('KOA_K8S_API_ENDPOINT', 'http://127.0.0.1:8001')
    k8s_verify_ssl = (lambda v: v.lower() in ("yes", "true"))(os.getenv('KOA_K8S_API_VERIFY_SSL', 'true'))
    db_location = os.getenv('KOA_DB_LOCATION', ('%s/.kube-opex-analytics/db') % os.getenv('HOME', '/tmp'))
    polling_interval_sec = int(os.getenv('KOA_POLLING_INTERVAL_SEC', '300'))
    cost_model = os.getenv('KOA_COST_MODEL', 'CUMULATIVE_RATIO')
    billing_currency = os.getenv('KOA_BILLING_CURRENCY_SYMBOL', '$')
    enable_debug = (lambda v: v.lower() in ("yes", "true"))(os.getenv('KOA_ENABLE_DEBUG', 'false'))
    k8s_auth_token = os.getenv('KOA_K8S_AUTH_TOKEN', 'NO_ENV_AUTH_TOKEN')
    k8s_auth_token_type = os.getenv('KOA_K8S_AUTH_TOKEN_TYPE', 'Bearer')
    k8s_auth_username = os.getenv('KOA_K8S_AUTH_USERNAME', 'NO_ENV_AUTH_USERNAME')
    k8s_auth_password = os.getenv('KOA_K8S_AUTH_PASSWORD', 'NO_ENV_AUTH_PASSWORD')
    k8s_ssl_cacert = os.getenv('KOA_K8S_CACERT', None)
    k8s_ssl_client_cert = os.getenv('KOA_K8S_AUTH_CLIENT_CERT', 'NO_ENV_CLIENT_CERT')
    k8s_ssl_client_cert_key = os.getenv('KOA_K8S_AUTH_CLIENT_CERT_KEY', 'NO_ENV_CLIENT_CERT_CERT')
    included_namespaces = [ i for i in os.getenv('KOA_INCLUDED_NAMESPACES', '').replace(' ','').split(',') if i ]
    excluded_namespaces = [ i for i in os.getenv('KOA_EXCLUDED_NAMESPACES', '').replace(' ','').split(',') if i ]

    def __init__(self):
        self.load_rbac_auth_token()

        # handle billing rate and cost model
        try:
            self.billing_hourly_rate = float(os.getenv('KOA_BILLING_HOURLY_RATE'))
        except:
            self.billing_hourly_rate = -1.0

        create_directory_if_not_exists(self.frontend_data_location)
        with open(str('%s/backend.json' % self.frontend_data_location), 'w') as fd:
            if self.cost_model == 'CHARGE_BACK':
                cost_model_label = 'costs'
                cost_model_unit = self.billing_currency
            elif self.cost_model == 'RATIO':
                cost_model_label = 'normalized'
                cost_model_unit = '%'
            else:
                cost_model_label = 'cumulative'
                cost_model_unit = '%'
            fd.write('{"cost_model":"%s", "currency":"%s"}' % (cost_model_label, cost_model_unit))

        # handle cacert file if applicable
        if self.k8s_verify_ssl and self.k8s_ssl_cacert and os.path.exists(self.k8s_ssl_cacert):
            self.koa_verify_ssl_option = self.k8s_ssl_cacert
        else:
            self.koa_verify_ssl_option = self.k8s_verify_ssl

    @staticmethod
    def match(items, pattern):
        return any([ fnmatch.fnmatch(i, pattern) for i in items ])

    @staticmethod
    def allow_namespace(namespace):
        if KOA_CONFIG.match(KOA_CONFIG.excluded_namespaces, namespace):
            return False

        return len(KOA_CONFIG.included_namespaces) == 0 or \
                '*' in KOA_CONFIG.included_namespaces or \
                KOA_CONFIG.match(KOA_CONFIG.included_namespaces, namespace)

    def load_rbac_auth_token(self):
        try:
            with open('/var/run/secrets/kubernetes.io/serviceaccount/token', 'r') as rbac_token_file:
                self.k8s_rbac_auth_token = rbac_token_file.read()
        except:
            self.k8s_rbac_auth_token = 'NO_ENV_TOKEN_FILE'

    @staticmethod
    def request_efficiency_db_file_extention():
        return '__rf'

    @staticmethod
    def usage_efficiency_db(ns):
        return '%s%s' % (ns, Config.request_efficiency_db_file_extention())


def configure_logger(debug_enabled):
    if debug_enabled:
        log_level = logging.DEBUG
    else:
        log_level = logging.WARN
    logger = logging.getLogger('kube-opex-analytics')
    logger.setLevel(log_level)
    ch = logging.StreamHandler()
    ch.setLevel(log_level)
    formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
    ch.setFormatter(formatter)
    logger.addHandler(ch)
    return logger


# load configuration
KOA_CONFIG = Config()

# init logger
KOA_LOGGER = configure_logger(KOA_CONFIG.enable_debug)


class RrdPeriod(enum.IntEnum):
    PERIOD_5_MINS_SEC = 300
    PERIOD_1_HOUR_SEC = 3600
    PERIOD_1_DAY_SEC = 86400
    PERIOD_7_DAYS_SEC = 604800
    PERIOD_14_DAYS_SEC = 1209600
    PERIOD_YEAR_SEC = 31968000


# initialize Prometheus exporter


PROMETHEUS_HOURLY_USAGE_EXPORTER = prometheus_client.Gauge('koa_namespace_hourly_usage',
                                                           'Current hourly resource usage per namespace',
                                                           ['namespace', 'resource'])
PROMETHEUS_PERIODIC_USAGE_EXPORTERS = {
    RrdPeriod.PERIOD_14_DAYS_SEC: prometheus_client.Gauge('koa_namespace_daily_usage',
                                                          'Current daily resource usage per namespace',
                                                          ['namespace', 'resource']),
    RrdPeriod.PERIOD_YEAR_SEC: prometheus_client.Gauge('koa_namespace_monthly_usage',
                                                       'Current monthly resource usage per namespace',
                                                       ['namespace', 'resource'])
}

PROMETHEUS_PERIODIC_REQUESTS_EXPORTERS = {
    RrdPeriod.PERIOD_14_DAYS_SEC: prometheus_client.Gauge('koa_namespace_daily_requests',
                                                          'Current daily resource reservation per namespace',
                                                          ['namespace', 'resource']),
    RrdPeriod.PERIOD_YEAR_SEC: prometheus_client.Gauge('koa_namespace_monthly_requests',
                                                       'Current monthly resource reservation per namespace',
                                                       ['namespace', 'resource'])
}

# create Flask application
app = flask.Flask(__name__, static_url_path=KOA_CONFIG.static_content_location, template_folder='.')
cors = CORS(app, resources={r"/dataset/*": {"origins": "127.0.0.1"}})

# Add prometheus wsgi middleware to route /metrics requests
wsgi_dispatcher = wsgi.DispatcherMiddleware(app, {
    '/metrics': prometheus_client.make_wsgi_app()
})


@app.route('/favicon.ico')
def favicon():
    return flask.send_from_directory(os.path.join(app.root_path, 'static'), 'images/favicon.ico',
                                     mimetype='image/vnd.microsoft.icon')


@app.after_request
def add_header(r):
    r.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
    r.headers["Pragma"] = "no-cache"
    r.headers["Expires"] = "0"
    r.headers['Cache-Control'] = 'public, max-age=0'
    return r


@app.route('/js/<path:path>')
def send_js(path):
    return flask.send_from_directory('js', path)


@app.route('/css/<path:path>')
def send_css(path):
    return flask.send_from_directory('css', path)


@app.route('/dataset/<path:path>')
@cross_origin()
def download_dataset(path):
    return flask.send_from_directory('static/data', path)


@app.route('/')
def render():
    return flask.render_template('index.html', koa_frontend_data_location=KOA_CONFIG.frontend_data_location,
                                 koa_version=KOA_CONFIG.version)


class Node:
    def __init__(self):
        self.id = ''
        self.name = ''
        self.state = ''
        self.message = ''
        self.cpuCapacity = 0.0
        self.cpuAllocatable = 0.0
        self.cpuUsage = 0.0
        self.memCapacity = 0.0
        self.memAllocatable = 0.0
        self.memUsage = 0.0
        self.containerRuntime = ''
        self.podsRunning = []
        self.podsNotRunning = []


class Pod:
    def __init__(self):
        self.name = ''
        self.namespace = ''
        self.id = ''
        self.nodeName = ''
        self.phase = ''
        self.state = "PodNotScheduled"
        self.cpuUsage = 0.0
        self.memUsage = 0.0
        self.cpuRequest = 0.0
        self.memRequest = 0.0


class ResourceCapacities:
    def __init__(self, cpu, mem):
        self.cpu = cpu
        self.mem = mem


class JSONMarshaller(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, Node):
            return {
                'id': obj.id,
                'name': obj.name,
                'state': obj.state,
                'message': obj.message,
                'cpuCapacity': obj.cpuCapacity,
                'cpuAllocatable': obj.cpuAllocatable,
                'cpuUsage': obj.cpuUsage,
                'memCapacity': obj.memCapacity,
                'memAllocatable': obj.memAllocatable,
                'memUsage': obj.memUsage,
                'containerRuntime': obj.containerRuntime,
                'podsRunning': obj.podsRunning,
                'podsNotRunning': obj.podsNotRunning
            }
        elif isinstance(obj, Pod):
            return {
                'id': obj.id,
                'name': obj.name,
                'nodeName': obj.nodeName,
                'phase': obj.phase,
                'state': obj.state,
                'cpuUsage': obj.cpuUsage,
                'memUsage': obj.memUsage
            }
        elif isinstance(obj, ResourceCapacities):
            return {
                'cpu': obj.cpu,
                'mem': obj.mem
            }
        return json.JSONEncoder.default(self, obj)


class K8sUsage:
    def __init__(self):
        self.nodes = {}
        self.pods = {}
        self.usageByNamespace = {}
        self.requestByNamespace = {}
        self.popupContent = ''
        self.nodeHtmlList = ''
        self.cpuUsageAllPods = 0.0
        self.memUsageAllPods = 0.0
        self.cpuCapacity = 0.0
        self.memCapacity = 0.0
        self.cpuAllocatable = 0.0
        self.memAllocatable = 0.0
        self.capacityQuantities = {
            'Ki': 1024,
            'Mi': 1048576,
            'Gi': 1073741824,
            'Ti': 1099511627776,
            'Pi': 1125899906842624,
            'Ei': 1152921504606847000,
            'k': 1e3,
            'K': 1e3,
            'M': 1e6,
            'G': 1e9,
            'T': 1e12,
            'P': 1e15,
            'E': 1e18,
            'm': 1e-3,
            'u': 1e-6,
            'n': 1e-9,
            'None': 1
        }

    def decode_capacity(self, cap_input):
        data_length = len(cap_input)
        cap_unit = 'None'
        cap_value = cap_input
        if cap_input.endswith(("Ki", "Mi", "Gi", "Ti", "Pi", "Ei")):
            cap_unit = cap_input[data_length - 2:]
            cap_value = cap_input[0:data_length - 2]
        elif cap_input.endswith(("n", "u", "m", "k", "K", "M", "G", "T", "P", "E")):
            cap_unit = cap_input[data_length - 1:]
            cap_value = cap_input[0:data_length - 1]
        KOA_LOGGER.debug(cap_value)
        return self.capacityQuantities[cap_unit] * float(cap_value)

    def extract_namespaces_and_initialize_usage(self, data):
        # exit if not valid data
        if data is None:
            return
        # process likely valid data
        data_json = json.loads(data)
        for _, item in enumerate(data_json['items']):
            metadata = item.get('metadata', None)
            if metadata is not None:
                if not KOA_CONFIG.allow_namespace(metadata.get('name')):
                    continue
                self.usageByNamespace[metadata.get('name')] = ResourceCapacities(cpu=0.0, mem=0.0)
                self.requestByNamespace[metadata.get('name')] = ResourceCapacities(cpu=0.0, mem=0.0)

        KOA_LOGGER.debug("Found namespaces: %s", ', '.join(self.usageByNamespace.keys()))

    def extract_nodes(self, data):
        # exit if not valid data
        if data is None:
            return
        # process likely valid data
        data_json = json.loads(data)
        for _, item in enumerate(data_json['items']):
            node = Node()
            node.podsRunning = []
            node.podsNotRunning = []

            metadata = item.get('metadata', None)
            if metadata is not None:
                node.id = metadata.get('uid', None)
                node.name = metadata.get('name', None)

            status = item.get('status', None)
            if status is not None:
                node.containerRuntime = status['nodeInfo']['containerRuntimeVersion']

                node.cpuCapacity = self.decode_capacity(status['capacity']['cpu'])
                node.cpuAllocatable = self.decode_capacity(status['allocatable']['cpu'])
                node.memCapacity = self.decode_capacity(status['capacity']['memory'])
                node.memAllocatable = self.decode_capacity(status['allocatable']['memory'])

                for _, cond in enumerate(status['conditions']):
                    node.message = cond['message']
                    if cond['type'] == 'Ready' and cond['status'] == 'True':
                        node.state = 'Ready'
                        break
                    if cond['type'] == 'KernelDeadlock' and cond['status'] == 'True':
                        node.state = 'KernelDeadlock'
                        break
                    if cond['type'] == 'NetworkUnavailable' and cond['status'] == 'True':
                        node.state = 'NetworkUnavailable'
                        break
                    if cond['type'] == 'OutOfDisk' and cond['status'] == 'True':
                        node.state = 'OutOfDisk'
                        break
                    if cond['type'] == 'MemoryPressure' and cond['status'] == 'True':
                        node.state = 'MemoryPressure'
                        break
                    if cond['type'] == 'DiskPressure' and cond['status'] == 'True':
                        node.state = 'DiskPressure'
                        break
            self.nodes[node.name] = node

    def extract_node_metrics(self, data):
        # exit if not valid data
        if data is None:
            return
        # process likely valid data
        data_json = json.loads(data)
        for _, item in enumerate(data_json['items']):
            node = self.nodes.get(item['metadata']['name'], None)
            if node is not None:
                node.cpuUsage = self.decode_capacity(item['usage']['cpu'])
                node.memUsage = self.decode_capacity(item['usage']['memory'])
                self.nodes[node.name] = node

    def extract_pods(self, data):
        # exit if not valid data
        if data is None:
            return

        # process likely valid data
        data_json = json.loads(data)
        for _, item in enumerate(data_json['items']):
            if not KOA_CONFIG.allow_namespace(item['metadata']['namespace']):
                continue

            pod = Pod()
            pod.namespace = item['metadata']['namespace']
            pod.name = '%s.%s' % (item['metadata']['name'], pod.namespace)
            pod.id = item['metadata']['uid']
            pod.phase = item['status']['phase']
            if 'conditions' not in item['status']:
                KOA_LOGGER.debug('[puller] phase of pod %s in namespace %s is %s', pod.name, pod.namespace, pod.phase)
            else:
                pod.state = 'PodNotScheduled'
                for _, cond in enumerate(item['status']['conditions']):
                    if cond['type'] == 'Ready' and cond['status'] == 'True':
                        pod.state = 'Ready'
                        break
                    if cond['type'] == 'ContainersReady' and cond['status'] == 'True':
                        pod.state = "ContainersReady"
                        break
                    if cond['type'] == 'PodScheduled' and cond['status'] == 'True':
                        pod.state = "PodScheduled"
                        break
                    if cond['type'] == 'Initialized' and cond['status'] == 'True':
                        pod.state = "Initialized"
                        break

            if pod.state == 'PodNotScheduled':
                pod.nodeName = None
            else:
                pod.nodeName = item['spec']['nodeName']
                pod.cpuRequest = 0.0
                pod.memRequest = 0.0
                #TODO: extract initContainers
                for _, container in enumerate(item.get('spec').get('containers')):
                    resources = container.get('resources', None)
                    if resources is not None:
                        resource_requests = resources.get('requests', None)
                        if resource_requests is not None:
                            pod.cpuRequest += self.decode_capacity(resource_requests.get('cpu', '0'))
                            pod.memRequest += self.decode_capacity(resource_requests.get('memory', '0'))

            self.pods[pod.name] = pod

    def extract_pod_metrics(self, data):
        # exit if not valid data
        if data is None:
            return
        # process likely valid data
        data_json = json.loads(data)
        for _, item in enumerate(data_json['items']):
            if not KOA_CONFIG.allow_namespace(item['metadata']['namespace']):
                continue
            pod_name = '%s.%s' % (item['metadata']['name'], item['metadata']['namespace'])
            pod = self.pods.get(pod_name, None)
            if pod is not None:
                pod.cpuUsage = 0.0
                pod.memUsage = 0.0
                for _, container in enumerate(item['containers']):
                    pod.cpuUsage += self.decode_capacity(container['usage']['cpu'])
                    pod.memUsage += self.decode_capacity(container['usage']['memory'])
                self.pods[pod.name] = pod

    def consolidate_ns_usage(self):
        """
        Consolidate namespace usage.

        :return:
        """
        self.cpuUsageAllPods = 0.0
        self.memUsageAllPods = 0.0
        for pod in self.pods.values():
            if pod.nodeName is not None and hasattr(pod, 'cpuUsage') and hasattr(pod, 'memUsage'):
                self.cpuUsageAllPods += pod.cpuUsage
                self.memUsageAllPods += pod.memUsage

                ns_pod_usage = self.usageByNamespace.get(pod.namespace, None)
                if ns_pod_usage is not None:
                    ns_pod_usage.cpu += pod.cpuUsage
                    ns_pod_usage.mem += pod.memUsage

                ns_pod_request = self.requestByNamespace.get(pod.namespace, None)
                if ns_pod_request is not None:
                    ns_pod_request.cpu += pod.cpuRequest
                    ns_pod_request.mem += pod.memRequest

                pod_node = self.nodes.get(pod.nodeName, None)
                if pod_node is not None:
                    pod_node.podsRunning.append(pod)

        self.cpuCapacity += 0.0
        self.memCapacity += 0.0
        for node in self.nodes.values():
            if hasattr(node, 'cpuCapacity') and hasattr(node, 'memCapacity'):
                self.cpuCapacity += node.cpuCapacity
                self.memCapacity += node.memCapacity

        self.cpuAllocatable += 0.0
        self.memAllocatable += 0.0
        for node in self.nodes.values():
            if hasattr(node, 'cpuAllocatable') and hasattr(node, 'memAllocatable'):
                self.cpuAllocatable += node.cpuAllocatable
                self.memAllocatable += node.memAllocatable

    def dump_nodes(self):
        with open(str('%s/nodes.json' % KOA_CONFIG.frontend_data_location), 'w') as fd:
            fd.write(json.dumps(self.nodes, cls=JSONMarshaller))


def compute_usage_percent_ratio(value, total):
    return round((100.0 * value) / total, KOA_CONFIG.db_round_decimals)


class ResUsageType(enum.IntEnum):
    CPU = 0
    MEMORY = 1


class Rrd:
    def __init__(self, db_files_location=None, dbname=None):
        create_directory_if_not_exists(db_files_location)
        self.dbname = dbname
        self.rrd_location = str('%s/%s' % (KOA_CONFIG.db_location, dbname))
        self.create_rrd_file_if_not_exists()

    def get_creation_time_epoch(self):
        return int(os.path.getctime(self.rrd_location))

    @staticmethod
    def get_date_group(timeUTC, period):
        if period == RrdPeriod.PERIOD_YEAR_SEC:
            return time.strftime('%b %Y', timeUTC)
        return time.strftime('%d %b', timeUTC)

    def create_rrd_file_if_not_exists(self):
        if not os.path.exists(self.rrd_location):
            xfs = 2 * KOA_CONFIG.polling_interval_sec
            rrdtool.create(self.rrd_location,
                           "--step", str(KOA_CONFIG.polling_interval_sec),
                           "--start", "0",
                           str('DS:cpu_usage:GAUGE:%d:U:U' % xfs),
                           str('DS:mem_usage:GAUGE:%d:U:U' % xfs),
                           "RRA:AVERAGE:0.5:1:4032",
                           "RRA:AVERAGE:0.5:12:8880")

    def add_sample(self, timestamp_epoch, cpu_usage, mem_usage):
        KOA_LOGGER.debug('[puller][sample] %s, %f, %f', self.dbname, cpu_usage, mem_usage)
        try:
            rrdtool.update(self.rrd_location, '%s:%s:%s' % (
                timestamp_epoch,
                round(cpu_usage, KOA_CONFIG.db_round_decimals),
                round(mem_usage, KOA_CONFIG.db_round_decimals)))
        except rrdtool.OperationalError:
            KOA_LOGGER.error("failing adding rrd sample => %s", traceback.format_exc())

    def dump_trend_data(self, period, step_in=None):
        now_epoch_utc = calendar.timegm(time.gmtime())
        if step_in is not None:
            step = int(step_in)
        else:
            step = int(RrdPeriod.PERIOD_1_HOUR_SEC)

        rrd_end_ts_in = int(int(calendar.timegm(time.gmtime()) * step) / step)
        rrd_start_ts_in = int(rrd_end_ts_in - int(period))
        rrd_result = rrdtool.fetch(self.rrd_location,
                                   'AVERAGE',
                                   '-r', str(step),
                                   '-s', str(rrd_start_ts_in),
                                   '-e', str(rrd_end_ts_in))
        rrd_start_ts_out, _, step = rrd_result[0]
        rrd_current_ts = rrd_start_ts_out
        res_usage = collections.defaultdict(list)
        sum_res_usage = collections.defaultdict(lambda: 0.0)
        for _, cdp in enumerate(rrd_result[2]):
            rrd_current_ts += step
            if len(cdp) == 2:
                try:
                    rrd_cdp_gmtime = time.gmtime(rrd_current_ts)
                    current_cpu_usage = round(100 * float(cdp[0]), KOA_CONFIG.db_round_decimals) / 100
                    current_mem_usage = round(100 * float(cdp[1]), KOA_CONFIG.db_round_decimals) / 100
                    datetime_utc_json = time.strftime('%Y-%m-%dT%H:%M:%SZ', rrd_cdp_gmtime)
                    res_usage[ResUsageType.CPU].append(
                        '{"name":"%s","dateUTC":"%s","usage":%f}' % (self.dbname, datetime_utc_json, current_cpu_usage))
                    res_usage[ResUsageType.MEMORY].append(
                        '{"name":"%s","dateUTC":"%s","usage":%f}' % (self.dbname, datetime_utc_json, current_mem_usage))
                    sum_res_usage[ResUsageType.CPU] += current_cpu_usage
                    sum_res_usage[ResUsageType.MEMORY] += current_mem_usage
                    if calendar.timegm(rrd_cdp_gmtime) == int(
                            int(now_epoch_utc / RrdPeriod.PERIOD_1_HOUR_SEC) * RrdPeriod.PERIOD_1_HOUR_SEC):
                        PROMETHEUS_HOURLY_USAGE_EXPORTER.labels(self.dbname, ResUsageType.CPU.name).set(
                            current_cpu_usage)
                        PROMETHEUS_HOURLY_USAGE_EXPORTER.labels(self.dbname, ResUsageType.MEMORY.name).set(
                            current_mem_usage)
                except:
                    pass

        if sum_res_usage[ResUsageType.CPU] > 0.0 and sum_res_usage[ResUsageType.MEMORY] > 0.0:
            return (','.join(res_usage[ResUsageType.CPU]), ','.join(res_usage[ResUsageType.MEMORY]))
        else:
            if step_in is None:
                return self.dump_trend_data(period, step_in=RrdPeriod.PERIOD_5_MINS_SEC)
        return '', ''

    def dump_histogram_data(self, period, step_in=None):
        if step_in is not None:
            step = int(step_in)
        else:
            step = int(RrdPeriod.PERIOD_1_HOUR_SEC)

        rrd_end_ts = int(int(calendar.timegm(time.gmtime()) * step) / step)
        rrd_start_ts = int(rrd_end_ts - int(period))
        rrd_result = rrdtool.fetch(self.rrd_location, 'AVERAGE', '-r', str(step), '-s', str(rrd_start_ts), '-e',
                                   str(rrd_end_ts))
        rrd_start_ts_out, _, step = rrd_result[0]
        rrd_current_ts = rrd_start_ts_out
        periodic_cpu_usage = collections.defaultdict(lambda: 0.0)
        periodic_mem_usage = collections.defaultdict(lambda: 0.0)
        for _, cdp in enumerate(rrd_result[2]):
            rrd_current_ts += step
            if len(cdp) == 2:
                try:
                    rrd_cdp_gmtime = time.gmtime(rrd_current_ts)
                    date_group = self.get_date_group(rrd_cdp_gmtime, period)
                    current_cpu_usage = round(100 * float(cdp[0]), KOA_CONFIG.db_round_decimals) / 100
                    current_mem_usage = round(100 * float(cdp[1]), KOA_CONFIG.db_round_decimals) / 100
                    periodic_cpu_usage[date_group] += current_cpu_usage
                    periodic_mem_usage[date_group] += current_mem_usage
                except:
                    pass
        return periodic_cpu_usage, periodic_mem_usage

    @staticmethod
    def dump_trend_analytics(dbfiles, category='usage'):
        """
        Compute the analytics trends given a category.

        :param dbfiles: array of RRD files
        :param category: may be 'usage' or 'rf' (request factor) according the type of analytics trends expected
        :return: None
        """
        res_usage = collections.defaultdict(list)
        for _, db in enumerate(dbfiles):
            if db == KOA_CONFIG.db_billing_hourly_rate:
                if not KOA_CONFIG.enable_debug:
                    continue

            rrd = Rrd(db_files_location=KOA_CONFIG.db_location, dbname=db)
            current_trend_data = rrd.dump_trend_data(period=RrdPeriod.PERIOD_7_DAYS_SEC)
            for res in [ResUsageType.CPU, ResUsageType.MEMORY]:
                if current_trend_data[res]:
                    res_usage[res].append(current_trend_data[res])

        with open(str('%s/cpu_%s_trends.json' % (KOA_CONFIG.frontend_data_location, category)), 'w') as fd:
            fd.write('[' + ','.join(res_usage[0]) + ']')

        with open(str('%s/memory_%s_trends.json' % (KOA_CONFIG.frontend_data_location, category)), 'w') as fd:
            fd.write('[' + ','.join(res_usage[1]) + ']')

    @staticmethod
    def dump_histogram_analytics(dbfiles, period):
        """
        Dump usage history data.

        :param dbfiles: The target RRD file
        :param period: the retrieval period
        :return:
        """
        now_gmtime = time.gmtime()
        usage_export = collections.defaultdict(list)
        usage_per_type_date = {}
        sum_usage_per_type_date = {}
        requests_export = collections.defaultdict(list)
        requests_per_type_date = {}
        sum_requests_per_type_date = {}
        for _, db in enumerate(dbfiles):
            rrd = Rrd(db_files_location=KOA_CONFIG.db_location, dbname=db)
            current_periodic_usage = rrd.dump_histogram_data(period=period)

            rrd = Rrd(db_files_location=KOA_CONFIG.db_location, dbname=KOA_CONFIG.usage_efficiency_db(db))
            current_periodic_rf = rrd.dump_histogram_data(period=period)

            for res in [ResUsageType.CPU, ResUsageType.MEMORY]:
                for date_key, usage_value in current_periodic_usage[res].items():
                    if usage_value > 0.0:
                        if res not in usage_per_type_date:
                            usage_per_type_date[res] = collections.defaultdict(lambda: 0.0)
                        if date_key not in usage_per_type_date[res]:
                            usage_per_type_date[res][date_key] = {}
                        usage_per_type_date[res][date_key][db] = usage_value

                        if res not in requests_per_type_date:
                            requests_per_type_date[res] = collections.defaultdict(lambda: 0.0)
                        if date_key not in requests_per_type_date[res]:
                            requests_per_type_date[res][date_key] = {}

                        rf = current_periodic_rf[res][date_key]
                        if rf > 0.0:
                            requests_per_type_date[res][date_key][db] = usage_value / rf
                        else:
                            requests_per_type_date[res][date_key][db] = 0.0

                        if db != KOA_CONFIG.db_billing_hourly_rate:
                            if res not in sum_usage_per_type_date:
                                sum_usage_per_type_date[res] = collections.defaultdict(lambda: 0.0)
                            sum_usage_per_type_date[res][date_key] += usage_value

                            if res not in sum_requests_per_type_date:
                                sum_requests_per_type_date[res] = collections.defaultdict(lambda: 0.0)
                            sum_requests_per_type_date[res][date_key] += usage_value

        for res, usage_data_bundle in usage_per_type_date.items():
            for date_key, db_usage_item in usage_data_bundle.items():
                for db, usage_value in db_usage_item.items():
                    if db != KOA_CONFIG.db_billing_hourly_rate:
                        usage_cost = round(usage_value, KOA_CONFIG.db_round_decimals)
                        if KOA_CONFIG.cost_model == 'RATIO' or KOA_CONFIG.cost_model == 'CHARGE_BACK':
                            usage_ratio = usage_value / sum_usage_per_type_date[res][date_key]
                            usage_cost = round(100 * usage_ratio, KOA_CONFIG.db_round_decimals)
                            if KOA_CONFIG.cost_model == 'CHARGE_BACK':
                                usage_cost = round(
                                    usage_ratio * usage_per_type_date[res][date_key][KOA_CONFIG.db_billing_hourly_rate],
                                    KOA_CONFIG.db_round_decimals)
                        usage_export[res].append('{"stack":"%s","usage":%f,"date":"%s"}' % (db, usage_cost, date_key))
                        if Rrd.get_date_group(now_gmtime, period) == date_key:
                            PROMETHEUS_PERIODIC_USAGE_EXPORTERS[period].labels(db, ResUsageType(res).name).set(
                                usage_cost)

                        requests_value = requests_per_type_date[res][date_key][db]
                        requests_cost = round(requests_value, KOA_CONFIG.db_round_decimals)
                        if KOA_CONFIG.cost_model == 'RATIO' or KOA_CONFIG.cost_model == 'CHARGE_BACK':
                            requests_ratio = requests_value / sum_requests_per_type_date[res][date_key]
                            requests_cost = round(100 * requests_ratio, KOA_CONFIG.db_round_decimals)
                            if KOA_CONFIG.cost_model == 'CHARGE_BACK':
                                requests_cost = round(
                                    requests_ratio * usage_per_type_date[res][date_key][KOA_CONFIG.db_billing_hourly_rate],
                                    KOA_CONFIG.db_round_decimals)
                        requests_export[res].append('{"stack":"%s","requests":%f,"date":"%s"}' % (db, requests_cost, date_key))
                        if Rrd.get_date_group(now_gmtime, period) == date_key:
                            PROMETHEUS_PERIODIC_REQUESTS_EXPORTERS[period].labels(db, ResUsageType(res).name).set(
                                requests_cost)

        with open(str('%s/cpu_usage_period_%d.json' % (KOA_CONFIG.frontend_data_location, period)), 'w') as fd:
            fd.write('[' + ','.join(usage_export[0]) + ']')
        with open(str('%s/memory_usage_period_%d.json' % (KOA_CONFIG.frontend_data_location, period)), 'w') as fd:
            fd.write('[' + ','.join(usage_export[1]) + ']')
        with open(str('%s/cpu_requests_period_%d.json' % (KOA_CONFIG.frontend_data_location, period)), 'w') as fd:
            fd.write('[' + ','.join(requests_export[0]) + ']')
        with open(str('%s/memory_requests_period_%d.json' % (KOA_CONFIG.frontend_data_location, period)), 'w') as fd:
            fd.write('[' + ','.join(requests_export[1]) + ']')


def pull_k8s(api_context):
    data = None
    api_endpoint = '%s%s' % (KOA_CONFIG.k8s_api_endpoint, api_context)
    headers = {}
    client_cert = None
    endpoint_info = urllib.parse.urlparse(KOA_CONFIG.k8s_api_endpoint)
    if KOA_CONFIG.enable_debug or (endpoint_info.hostname != '127.0.0.1' and endpoint_info.hostname != 'localhost'):
        if KOA_CONFIG.k8s_auth_token != 'NO_ENV_AUTH_TOKEN':
            headers['Authorization'] = '%s %s' % (KOA_CONFIG.k8s_auth_token_type, KOA_CONFIG.k8s_auth_token)
        elif KOA_CONFIG.k8s_rbac_auth_token != 'NO_ENV_TOKEN_FILE':
            headers['Authorization'] = ('Bearer %s' % KOA_CONFIG.k8s_rbac_auth_token)
        elif KOA_CONFIG.k8s_auth_username != 'NO_ENV_AUTH_USERNAME' and \
                KOA_CONFIG.k8s_auth_password != 'NO_ENV_AUTH_PASSWORD':
            token = base64.b64encode('%s:%s' % (KOA_CONFIG.k8s_auth_username, KOA_CONFIG.k8s_auth_password))
            headers['Authorization'] = ('Basic %s' % token)
        elif os.path.isfile(KOA_CONFIG.k8s_ssl_client_cert) and os.path.isfile(KOA_CONFIG.k8s_ssl_client_cert_key):
            client_cert = (KOA_CONFIG.k8s_ssl_client_cert, KOA_CONFIG.k8s_ssl_client_cert_key)

    try:
        http_req = requests.get(api_endpoint,
                                verify=KOA_CONFIG.koa_verify_ssl_option,
                                headers=headers,
                                cert=client_cert)
        if http_req.status_code == 200:
            data = http_req.text
        else:
            KOA_LOGGER.error("call to %s returned error (%s)", api_endpoint, http_req.text)
    except Exception as ex:
        KOA_LOGGER.error("Exception calling HTTP endpoint %s (%s)", api_endpoint, ex)
    except:
        KOA_LOGGER.error("unknown exception requesting %s", api_endpoint)

    return data


def create_metrics_puller():
    try:
        while True:
            KOA_LOGGER.debug('[puller] collecting new samples')

            KOA_CONFIG.load_rbac_auth_token()

            k8s_usage = K8sUsage()
            k8s_usage.extract_namespaces_and_initialize_usage(pull_k8s('/api/v1/namespaces'))
            k8s_usage.extract_nodes(pull_k8s('/api/v1/nodes'))
            k8s_usage.extract_node_metrics(pull_k8s('/apis/metrics.k8s.io/v1beta1/nodes'))
            k8s_usage.extract_pods(pull_k8s('/api/v1/pods'))
            k8s_usage.extract_pod_metrics(pull_k8s('/apis/metrics.k8s.io/v1beta1/pods'))
            k8s_usage.consolidate_ns_usage()
            k8s_usage.dump_nodes()

            if k8s_usage.cpuCapacity > 0.0 and k8s_usage.memCapacity > 0.0:
                now_epoch = calendar.timegm(time.gmtime())

                # handle non-allocatable resources
                cpu_non_allocatable = compute_usage_percent_ratio(k8s_usage.cpuCapacity - k8s_usage.cpuAllocatable,
                                                                  k8s_usage.cpuCapacity)
                mem_non_allocatable = compute_usage_percent_ratio(k8s_usage.memCapacity - k8s_usage.memAllocatable,
                                                                  k8s_usage.memCapacity)
                rrd = Rrd(db_files_location=KOA_CONFIG.db_location, dbname=KOA_CONFIG.db_non_allocatable)
                rrd.add_sample(timestamp_epoch=now_epoch, cpu_usage=cpu_non_allocatable, mem_usage=mem_non_allocatable)

                # handle billing data
                rrd = Rrd(db_files_location=KOA_CONFIG.db_location, dbname=KOA_CONFIG.db_billing_hourly_rate)
                rrd.add_sample(timestamp_epoch=now_epoch, cpu_usage=KOA_CONFIG.billing_hourly_rate,
                               mem_usage=KOA_CONFIG.billing_hourly_rate)

                # handle resource request and usage by pods
                for ns, ns_usage in k8s_usage.usageByNamespace.items():
                    rrd = Rrd(db_files_location=KOA_CONFIG.db_location, dbname=ns)
                    cpu_usage = compute_usage_percent_ratio(ns_usage.cpu, k8s_usage.cpuCapacity)
                    mem_usage = compute_usage_percent_ratio(ns_usage.mem, k8s_usage.memCapacity)
                    rrd.add_sample(timestamp_epoch=now_epoch, cpu_usage=cpu_usage, mem_usage=mem_usage)

                    cpu_efficiency = 1.0
                    mem_efficiency = 1.0
                    request_capacities = k8s_usage.requestByNamespace.get(ns, None)
                    if request_capacities is not None:
                        if request_capacities.cpu > 0.0:
                            cpu_efficiency = round(ns_usage.cpu / request_capacities.cpu, 2)
                        if request_capacities.mem > 0.0:
                            mem_efficiency = round(ns_usage.mem / request_capacities.mem, 2)

                    if cpu_efficiency > 0.0 or mem_efficiency > 0.0:
                        rrd = Rrd(db_files_location=KOA_CONFIG.db_location, dbname=KOA_CONFIG.usage_efficiency_db(ns))
                        rrd.add_sample(timestamp_epoch=now_epoch, cpu_usage=cpu_efficiency, mem_usage=mem_efficiency)

            time.sleep(int(KOA_CONFIG.polling_interval_sec))

    except Exception as ex:
        exception_type = type(ex).__name__
        KOA_LOGGER.error("%s Exception in create_metrics_puller => %s", exception_type, traceback.format_exc())


def dump_analytics():
    try:
        export_interval = round(1.5 * KOA_CONFIG.polling_interval_sec)
        while True:
            dbfiles: List[Any] = []
            for (_, _, filenames) in os.walk(KOA_CONFIG.db_location):
                dbfiles.extend(filenames)
                break

            ns_dbfiles = []
            rf_dbfiles = []
            for fn in dbfiles:
                if fn.endswith(KOA_CONFIG.request_efficiency_db_file_extention()):
                    rf_dbfiles.append(fn)
                else:
                    ns_dbfiles.append(fn)

            Rrd.dump_trend_analytics(ns_dbfiles, 'usage')
            Rrd.dump_trend_analytics(rf_dbfiles, 'rf')
            Rrd.dump_histogram_analytics(dbfiles=ns_dbfiles, period=RrdPeriod.PERIOD_14_DAYS_SEC)
            Rrd.dump_histogram_analytics(dbfiles=ns_dbfiles, period=RrdPeriod.PERIOD_YEAR_SEC)
            time.sleep(export_interval)
    except Exception as ex:
        exception_type = type(ex).__name__
        KOA_LOGGER.error("%s Exception in dump_analytics => %s", exception_type, traceback.format_exc())


# validating configs
if KOA_CONFIG.cost_model == 'CHARGE_BACK' and KOA_CONFIG.billing_hourly_rate <= 0.0:
    KOA_LOGGER.fatal('invalid billing hourly rate for CHARGE_BACK cost allocation')
    sys.exit(1)

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Kubernetes Opex Analytics Backend')
    parser.add_argument('-v', '--version', action='version', version='%(prog)s ' + KOA_CONFIG.version)
    args = parser.parse_args()
    th_puller = threading.Thread(target=create_metrics_puller)
    th_exporter = threading.Thread(target=dump_analytics)
    th_puller.start()
    th_exporter.start()

    if not KOA_CONFIG.enable_debug:
        waitress_serve(wsgi_dispatcher, listen='0.0.0.0:5483')
    else:
        app.run(host='0.0.0.0', port=5483)
