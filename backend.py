"""
# File: backend.py                                                                       #
# Author: Rodrigue Chakode <rodrigue.chakode @ gmail dot com>                            #
#                                                                                        #
# Copyright © 2019 Rodrigue Chakode and contributors.                                    #
#                                                                                        #
# This file is part of Kubernetes Opex Analytics software.                               #
#                                                                                        #
# Kubernetes Opex Analytics is licensed under the Apache License 2.0 (the "License");    #
# you may not use this file except in compliance with the License. You may obtain        #
# a copy of the License at: http://www.apache.org/licenses/LICENSE-2.0                   #
#                                                                                        #
# Unless required by applicable law or agreed to in writing, software distributed        #
# under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR            #
# CONDITIONS OF ANY KIND, either express or implied. See the License for the             #
# specific language governing permissions and limitations under the License.             #
"""

import argparse
import flask
import requests
import threading
import time
import os
import json
import errno
import rrdtool
import logging
import calendar
import sys
import collections
import enum
import werkzeug.wsgi
import prometheus_client

# configuration object
class Config:
    version = '0.2.0'
    static_content_location = '/static'
    frontend_data_location = '.%s/data' % (static_content_location)
    enable_debug = (lambda v: v.lower() in ("yes", "true"))(os.getenv('KOA_ENABLE_DEBUG', 'true'))
    k8s_api_endpoint = os.getenv('KOA_K8S_API_ENDPOINT', 'http://127.0.0.1:8001')
    k8s_verify_ssl = (lambda v: v.lower() in ("yes", "true"))(os.getenv('KOA_K8S_API_VERIFY_SSL', 'true'))
    k8s_auth_token = os.getenv('KOA_K8S_AUTH_TOKEN', 'INVALID_TOKEN')
    db_location = os.getenv('KOA_DB_LOCATION', ('%s/.kube-opex-analytics/db') % os.getenv('HOME', '/tmp'))
    polling_interval_sec = int(os.getenv('KOA_POLLING_INTERVAL_SEC', '300'))
    billing_currency = os.getenv('KOA_BILLING_CURRENCY_SYMBOL', '$')
    billing_hourly_rate = 0.0
    def __init__(self):
        try:
            self.billing_hourly_rate = float(os.getenv('KOA_BILLING_HOURLY_RATE'))
            if billing_hourly_rate < 0.0:
                sys.stderr.write('negative value for KOA_BILLING_HOURLY_RATE (%f), set it to 0.0 ' % billing_hourly_rate)
                self.billing_hourly_rate = 0.0
        except:
            pass

# load configuration
KOA_CONFIG = Config()  


# configure logger
def configure_logger():
    if KOA_CONFIG.enable_debug:
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

# create logger
KOA_LOGGER = configure_logger()


# initialize Prometheus exporter
PROMETHEUS_HOURLY_USAGE_EXPORTER = prometheus_client.Gauge('koa_namespace_last_hourly_usage', 
                                                    'Last hourly resource usage per namespace', 
                                                    ['namespace', 'usage_type'])   
PROMETHEUS_PERIODIC_USAGE_EXPORTER = prometheus_client.Gauge('koa_namespace_periodic_usage', 
                                                    'Periodic resource usage per namespace', 
                                                    ['analytics_interval', 'namespace', 'resource', 'date'])                                                                                                             

# create Flask application
app = flask.Flask(__name__, static_url_path=KOA_CONFIG.static_content_location, template_folder='.')

# Add prometheus wsgi middleware to route /metrics requests
wsgi_dispatcher = werkzeug.wsgi.DispatcherMiddleware(app, {
    '/metrics': prometheus_client.make_wsgi_app()
})

@app.route('/favicon.ico')
def favicon():
    return flask.send_from_directory(os.path.join(app.root_path, 'static'), 'images/favicon.ico', mimetype='image/vnd.microsoft.icon')

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


@app.route('/')
def render():
    return flask.render_template('index.html', koa_frontend_data_location=KOA_CONFIG.frontend_data_location, koa_version=KOA_CONFIG.version)


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


class ResourceUsage:
    def __init__(self, cpuUsage, memUsage):
        self.cpuUsage = cpuUsage
        self.memUsage = memUsage


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
        elif isinstance(obj, ResourceUsage):
            return {
                'cpuUsage': obj.cpuUsage,
                'memUsage': obj.memUsage
            }
        return json.JSONEncoder.default(self, obj)


class K8sUsage:
    def __init__(self):
        self.nodes = {}
        self.pods = {}
        self.nsResUsage = {}
        self.popupContent = ''
        self.nodeHtmlList = ''
        self.cpuUsedByPods = 0.0
        self.memUsedByPods = 0.0
        self.cpuCapacity = 0.0
        self.memCapacity = 0.0
        self.cpuAllocatable = 0.0
        self.memAllocatable = 0.0

    def decode_memory_capacity(self, cap_input):
        data_length = len(cap_input)
        cap_unit = ''
        cap_value = ''
        if cap_input.endswith("i"):
            cap_unit = cap_input[data_length - 2:]
            cap_value = cap_input[0:data_length - 2]
        else:
            cap_value = cap_input

        if cap_unit == '':
            return int(cap_value)
        if cap_unit == 'Ki':
            return 1e3 * int(cap_value)
        if cap_unit == 'Mi':
            return 1e6 * int(cap_value)
        if cap_unit == 'Gi':
            return 1e9 * int(cap_value)
        if cap_unit == 'Ti':
            return 1e12 * int(cap_value)
        if cap_unit == 'Pi':
            return 1e15 * int(cap_value)
        if cap_unit == 'Ei':
            return 1e18 * int(cap_value)

        return 0

    def decode_cpu_capacity(self, cap_input):
        data_length = len(cap_input)
        cap_unit = cap_input[data_length - 1:]
        cap_value = cap_input[0:data_length - 1]
        if cap_unit == 'n':
            return 1e-9 * int(cap_value)
        if cap_unit == 'm':
            return 1e-3 * int(cap_value)
        return int(cap_input)

    def extract_namespaces_and_initialize_usage(self, data):
        # exit if not valid data
        if data is None:
            return
        # process likely valid data
        data_json = json.loads(data)
        for _, item in enumerate(data_json['items']):
            self.nsResUsage[item['metadata']['name']] = ResourceUsage(
                cpuUsage=0.0, memUsage=0.0)

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
            node.name = item['metadata']['name']
            node.id = item['metadata']['uid']
            node.cpuCapacity = self.decode_cpu_capacity(item['status']['capacity']['cpu'])
            node.cpuAllocatable = self.decode_cpu_capacity(item['status']['allocatable']['cpu'])
            node.memCapacity = self.decode_memory_capacity(item['status']['capacity']['memory'])
            node.memAllocatable = self.decode_memory_capacity(item['status']['allocatable']['memory'])
            node.containerRuntime = item['status']['nodeInfo']['containerRuntimeVersion']

            for _, cond in enumerate(item['status']['conditions']):
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
                node.cpuUsage = self.decode_cpu_capacity(item['usage']['cpu'])
                node.memUsage = self.decode_memory_capacity(item['usage']['memory'])
                self.nodes[node.name] = node

    def extract_pods(self, data):
        # exit if not valid data
        if data is None:
            return

        # process likely valid data
        data_json = json.loads(data)
        for _, item in enumerate(data_json['items']):
            pod = Pod()
            pod.namespace = item['metadata']['namespace']
            pod.name = '%s.%s' % (item['metadata']['name'], pod.namespace)
            pod.id = item['metadata']['uid']
            pod.phase = item['status']['phase']
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

            if pod.state != 'PodNotScheduled':
                pod.nodeName = item['spec']['nodeName']
            else:
                pod.nodeName = None

            self.pods[pod.name] = pod

    def extract_pod_metrics(self, data):
        # exit if not valid data
        if data is None:
            return
        # process likely valid data
        data_json = json.loads(data)
        for _, item in enumerate(data_json['items']):
            podName = '%s.%s' % (item['metadata']['name'], item['metadata']['namespace'])
            pod = self.pods.get(podName, None)
            if pod is not None:
                pod.cpuUsage = 0.0
                pod.memUsage = 0.0
                for _, container in enumerate(item['containers']):
                    pod.cpuUsage += self.decode_cpu_capacity(container['usage']['cpu'])
                    pod.memUsage += self.decode_memory_capacity(container['usage']['memory'])
                self.pods[pod.name] = pod


    def consolidate_ns_usage(self):
        self.cpuUsedByPods = 0.0
        self.memUsedByPods = 0.0
        for pod in self.pods.values():
            if hasattr(pod, 'cpuUsage') and hasattr(pod, 'memUsage'):
                self.cpuUsedByPods += pod.cpuUsage
                self.nsResUsage[pod.namespace].cpuUsage += pod.cpuUsage
                self.nsResUsage[pod.namespace].memUsage += pod.memUsage
                self.memUsedByPods += pod.memUsage
                self.nodes[pod.nodeName].podsRunning.append(pod)
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
    return round((100.0*value) / total, 1)

def create_directory_if_not_exists(path):
    try:
        os.makedirs(path)
    except OSError as e:
        if e.errno != errno.EEXIST:
            raise

class RrdPeriod(enum.IntEnum):
    PERIOD_5_MINS_SEC  = 300
    PERIOD_1_HOUR_SEC  = 3600
    PERIOD_1_DAY_SEC   = 86400
    PERIOD_7_DAYS_SEC  = 604800
    PERIOD_14_DAYS_SEC = 1209600
    PERIOD_YEAR_SEC    = 31968000  

class ResUsageType(enum.IntEnum):
    CPU                 = 0
    MEMORY              = 1
    BILLING_HOURLY_RATE = 2


class Rrd:
    def __init__(self, db_files_location=None, dbname=None):
        create_directory_if_not_exists(db_files_location)
        self.dbname = dbname
        self.rrd_location = str('%s/%s.rrd' % (KOA_CONFIG.db_location, dbname))
        self.create_rrd_file_if_not_exists()

    def get_creation_time_epoch(self):
        return int(os.path.getctime(self.rrd_location))

    @staticmethod
    def get_date_group(timeUTC, period):
        if period == RrdPeriod.PERIOD_YEAR_SEC:
            return time.strftime('%b %Y', timeUTC)
        return time.strftime('%b %d', timeUTC)

    def create_rrd_file_if_not_exists(self):
        if not os.path.exists(self.rrd_location):
            xfs = 2 * KOA_CONFIG.polling_interval_sec
            rrdtool.create(self.rrd_location,
                "--step", str(KOA_CONFIG.polling_interval_sec),
                "--start", "0",
                str('DS:cpu_usage:GAUGE:%d:U:U' % xfs),
                str('DS:mem_usage:GAUGE:%d:U:U' % xfs),
                str('DS:billing_hourly_rate:GAUGE:%d:U:U' % xfs),
                "RRA:AVERAGE:0.5:1:4032",
                "RRA:AVERAGE:0.5:12:8880")

    def add_sample(self, timestamp_epoch, cpu_usage, mem_usage, billing_hourly_rate):
        KOA_LOGGER.debug('[puller][sample] %s, %f, %f, %f' % (self.dbname, cpu_usage, mem_usage, billing_hourly_rate))
        try:
            rrdtool.update(self.rrd_location, '%s:%s:%s:%s'%(
                timestamp_epoch,
                round(cpu_usage, 1),
                round(mem_usage, 1),
                round(billing_hourly_rate, 6)))
        except rrdtool.OperationalError as e:
            KOA_LOGGER.error("failing adding rrd sample (%s)" % e)

    def dump_trend_data(self, period, step_in=None):
        # process optional arguments
        if step_in is not None:
            step = int(step_in)
        else: 
            step = int(RrdPeriod.PERIOD_1_HOUR_SEC)
        
        # actual processing
        end_ts_in = int(int(calendar.timegm(time.gmtime()) * step) / step)
        start_ts_in  = int(end_ts_in - int(period))
        result = rrdtool.fetch(self.rrd_location, 'AVERAGE', '-r', str(step), '-s', str(start_ts_in), '-e', str(end_ts_in))
        res_usage = collections.defaultdict(list)
        sum_res_usage = collections.defaultdict(lambda:0.0)
        cumulated_cost = 0.0
        start_ts_out, _, step = result[0]
        current_ts = start_ts_out

        for _, cdp in enumerate( result[2] ):
            current_ts += step
            if len(cdp) == 4:
                try:
                    datetime_utc = time.gmtime(current_ts)
                    current_cpu_usage = round(100*float(cdp[0]))/100
                    current_mem_usage = round(100*float(cdp[1]))/100
                    #TODO process usage with current_billing_hourly_rate
                    current_billing_hourly_rate = round(100*float(cdp[2]))/100
                    datetime_utc_json = time.strftime('%Y-%m-%dT%H:%M:%SZ', datetime_utc)
                    res_usage[ResUsageType.CPU].append('{"name":"%s","dateUTC":"%s","usage":%f}' % (self.dbname, datetime_utc_json, current_cpu_usage))
                    res_usage[ResUsageType.MEMORY].append('{"name":"%s","dateUTC":"%s","usage":%f}' % (self.dbname, datetime_utc_json, current_mem_usage))
                    res_usage[ResUsageType.CUMULATED_COST].append('{"name":"%s", "dateUTC":"%s","usage":%s}' % (self.dbname, datetime_utc_json, cumulated_cost))
                    sum_res_usage[ResUsageType.CPU] += current_cpu_usage
                    sum_res_usage[ResUsageType.MEMORY] += current_mem_usage
                    sum_res_usage[ResUsageType.BILLING_HOURLY_RATE] += current_billing_hourly_rate
                except:
                    pass

        if sum_res_usage[ResUsageType.CPU] > 0.0 and sum_res_usage[ResUsageType.MEMORY] > 0.0:
            #TODO Need to refactoring Prometheus exports
            PROMETHEUS_HOURLY_USAGE_EXPORTER.labels(self.dbname, ResUsageType.CPU.name).set(current_cpu_usage)
            PROMETHEUS_HOURLY_USAGE_EXPORTER.labels(self.dbname, ResUsageType.MEMORY.name).set(current_mem_usage)
            PROMETHEUS_HOURLY_USAGE_EXPORTER.labels(self.dbname, ResUsageType.BILLING_HOURLY_RATE.name).set(current_billing_hourly_rate)
            return (','.join(res_usage[ResUsageType.CPU]), ','.join(res_usage[ResUsageType.MEMORY]))
        else:
            if step_in is None:
                return self.dump_trend_data(period, step_in=RrdPeriod.PERIOD_5_MINS_SEC)
        
        # otherwise return empty analytics
        return '', ''


    def dump_histogram_data(self, period, step_in=None):
        # process optional arguments
        if step_in is not None:
            step = int(step_in)
        else: 
            step = int(RrdPeriod.PERIOD_1_HOUR_SEC)

        # actual processing
        end_ts_in = int(int(calendar.timegm(time.gmtime()) * step) / step)
        start_ts_in  = int(end_ts_in - int(period))
        result = rrdtool.fetch(self.rrd_location, 'AVERAGE', '-r', str(step), '-s', str(start_ts_in), '-e', str(end_ts_in))
        periodic_cpu_usage = collections.defaultdict(lambda:0.0)
        periodic_mem_usage = collections.defaultdict(lambda:0.0)
        periodic_raw_cost = collections.defaultdict(lambda:0.0)
        start_ts_out, _, step = result[0]
        current_ts = start_ts_out

        for _, cdp in enumerate( result[2] ):
            current_ts += step
            if len(cdp) == 4:
                try:
                    datetime_utc = time.gmtime(current_ts)
                    date_group = self.get_date_group(datetime_utc, period)
                    current_cpu_usage = round(100*float(cdp[0]))/100
                    current_mem_usage = round(100*float(cdp[1]))/100
                    current_billing_hourly_rate = round(100*float(cdp[2]))/100
                    periodic_cpu_usage[date_group] += current_cpu_usage
                    periodic_mem_usage[date_group] += current_mem_usage
                    periodic_raw_cost[date_group] += current_billing_hourly_rate
                except:
                    pass

        if step_in is None and periodic_cpu_usage == 0.0 and periodic_cpu_usage == 0.0:
            return self.dump_histogram_data(period, RrdPeriod.PERIOD_5_MINS_SEC)
        return periodic_cpu_usage, periodic_mem_usage, periodic_raw_cost

    @staticmethod
    def dump_trend_analytics(dbfiles):
        res_usage = collections.defaultdict(list)
        for _, dbfile in enumerate(dbfiles):
            dbfile_splitted=os.path.splitext(dbfile)
            if len(dbfile_splitted) == 2 and dbfile_splitted[1] == '.rrd':
                ns = dbfile_splitted[0]
                rrd = Rrd(db_files_location=KOA_CONFIG.db_location, dbname=ns)
                ns_trend_usage = rrd.dump_trend_data(period=RrdPeriod.PERIOD_7_DAYS_SEC)
                for res_type in range(2):
                    if ns_trend_usage[res_type]:
                        res_usage[res_type].append(ns_trend_usage[res_type])

        with open(str('%s/cpu_usage_trends.json' % KOA_CONFIG.frontend_data_location), 'w') as fd:
            fd.write('['+','.join(res_usage[0])+']')
        with open(str('%s/memory_usage_trends.json' % KOA_CONFIG.frontend_data_location), 'w') as fd:
            fd.write('['+','.join(res_usage[1])+']')

    @staticmethod
    def dump_histogram_analytics(dbfiles, period):    
        global_usage = collections.defaultdict(list)
        
        for _, dbfile in enumerate(dbfiles):
            dbfile_splitted=os.path.splitext(dbfile)
            if len(dbfile_splitted) == 2 and dbfile_splitted[1] == '.rrd':
                ns = dbfile_splitted[0]
                rrd = Rrd(db_files_location=KOA_CONFIG.db_location, dbname=ns)
                ns_periodic_usage = rrd.dump_histogram_data(period=period)   
                # ns_periodic_usage[2] is raw billing cost    
                for res_type in range(3):
                    for date_group, value in ns_periodic_usage[res_type].items():
                        if value > 0.0:
                            PROMETHEUS_PERIODIC_USAGE_EXPORTER.labels(RrdPeriod(period).name, ns, ResUsageType(res_type).name, date_group).set(value)
                            global_usage[res_type].append('{"stack":"%s","usage":%f,"date":"%s"}' % (ns, value, date_group))

        with open(str('%s/cpu_usage_period_%d.json' % (KOA_CONFIG.frontend_data_location, period)), 'w') as fd:
            fd.write('['+','.join(global_usage[0])+']')
        with open(str('%s/memory_usage_period_%d.json' % (KOA_CONFIG.frontend_data_location, period)), 'w') as fd:
            fd.write('['+','.join(global_usage[1])+']')


def pull_k8s(api_context):
    data = None
    api_endpoint = '%s%s' % (KOA_CONFIG.k8s_api_endpoint, api_context)
    headers = {}
    if KOA_CONFIG.enable_debug:
        headers['Authorization'] = ('Bearer %s' % KOA_CONFIG.k8s_auth_token)
    try:
        http_req = requests.get(api_endpoint, verify=KOA_CONFIG.k8s_verify_ssl, headers=headers)
        if http_req.status_code == 200:
            data = http_req.text
        else:
            KOA_LOGGER.error("call to %s returned error (%s)" % (api_endpoint, http_req.text))
    except requests.exceptions.RequestException as ex:
        KOA_LOGGER.error("HTTP exception requesting %s (%s)" % (api_endpoint, ex))
    except:
        KOA_LOGGER.error("unknown exception requesting %s" % api_endpoint)

    return data


def create_metrics_puller():
    while True:
        k8s_usage = K8sUsage()
        KOA_LOGGER.debug('{puller] collecting new metrics')
        k8s_usage.extract_namespaces_and_initialize_usage( pull_k8s('/api/v1/namespaces') )
        k8s_usage.extract_nodes( pull_k8s('/api/v1/nodes') )
        k8s_usage.extract_node_metrics( pull_k8s('/apis/metrics.k8s.io/v1beta1/nodes') )
        k8s_usage.extract_pods( pull_k8s('/api/v1/pods') )
        k8s_usage.extract_pod_metrics( pull_k8s('/apis/metrics.k8s.io/v1beta1/pods') )
        k8s_usage.consolidate_ns_usage()
        k8s_usage.dump_nodes()
        if k8s_usage.cpuCapacity > 0.0 and k8s_usage.memCapacity > 0.0:
            now_epoch = calendar.timegm(time.gmtime())
            rrd = Rrd(db_files_location=KOA_CONFIG.db_location, dbname='non-allocatable')
            cpu_usage = compute_usage_percent_ratio(k8s_usage.cpuCapacity - k8s_usage.cpuAllocatable, k8s_usage.cpuCapacity)
            mem_usage = compute_usage_percent_ratio(k8s_usage.memCapacity - k8s_usage.memAllocatable, k8s_usage.memCapacity)
            rrd.add_sample(timestamp_epoch=now_epoch, cpu_usage=cpu_usage, mem_usage=mem_usage, billing_hourly_rate=KOA_CONFIG.billing_hourly_rate)
            for ns, nsUsage in k8s_usage.nsResUsage.items():
                rrd = Rrd(db_files_location=KOA_CONFIG.db_location, dbname=ns)
                cpu_usage = compute_usage_percent_ratio(nsUsage.cpuUsage, k8s_usage.cpuCapacity)
                mem_usage = compute_usage_percent_ratio(nsUsage.memUsage, k8s_usage.memCapacity)
                rrd.add_sample(timestamp_epoch=now_epoch, cpu_usage=cpu_usage, mem_usage=mem_usage, billing_hourly_rate=KOA_CONFIG.billing_hourly_rate)
        time.sleep(int(KOA_CONFIG.polling_interval_sec))


def dump_analytics():
    export_interval = round(1.5 * KOA_CONFIG.polling_interval_sec)
    while True:
        dbfiles = []
        for (_, _, filenames) in os.walk(KOA_CONFIG.db_location):
            dbfiles.extend(filenames)
            break
        Rrd.dump_trend_analytics(dbfiles)
        Rrd.dump_histogram_analytics(dbfiles=dbfiles, period=RrdPeriod.PERIOD_14_DAYS_SEC)
        Rrd.dump_histogram_analytics(dbfiles=dbfiles, period=RrdPeriod.PERIOD_YEAR_SEC)
        time.sleep(export_interval)


parser = argparse.ArgumentParser(description='Kubernetes Opex Analytics Backend.')
parser.add_argument('-v', '--version', action='version', version='%(prog)s '+KOA_CONFIG.version)
args = parser.parse_args()

create_directory_if_not_exists(KOA_CONFIG.frontend_data_location)

th_puller = threading.Thread(target=create_metrics_puller)
th_exporter = threading.Thread(target=dump_analytics)
th_puller.start()
th_exporter.start()

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5483)
