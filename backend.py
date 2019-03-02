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
import collections
import enum

# set logger settings
logging.basicConfig(format='%(asctime)s %(message)s', datefmt='%m/%d/%Y %I:%M:%S %p')

# load dynamic configuration settings
KOA_K8S_API_ENDPOINT = os.getenv('KOA_K8S_API_ENDPOINT', 'http://127.0.0.1:8001')
KOA_DEFAULT_DB_LOCATION = ('%s/.kube-opex-analytics/db') % os.getenv('HOME', '/tmp')
KOA_DB_LOCATION = os.getenv('KOA_DB_LOCATION', KOA_DEFAULT_DB_LOCATION)
KOA_POLLING_INTERVAL_SEC = int(os.getenv('KOA_POLLING_INTERVAL_SEC', '300'))
KOA_BILLING_CURRENCY_SYMBOL = os.getenv('KOA_BILLING_CURRENCY_SYMBOL', '$')

KOA_BILING_HOURLY_RATE=0
try:
    KOA_BILING_HOURLY_RATE = float(os.getenv('KOA_BILING_HOURLY_RATE'))
except:
    KOA_BILING_HOURLY_RATE = 0
  
# fixed configuration settings
STATIC_CONTENT_LOCATION = '/static'
FRONTEND_DATA_LOCATION = '.%s/data' % (STATIC_CONTENT_LOCATION)

app = flask.Flask(__name__, static_url_path=STATIC_CONTENT_LOCATION, template_folder='.')

def print_error(*args, **kwargs):
    print(*args, file=sys.stderr, **kwargs)

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
        with open(str('%s/nodes.json' % FRONTEND_DATA_LOCATION), 'w') as fd:
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
    PERIOD_14_DAYS_SEC = 1209600
    PERIOD_YEAR_SEC = 31968000

class ResUsageType(enum.IntEnum):
    CPU = 0
    MEMORY = 1  
    CONSOLIDATED = 2   
    CUMULATED_COST = 3   
    
class Rrd:
    def __init__(self, db_files_location=None, dbname=None):
        create_directory_if_not_exists(db_files_location)
        self.dbname = dbname
        self.rrd_location = str('%s/%s.rrd' % (KOA_DB_LOCATION, dbname))
        self.create_rrd_file_if_not_exists()

    @staticmethod
    def get_period_group_key(timeUTC, period):
        if period == RrdPeriod.PERIOD_YEAR_SEC:
            return time.strftime('%b %Y', timeUTC)
        return time.strftime('%Y-%m-%d', timeUTC)

    def create_rrd_file_if_not_exists(self):
        if not os.path.exists(self.rrd_location):
            xfs = 2 * KOA_POLLING_INTERVAL_SEC
            rrdtool.create(self.rrd_location,
                "--step", str(KOA_POLLING_INTERVAL_SEC),
                "--start", "0",
                str('DS:cpu_usage:GAUGE:%d:U:U' % xfs),
                str('DS:mem_usage:GAUGE:%d:U:U' % xfs),
                str('DS:consolidated_usage:GAUGE:%d:U:U' % xfs),
                str('DS:estimated_cost:GAUGE:%d:U:U' % xfs),
                "RRA:AVERAGE:0.5:1:4032",
                "RRA:AVERAGE:0.5:12:8880")
    
    def add_value(self, probe_ts, cpu_usage, mem_usage, consolidated_usage, estimated_cost):
        rrdtool.update(self.rrd_location, '%s:%s:%s:%s:%s'%(
            probe_ts, 
            round(cpu_usage, 1), 
            round(mem_usage, 1), 
            round(consolidated_usage, 1), 
            round(estimated_cost, 1)))

    def dump_trends_data(self, period, step_in):
        end_ts_in = int(int(calendar.timegm(time.gmtime()) * step_in) / step_in)
        start_ts_in  = int(end_ts_in - int(period))
        result = rrdtool.fetch(self.rrd_location, 'AVERAGE', '-r', str(step_in), '-s', str(start_ts_in), '-e', str(end_ts_in)) 
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
                    current_cpu_usage = float(cdp[0])
                    current_mem_usage = float(cdp[1])
                    current_consolidated_usage = float(cdp[2])
                    cumulated_cost += float(cdp[3])
                    datetime_utc_json = time.strftime('%Y-%m-%dT%H:%M:%SZ', datetime_utc)
                    res_usage[ResUsageType.CPU].append('{"name":"%s","dateUTC":"%s","usage":%f}' % (self.dbname, datetime_utc_json, current_cpu_usage))
                    res_usage[ResUsageType.MEMORY].append('{"name":"%s","dateUTC":"%s","usage":%f}' % (self.dbname, datetime_utc_json, current_mem_usage)) 
                    res_usage[ResUsageType.CONSOLIDATED].append('{"name":"%s","dateUTC":"%s","usage":%s}' % (self.dbname, datetime_utc_json, current_consolidated_usage)) 
                    res_usage[ResUsageType.CUMULATED_COST].append('{"name":"%s", "dateUTC":"%s","usage":%s}' % (self.dbname, datetime_utc_json, cumulated_cost))
                    sum_res_usage[ResUsageType.CPU] += current_cpu_usage
                    sum_res_usage[ResUsageType.MEMORY] += current_mem_usage
                    sum_res_usage[ResUsageType.CONSOLIDATED] += current_consolidated_usage
                    sum_res_usage[ResUsageType.CUMULATED_COST] += cumulated_cost
                except:
                    pass

        if sum_res_usage[ResUsageType.CPU] > 0.0 and sum_res_usage[ResUsageType.CPU] > 0.0:
            return (','.join(res_usage[ResUsageType.CPU]),
            ','.join(res_usage[ResUsageType.MEMORY]), 
            ','.join(res_usage[ResUsageType.CONSOLIDATED]), 
            ','.join(res_usage[ResUsageType.CUMULATED_COST]))            
        return '', '', '', ''


    def dump_histogram_data(self, period, step_in):
        end_ts_in = int(int(calendar.timegm(time.gmtime()) * step_in) / step_in)
        start_ts_in  = int(end_ts_in - int(period))
        result = rrdtool.fetch(self.rrd_location, 'AVERAGE', '-r', str(step_in), '-s', str(start_ts_in), '-e', str(end_ts_in))
        periodic_cpu_usage = collections.defaultdict(lambda:0.0)      
        periodic_mem_usage = collections.defaultdict(lambda:0.0)      
        periodic_consolidated_usage = collections.defaultdict(lambda:0.0)
        valid_rows = collections.defaultdict(lambda:0.0) 
        start_ts_out, _, step = result[0]
        current_ts = start_ts_out
        for _, cdp in enumerate( result[2] ):
            current_ts += step
            if len(cdp) == 4:
                try:
                    datetime_utc = time.gmtime(current_ts)
                    date_group = self.get_period_group_key(datetime_utc, period)
                    current_cpu_usage = float(cdp[0])
                    current_mem_usage = float(cdp[1])
                    current_consolidated_usage = float(cdp[2])
                    periodic_cpu_usage[date_group] += current_cpu_usage
                    periodic_mem_usage[date_group] += current_mem_usage
                    periodic_consolidated_usage[date_group] += current_consolidated_usage
                    valid_rows[date_group] += 1
                except:
                    pass
        return periodic_cpu_usage, periodic_mem_usage, periodic_consolidated_usage, valid_rows

    @staticmethod
    def dump_trend_analytics(dbfiles):       
        res_usage = collections.defaultdict(list)  
        for _, dbfile in enumerate(dbfiles):
            dbfile_splitted=os.path.splitext(dbfile)
            if len(dbfile_splitted) == 2 and dbfile_splitted[1] == '.rrd':
                rrd = Rrd(db_files_location=KOA_DB_LOCATION, dbname=dbfile_splitted[0])
                analytics = rrd.dump_trends_data(period=RrdPeriod.PERIOD_14_DAYS_SEC, step_in=3600)  
                for usage_type in range(4):
                    if analytics[usage_type]:
                        res_usage[usage_type].append(analytics[usage_type])
        with open(str('%s/cpu_usage_trends.json' % FRONTEND_DATA_LOCATION), 'w') as fd:
            fd.write('['+','.join(res_usage[0])+']')  
        with open(str('%s/memory_usage_trends.json' % FRONTEND_DATA_LOCATION), 'w') as fd:
            fd.write('['+','.join(res_usage[1])+']')                  
        with open(str('%s/consolidated_usage_trends.json' % FRONTEND_DATA_LOCATION), 'w') as fd:
            fd.write('['+','.join(res_usage[2])+']')   
        with open(str('%s/estimated_usage_trends.json' % FRONTEND_DATA_LOCATION), 'w') as fd:
            fd.write('['+','.join(res_usage[3])+']')  

    @staticmethod
    def dump_histogram_analytics(dbfiles, period):   
        res_usage = collections.defaultdict(list) 
        for _, dbfile in enumerate(dbfiles):
            dbfile_splitted=os.path.splitext(dbfile)
            if len(dbfile_splitted) == 2 and dbfile_splitted[1] == '.rrd':
                dbname = dbfile_splitted[0]
                rrd = Rrd(db_files_location=KOA_DB_LOCATION, dbname=dbname)
                analytics = rrd.dump_histogram_data(period=period, step_in=3600)
                valid_rows = analytics[3]
                for usage_type in range(3):  
                    for date_key, value in analytics[usage_type].items():
                        if value > 0.0:
                            res_usage[usage_type].append('{"stack":"%s","usage":%f,"date":"%s"}' % (dbname, value, date_key))    
                    
        # write exported data to files
        with open(str('%s/cpu_usage_period_%d.json' % (FRONTEND_DATA_LOCATION, period)), 'w') as fd:
            fd.write('['+','.join(res_usage[0])+']')  
        with open(str('%s/memory_usage_period_%d.json' % (FRONTEND_DATA_LOCATION, period)), 'w') as fd:
            fd.write('['+','.join(res_usage[1])+']')                  
        with open(str('%s/consolidated_usage_period_%d.json' % (FRONTEND_DATA_LOCATION, period)), 'w') as fd:
            fd.write('['+','.join(res_usage[2])+']')   



def pull_k8s(api_context):
    data = None
    api_endpoint = '%s%s' % (KOA_K8S_API_ENDPOINT, api_context)

    try:
        http_req = requests.get(api_endpoint)
        if http_req.status_code == 200:
            data = http_req.text
        else:
            print_error("%s [ERROR] '%s' returned error (%s)" % (time.strftime("%Y-%M-%d %H:%M:%S"), api_endpoint, http_req.text))
    except requests.exceptions.RequestException as ex:
        print_error("%s [ERROR] HTTP exception requesting '%s' (%s)" % (time.strftime("%Y-%M-%d %H:%M:%S"), api_endpoint, ex)) 
    except: 
        print_error("%s [ERROR] exception requesting '%s'" % (time.strftime("%Y-%M-%d %H:%M:%S"), api_endpoint))   

    return data


def create_metrics_puller():
    while True:
        k8s_usage = K8sUsage()
        k8s_usage.extract_namespaces_and_initialize_usage( pull_k8s('/api/v1/namespaces') )
        k8s_usage.extract_nodes( pull_k8s('/api/v1/nodes') )
        k8s_usage.extract_node_metrics( pull_k8s('/apis/metrics.k8s.io/v1beta1/nodes') )
        k8s_usage.extract_pods( pull_k8s('/api/v1/pods') )
        k8s_usage.extract_pod_metrics( pull_k8s('/apis/metrics.k8s.io/v1beta1/pods') )
        k8s_usage.consolidate_ns_usage()
        k8s_usage.dump_nodes()
        # calculate usage costs and update database
        if k8s_usage.cpuCapacity > 0.0 and k8s_usage.memCapacity > 0.0:
            probe_ts = calendar.timegm(time.gmtime())
            rrd = Rrd(db_files_location=KOA_DB_LOCATION, dbname='infra')
            cpu_usage = compute_usage_percent_ratio(k8s_usage.cpuCapacity - k8s_usage.cpuAllocatable, k8s_usage.cpuCapacity)
            mem_usage = compute_usage_percent_ratio(k8s_usage.memCapacity - k8s_usage.memAllocatable, k8s_usage.memCapacity)
            consolidated_usage = (cpu_usage + mem_usage) / 2.0
            estimated_cost =  consolidated_usage * (KOA_POLLING_INTERVAL_SEC * KOA_BILING_HOURLY_RATE) / 36
            rrd.add_value(probe_ts, cpu_usage=cpu_usage, mem_usage=mem_usage, consolidated_usage=consolidated_usage, estimated_cost=estimated_cost)
            for ns, nsUsage in k8s_usage.nsResUsage.items():
                rrd = Rrd(db_files_location=KOA_DB_LOCATION, dbname=ns)
                cpu_usage = compute_usage_percent_ratio(nsUsage.cpuUsage, k8s_usage.cpuCapacity)
                mem_usage = compute_usage_percent_ratio(nsUsage.memUsage, k8s_usage.memCapacity)
                consolidated_usage = (cpu_usage + mem_usage) / 2
                estimated_cost =  consolidated_usage * (KOA_POLLING_INTERVAL_SEC * KOA_BILING_HOURLY_RATE) / 36
                rrd.add_value(probe_ts, cpu_usage=cpu_usage, mem_usage=mem_usage, consolidated_usage=consolidated_usage, estimated_cost=estimated_cost)
        time.sleep(int(KOA_POLLING_INTERVAL_SEC))
       

def dump_analytics():
    export_interval = round(1.5 * KOA_POLLING_INTERVAL_SEC)
    while True:
        dbfiles = []
        for (_, _, filenames) in os.walk(KOA_DB_LOCATION):
            dbfiles.extend(filenames)
            break
        Rrd.dump_trend_analytics(dbfiles)
        Rrd.dump_histogram_analytics(dbfiles=dbfiles, period=RrdPeriod.PERIOD_14_DAYS_SEC)
        Rrd.dump_histogram_analytics(dbfiles=dbfiles, period=RrdPeriod.PERIOD_YEAR_SEC)
        time.sleep(export_interval)

if __name__ == '__main__':
    if KOA_BILING_HOURLY_RATE < 0.0:
        logging.critical('invalid KOA_BILING_HOURLY_RATE: %f' % KOA_BILING_HOURLY_RATE)
        sys.exit(1)

    # create dump directory if not exist
    create_directory_if_not_exists(FRONTEND_DATA_LOCATION)

    th_puller = threading.Thread(target=create_metrics_puller)
    th_exporter = threading.Thread(target=dump_analytics)
    th_puller.start()
    th_exporter.start()

    app.run(host='0.0.0.0', port=5483) # host=None, port=5483, debug=None
