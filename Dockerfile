FROM ubuntu:18.04

ARG RUNTIME_USER="koa"
ARG APP_HOME="/koa"

RUN apt update && \
    apt install -y python3 librrd-dev libpython3-dev python3-pip && \
    rm -rf /var/lib/apt/lists/*


ADD css $APP_HOME/css
ADD js $APP_HOME/js
COPY requirements.txt \
    entrypoint.sh \
    backend.py \
    index.html \
    LICENSE \
    NOTICE \
    $APP_HOME/

RUN mkdir -p $APP_HOME/static/images
COPY kube-opex-analytics.png $APP_HOME/static/images/
COPY favicon.ico $APP_HOME/static/images/

WORKDIR $APP_HOME
    
RUN pip3 install -r requirements.txt

RUN useradd $RUNTIME_USER && \
    usermod $RUNTIME_USER -d $APP_HOME && \
    chown -R $RUNTIME_USER:$RUNTIME_USER $APP_HOME

# USER $RUNTIME_USER

ENTRYPOINT ["sh", "./entrypoint.sh"]
