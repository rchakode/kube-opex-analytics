import flask
import requests
import threading
import time
import os

RESOURCE_FILE = './static/resources.json'
LOG_FILE = './static/puller.log'
K8S_API_ENDPOINT = os.getenv('K8S_API_ENDPOINT', 'http://127.0.0.1:8001')
PULLING_INTERVAL_SEC = os.getenv('PULLING_INTERVAL_SEC', '30')

app = flask.Flask(__name__, static_url_path='/static')

@app.route('/favicon.ico')
def favicon():
    return send_from_directory(os.path.join(app.root_path, 'static'), 'favicon.ico', mimetype='image/vnd.microsoft.icon')

@app.route('/js/<path:path>')
def send_js(path):
    return flask.send_from_directory('js', path)

@app.route('/css/<path:path>')
def send_css(path):
    return flask.send_from_directory('css', path)

@app.route('/')
def render():
    return flask.render_template('index.html', data_file=RESOURCE_FILE)

def pull_k8s(api_context):
    output = ''
    apiEndpoint = '%s%s' % (K8S_API_ENDPOINT, api_context)
    k8s_proxy_req = requests.get(apiEndpoint)
    if k8s_proxy_req.status_code == 200:
        output += k8s_proxy_req.text
    else:
        output += '{}'
        with open(LOG_FILE, 'a') as the_file:
            the_file.write(time.strftime("%Y-%M-%d %H:%M:%S") + ' [ERROR] %s returned error (%s)'  % (apiEndpoint, k8s_proxy_req.text))
    return output

def k8s_puller():
    while True:

        # output initialization
        output = '[' + pull_k8s('/api/v1/nodes') + \
                 ',' + pull_k8s('/apis/metrics.k8s.io/v1beta1/nodes') + \
                 ',' + pull_k8s('/api/v1/pods') + \
                 ',' + pull_k8s('/apis/metrics.k8s.io/v1beta1/pods')+ \
                 ']'
        # write output
        with open(RESOURCE_FILE, 'w') as the_file:
            the_file.write(output)

        time.sleep(int(PULLING_INTERVAL_SEC))


if __name__ == '__main__':

    th = threading.Thread(target=k8s_puller)
    th.start()

    app.run()
