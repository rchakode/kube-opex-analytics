import flask
import requests
import threading
import time
import os


PULLING_INTERVAL_SEC = 60 # in seconds

data_file = './static/resources.json'
log_file = './static/puller.log'
k8s_api_endpoint = os.getenv('K8S_API_ENDPOINT', 'http://127.0.0.1:8001')

app = flask.Flask(__name__, static_url_path='/static')

@app.route('/js/<path:path>')
def send_js(path):
    return flask.send_from_directory('js', path)

@app.route('/css/<path:path>')
def send_css(path):
    return flask.send_from_directory('css', path)

@app.route('/')
def render():
    return flask.render_template('index.html', data_file=data_file)

def pull_k8s(api_context):
    output = ''
    k8s_proxy_req = requests.get('%s%s' % (k8s_api_endpoint, api_context))
    if k8s_proxy_req.status_code == 200:
        output += k8s_proxy_req.text
    else:
        output += '{}'
        with open(log_file, 'a') as the_file:
            the_file.write(time.strftime("%Y-%M-%d %H:%M:%S") + '[ERROR] '+k8s_proxy_req.text)
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
        with open(data_file, 'w') as the_file:
            the_file.write(output)

        time.sleep(PULLING_INTERVAL_SEC)


if __name__ == '__main__':

    th = threading.Thread(target=k8s_puller)
    th.start()

    app.run()
