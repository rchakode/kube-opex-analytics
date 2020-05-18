FROM ubuntu:18.04

ARG RUNTIME_USER="koa"
ARG RUNTIME_USER_UID=4583
ARG APP_HOME="/koa"

RUN apt update && \
    apt install -y python3 librrd-dev libpython3-dev python3-pip && \
    pip3 install --no-cache-dir flask flask_cors requests rrdtool prometheus_client waitress && \
    rm -rf /var/lib/apt/lists/* && \
    mkdir /data && \
    mkdir -p $APP_HOME/static && \
    useradd $RUNTIME_USER -u $RUNTIME_USER_UID && \
    usermod $RUNTIME_USER -d $APP_HOME

COPY css $APP_HOME/css
COPY js $APP_HOME/js
COPY static/images $APP_HOME/static/images
COPY entrypoint.sh \
    backend.py \
    index.html \
    LICENSE \
    NOTICE \
    $APP_HOME/

RUN chown -R $RUNTIME_USER:$RUNTIME_USER $APP_HOME && \
    chown -R $RUNTIME_USER:$RUNTIME_USER /data

WORKDIR $APP_HOME
VOLUME ["/data"]
ENTRYPOINT ["sh", "./entrypoint.sh"]
