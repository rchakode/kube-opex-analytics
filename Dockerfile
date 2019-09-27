FROM ubuntu:18.04

ARG RUNTIME_USER="koa"
ARG RUNTIME_USER_UID=830405
ARG APP_HOME="/koa"

COPY css $APP_HOME/css
COPY js $APP_HOME/js
COPY static/images $APP_HOME/static/images

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
    groupadd $RUNTIME_USER_GID && \
    useradd $RUNTIME_USER -u $RUNTIME_USER_UID -G $RUNTIME_USER_GID && \
    usermod $RUNTIME_USER -d $APP_HOME && \
    chown -R $RUNTIME_USER:$RUNTIME_USER $APP_HOME && \
    mkdir /data && \
    chown -R $RUNTIME_USER:$RUNTIME_USER /data

ENTRYPOINT ["sh", "./entrypoint.sh"]
