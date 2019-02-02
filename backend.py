""" 
# File: backend.py                                                                       #
#                                                                                        #
# Copyright © 2019 Rodrigue Chakode <rodrigue.chakode at gmail dot com>                  #
#                                                                                        #
# This file is part of kube-opex-analytics software authored by Rodrigue Chakode         #
# as part of RealOpInsight Labs (http://realopinsight.com).                              #
#                                                                                        #
# kube-opex-analytics is licensed under the Apache License, Version 2.0 (the "License"); #
# you may not use this file except in compliance with the License. You may obtain        #
# a copy of the License at: http://www.apache.org/licenses/LICENSE-2.0                   #
#                                                                                        #
# Unless required by applicable law or agreed to in writing, software distributed        #
# under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR            #
# CONDITIONS OF ANY KIND, either express or implied. See the License for the             #
# specific language governing permissions and limitations under the License.             # 
"""


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

# set logger settings
logging.basicConfig(format='%(asctime)s %(message)s', datefmt='%m/%d/%Y %I:%M:%S %p')
LOG_FILE = './static/puller.log'

# load dynamic configuration settings
K8S_API_ENDPOINT = os.getenv('K8S_API_ENDPOINT', 'http://127.0.0.1:8001')
DEFAULT_RRD_FILES_LOCATION = ('%s/.k8s-opex-analytics/db') % os.getenv('HOME', '/tmp')
RRD_FILES_LOCATION = os.getenv('RRD_FILES_LOCATION', DEFAULT_RRD_FILES_LOCATION)
POLLING_INTERVAL_SEC = int(os.getenv('POLLING_INTERVAL_SEC', '300'))
BILING_HOURLY_RATE = float(os.getenv('BILING_HOURLY_RATE'))
BILLING_CURRENCY_SYMBOL = os.getenv('BILLING_CURRENCY_SYMBOL', '$')

# fixed configuration settings
STATIC_CONTENT_LOCATION = '/static'
FRONTEND_DATA_LOCATION = '.%s/data' % (STATIC_CONTENT_LOCATION)

app = flask.Flask(__name__, static_url_path=STATIC_CONTENT_LOCATION, template_folder='.')

@app.route('/favicon.ico')
def favicon():
    return send_from_directory(os.path.join(app.root_path, 'static'), 'favicon.ico', mimetype='image/vnd.microsoft.icon')

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
    return flask.render_template('index.html', frontend_data_location=FRONTEND_DATA_LOCATION)


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
        self.sumPodCpu = 0.0
        self.sumPodMem = 0.0

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
            pod.name = item['metadata']['name']
            pod.namespace = item['metadata']['namespace']
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
            pod = self.pods.get(item['metadata']['name'], None)
            if pod is not None:
                pod.cpuUsage = 0.0
                pod.memUsage = 0.0
                for _, container in enumerate(item['containers']):
                    pod.cpuUsage += self.decode_cpu_capacity(container['usage']['cpu'])
                    pod.memUsage += self.decode_memory_capacity(container['usage']['memory'])  
                self.pods[pod.name] = pod


    def consolidate_ns_usage(self): 
        self.sumPodCpu = 0.0 
        self.sumPodMem = 0.0 
        for pod in self.pods.values():
            if hasattr(pod, 'cpuUsage') and hasattr(pod, 'memUsage'):
                self.sumPodCpu += pod.cpuUsage
                self.nsResUsage[pod.namespace].cpuUsage += pod.cpuUsage
                self.nsResUsage[pod.namespace].memUsage += pod.memUsage 
                self.sumPodMem += pod.memUsage
                self.nodes[pod.nodeName].podsRunning.append(pod)

def compute_usage_percent_ratio(value, total):
    return float(value) / total

def create_directory_if_not_exists(path):
    try:
        os.makedirs(path)
    except OSError as e:
        if e.errno != errno.EEXIST:
            raise

class Rrd:
    def __init__(self, db_files_location, dbname):
        create_directory_if_not_exists(db_files_location)
        self.dbname = dbname
        self.rrd_location = str('%s/%s.rrd' % (RRD_FILES_LOCATION, dbname))
        self.create_rrd_file_if_not_exists()

    def create_rrd_file_if_not_exists(self):
        if not os.path.exists(self.rrd_location):
            rrdtool.create(self.rrd_location,
                "--step", str(POLLING_INTERVAL_SEC),
                "--start", "0",
                str('DS:consolidated_usage:GAUGE:%d:U:U' % (2 * POLLING_INTERVAL_SEC)),
                str('DS:estimated_cost:GAUGE:%d:U:U' % (2 * POLLING_INTERVAL_SEC)),
                "RRA:AVERAGE:0.5:1:4032",
                "RRA:AVERAGE:0.5:12:8880")
    
    def add_value(self, probe_ts, usage, estimated_cost):
        rrdtool.update(self.rrd_location, '%s:%s:%s'%(str(probe_ts), str(usage), str(estimated_cost)))

    def dump_data(self, duration):
        # align with POLLING_INTERVAL_SEC
        end_ts_in = int(int(calendar.timegm(time.gmtime()) * POLLING_INTERVAL_SEC) / POLLING_INTERVAL_SEC)
        start_ts_in  = int(end_ts_in - int(duration))
        result = rrdtool.fetch(self.rrd_location, 'AVERAGE', '-r', str(POLLING_INTERVAL_SEC), '-s', str(start_ts_in), '-e', str(end_ts_in))
        start_ts_out, _, step = result[0]
        # ds = result[1]
        cpds = result[2]
        cpd_ts = start_ts_out + step
        consolidated_usage = []
        estmated_cost = []
        cumulated_cost = float(0.0)
        for _, cdp in enumerate(cpds):
            if len(cdp) == 2:
                try:
                    cumulated_cost += float(cdp[1])
                    dateUTC = time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime(cpd_ts))
                    consolidated_usage.append('{"name":"%s","dateUTC":"%s","usage":%s}' % (self.dbname, dateUTC, float(cdp[0]))) 
                    estmated_cost.append('{"name":"%s", "dateUTC":"%s","usage":%s}' % (self.dbname, dateUTC, cumulated_cost))
                except:
                    pass
            cpd_ts += step
        return ','.join(consolidated_usage), ','.join(estmated_cost)

def pull_k8s(api_context):
    data = None

    api_endpoint = '%s%s' % (K8S_API_ENDPOINT, api_context)
    try:
        http_req = requests.get(api_endpoint)
        if http_req.status_code == 200:
            data = http_req.text
        else:
            with open(LOG_FILE, 'a') as fd:
                fd.write("%s [ERROR] '%s' returned error (%s)" % (time.strftime("%Y-%M-%d %H:%M:%S"), api_endpoint, http_req.text))
    except requests.exceptions.RequestException as ex:
        with open(LOG_FILE, 'a') as fd:
            fd.write("%s [ERROR] HTTP exception requesting '%s' (%s)" % (time.strftime("%Y-%M-%d %H:%M:%S"), api_endpoint, ex)) 
    except: 
        with open(LOG_FILE, 'a') as fd:
            fd.write("%s [ERROR] exception requesting '%s'" % (time.strftime("%Y-%M-%d %H:%M:%S"), api_endpoint))   

    return data


def create_k8s_puller():
    while True:
        
        k8s_usage = K8sUsage()
        k8s_usage.extract_namespaces_and_initialize_usage(
            pull_k8s('/api/v1/namespaces'))
        k8s_usage.extract_nodes(
            pull_k8s('/api/v1/nodes'))
        k8s_usage.extract_node_metrics(
            pull_k8s('/apis/metrics.k8s.io/v1beta1/nodes'))
        k8s_usage.extract_pods(
            pull_k8s('/api/v1/pods'))
        k8s_usage.extract_pod_metrics(
            pull_k8s('/apis/metrics.k8s.io/v1beta1/pods'))

        k8s_usage.consolidate_ns_usage()

        # calculate usage costs and update database
        if k8s_usage.sumPodCpu > 0.0 and k8s_usage.sumPodMem > 0.0:
            probe_ts = calendar.timegm(time.gmtime())
            for ns, nsUsage in k8s_usage.nsResUsage.items():
                rrd = Rrd(db_files_location=RRD_FILES_LOCATION, dbname=ns)
                cpuUsagePercent = compute_usage_percent_ratio(nsUsage.cpuUsage, k8s_usage.sumPodCpu)
                memUsagePercent = compute_usage_percent_ratio(nsUsage.memUsage, k8s_usage.sumPodMem)
                usage_ratio = (cpuUsagePercent + memUsagePercent) / 2
                estimated_cost =  usage_ratio * (POLLING_INTERVAL_SEC * BILING_HOURLY_RATE) / 3600 
                rrd.add_value(probe_ts, usage=100*usage_ratio, estimated_cost=estimated_cost)

            # dump nodes
            with open(str('%s/nodes.json' % FRONTEND_DATA_LOCATION), 'w') as fd:
                fd.write(json.dumps(k8s_usage.nodes, cls=JSONMarshaller))  

            # dump consolidated resource usage
            usage = []         
            costs = []             
            for ns, nsUsage in k8s_usage.nsResUsage.items():
                rrd = Rrd(db_files_location=RRD_FILES_LOCATION, dbname=ns)
                exported_data = rrd.dump_data(duration=1209600)  
                create_directory_if_not_exists(FRONTEND_DATA_LOCATION)
                usage.append(exported_data[0])
                costs.append(exported_data[1])
            with open(str('%s/usage.json' % FRONTEND_DATA_LOCATION), 'w') as fd:
                fd.write('['+','.join(usage)+']')   
            with open(str('%s/estimated_costs.json' % FRONTEND_DATA_LOCATION), 'w') as fd:
                fd.write('['+','.join(costs)+']')                                             

        time.sleep(int(POLLING_INTERVAL_SEC))


if __name__ == '__main__':
    if BILING_HOURLY_RATE <= 0.0:
        logging.critical('invalid BILING_HOURLY_RATE: %f' % BILING_HOURLY_RATE)
        sys.exit(1)

    th = threading.Thread(target=create_k8s_puller)
    th.start()

    app.run() # host=None, port=5483, debug=None
