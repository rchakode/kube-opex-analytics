FROM ubuntu:18.04

ARG RUNTIME_USER="koa"
ARG APP_HOME="/koa"

ADD css $APP_HOME/css
ADD js $APP_HOME/js
ADD static/images $APP_HOME/static/images

COPY requirements.txt \
    entrypoint.sh \
    backend.py \
    index.html \
    LICENSE \
    NOTICE \
    $APP_HOME/

WORKDIR $APP_HOME

RUN apt update && \
    apt install -y python3 librrd-dev libpython3-dev python3-pip && \
    rm -rf /var/lib/apt/lists/* && \
    pip3 install -r requirements.txt && \
    useradd $RUNTIME_USER && \
    usermod $RUNTIME_USER -d $APP_HOME && \
    chown -R $RUNTIME_USER:$RUNTIME_USER $APP_HOME && \
    mkdir /data && \
    chown -R $RUNTIME_USER:$RUNTIME_USER /data

# USER $RUNTIME_USER

ENTRYPOINT ["sh", "./entrypoint.sh"]
