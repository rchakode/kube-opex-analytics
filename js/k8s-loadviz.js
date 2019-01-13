/*
# File: k8s-loadviz.js                                                             #
#                                                                                 #
# Copyright © 2014 by Rodrigue Chakode <rodrigue.chakode at gmail dot com>        #
#                                                                                 #
# This file is part of k8s-loadviz, authored by Rodrigue Chakode as part of        #
# RealOpInsight Labs (http://realopinsight.com).                                  #
#                                                                                 #
# k8s-loadviz is licensed under the Apache License, Version 2.0 (the "License");   #
# you may not use this file except in compliance with the License. You may obtain #
# a copy of the License at: http://www.apache.org/licenses/LICENSE-2.0            #
#                                                                                 #
# Unless required by applicable law or agreed to in writing, software distributed #
# under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR     #
# CONDITIONS OF ANY KIND, either express or implied. See the License for the      #
# specific language governing permissions and limitations under the License.      #
*/


function generateTooltip(node)
{
    let tooltip = 'Host: '+node.name;
    tooltip += '\nID: '+node.id;
    tooltip += '\nState: '+ node.state;
    tooltip += '\nCPU: ' + node.cpuCapacity;
    tooltip += '\n  Allocatable: ' + Math.ceil((10000*node.cpuAllocatable)/node.cpuCapacity)/100 + '%';
    tooltip += '\n  Usage: ' + node.cpuLoad + '%';
    tooltip += '\nMemory: ' + node.memCapacity;
    tooltip += '\n  Allocatable: ' + Math.ceil((10000*node.memAllocatable)/node.memCapacity)/100 + '%';
    tooltip += '\n  Usage: ' + node.memLoad+ '%';
    tooltip += '\nPods: ' + node.pods.length;
    tooltip += '\nContainer Runtime: ' + node.containerRuntime;
    return tooltip;
}

function createPopupEntry(nodeInfo)
{
    var popupHtmlCode = '<div class="modal fade" id="'+nodeInfo.id+'" tabindex="-1" role="dialog" aria-labelledby="'+nodeInfo.name+'" aria-hidden="true">'
        +'<div class="modal-dialog">'
        +'<div class="modal-content">'
        +'<div class="modal-header">'
        +'<button type="button" class="close" data-dismiss="modal" aria-hidden="true">&times;</button>'
        +'<h4 class="modal-title" id="'+nodeInfo.name+'">'+nodeInfo.name+'</h4>'
        +'</div>'
        +'<div class="modal-body">'
        +''+generateTooltip(nodeInfo).replace(/\n/g, "<br />")+''
        +'</div>'
        +'<div class="modal-footer">'
        +'<button type="button" class="btn btn-default" data-dismiss="modal">Close</button>'
        +'</div>'
        +'</div>'
        +'</div>'
        +'</div>';

    return popupHtmlCode;
}

function decodeMemoryCapacity(input)
{
    let dataLength = input.length
    let memUnit = ''
    let capacity = ''
    if (input.endsWith("i")) {
        memUnit = input.substring(dataLength-2, dataLength)
        capacity = input.substring(0, dataLength-2)
    } else {
        capacity = input
    }
    let mem = BigInt(0)
    switch (memUnit){
        case '':
            mem = parseInt(input)
            break;
        case 'Ki':
            mem = 1e3 * parseInt(capacity)
            break;
        case 'Mi':
            mem = 1e6 * parseInt(capacity)
            break;
        case 'Gi':
            mem = 1e9 * parseInt(capacity)
            break;
        case 'Ti':
            mem = 1e12 * parseInt(capacity)
            break;
        case 'Pi':
            mem = 1e15 * parseInt(capacity)
            break;
        case 'Ei':
            mem = 1e18 * parseInt(capacity)
            break;
    }

    return mem
}


function decodeCpuUsage(input)
{
    let dataLength = input.length
    let cpuUnit = input.substring(dataLength-1, dataLength)
    let capacity = input.substring(0, dataLength-1)
    let cpu = BigInt(0)
    switch (cpuUnit){
        case 'n':
            cpu = 1e-9 * parseFloat(capacity)
            break;
        case 'm':
            cpu = 1e-3 * parseFloat(capacity)
            break;
        default:
            cpu = parseFloat(input)
            break;
    }
    return cpu
}


// compute linear gradient from #6699cc (green => 0% load)' to #f56 (red => 100% load)
function computeLoadGradientColor(load)
{
    const white = [255, 255, 255];
    const blue = [153, 204, 255];
    const red = [255, 85, 102];
    const w1 = load / 100;
    const w2 = 1 - w1;

    if (load < 10.0) {
        return [
            Math.round(blue[0] * w1 + white[0] * w2),
            Math.round(blue[1] * w1 + white[2] * w2),
            Math.round(blue[2] * w1 + white[2] * w2)
        ];
    }
    return [
        Math.round(red[0] * w1 + white[0] * w2),
        Math.round(red[1] * w1 + white[2] * w2),
        Math.round(red[2] * w1 + white[2] * w2)
    ];
}

function K8sLoad(data, loadType)
{
    let mainClass = this
    this.nodes = new Map();
    this.pods = new Map();
    this.popupContent = '';
    this.nodeHtmlList = '';
    this.maxCpu = 1;

    if (data.length != 4 || ! 'items' in data[0]) {
        console.log(data)
        $("#error-message").show();
        $("#error-message").html('invalid data, see console for details');
    } else {
        $("#error-message").hide();
    }
    // parse nodes info
    $.each(data[0].items,
        function(index, nodeApiData) {
            let node = new Object();
            node.name = nodeApiData.metadata.name;
            node.id = nodeApiData.metadata.uid;
            node.cpuCapacity = parseInt(nodeApiData.status.capacity.cpu);
            node.cpuAllocatable = parseInt(nodeApiData.status.allocatable.cpu);
            node.memCapacity = decodeMemoryCapacity(nodeApiData.status.capacity.memory);
            node.memAllocatable = decodeMemoryCapacity(nodeApiData.status.allocatable.memory);
            node.containerRuntime = nodeApiData.status.nodeInfo.containerRuntimeVersion;
            mainClass.maxCpu = Math.max(mainClass.maxCpu, node.cpuCapacity)
            node.pods = [];
            //TODO node.runningPods = parseInt( $(this).find('RUNNING_VMS').text() );

            for (let i = 0; i < nodeApiData.status.conditions.length; ++i) {
                let cond = nodeApiData.status.conditions[i]
                node.message = cond.message
                if (cond.type === "Ready" && cond.status === "True") {
                    node.state = "Ready"
                    break
                }
                if (cond.type === "KernelDeadlock" && cond.status === "True") {
                    node.state = "KernelDeadlock"
                    break
                }
                if (cond.type === "NetworkUnavailable" && cond.status === "True") {
                    node.state = "NetworkUnavailable"
                    break
                }
                if (cond.type === "OutOfDisk" && cond.status === "True") {
                    node.state = "OutOfDisk"
                    break
                }
                if (cond.type === "MemoryPressure" && cond.status === "True") {
                    node.state = "MemoryPressure"
                    break
                }
                if (cond.type === "DiskPressure" && cond.status === "True") {
                    node.state = "DiskPressure"
                    break
                }
            }
            mainClass.nodeHtmlList += '<li><a href="#" data-toggle="modal" data-target="#'+node.id+'">'+ node.name+'</a></li>';
            mainClass.nodes.set(node.name, node)
        }
    );

    less = {
        env: "development",
        async: false,
        fileAsync: false,
        poll: 1000,
        functions: {},
        dumpLineNumbers: "comments",
        relativeUrls: false,
        rootpath: ":/a.com/"
    };

    // parse nodes' metrics
    $.each(data[1].items,
        function(index, nodeMetric) {
            let node = mainClass.nodes.get(nodeMetric.metadata.name);
            node.cpuUsage = decodeCpuUsage(nodeMetric.usage.cpu);
            node.memUsage = decodeMemoryCapacity(nodeMetric.usage.memory)
            node.cpuLoad = Math.round(1e4 * node.cpuUsage / node.cpuCapacity) / 100;
            node.memLoad = Math.round(1e4 * node.memUsage / node.memCapacity) / 100;
            mainClass.popupContent += createPopupEntry(node);
            switch (loadType) {
                case 'Memory Usage':
                    node.color = 'rgb('+computeLoadGradientColor(node.memLoad)+')';
                    break;
                case 'CPU Usage':
                default:
                    node.color = 'rgb('+computeLoadGradientColor(node.cpuLoad)+')';
                    break;
            }
            mainClass.nodes.set(nodeMetric.metadata.name, node)
        }
    );


    // parse pods' info
    $.each(data[2].items,
        function(index, podApiData) {
            let pod = new Object();
            pod.name = podApiData.metadata.name;
            pod.id = podApiData.metadata.uid;
            pod.nodeName = podApiData.spec.nodeName;
            pod.phase = podApiData.status.phase;
            pod.state = "PodNotScheduled";
            for (let i = 0; i < podApiData.status.conditions.length; ++i) {
                let cond = podApiData.status.conditions[i]
                if (cond.type === "Ready" && cond.status === "True") {
                    pod.state = "Ready";
                    break;
                }
                if (cond.type === "ContainersReady" && cond.status === "True") {
                    pod.state = "ContainersReady";
                    break;
                }
                if (cond.type === "PodScheduled" && cond.status === "True") {
                    pod.state = "PodScheduled";
                    break;
                }
                if (cond.type === "Initialized" && cond.status === "True") {
                    pod.state = "Initialized";
                    break;
                }
            }
            mainClass.pods.set(pod.name, pod)
        }
    );

    // parse pods' metrics
    $.each(data[3].items,
        function(index, podMetric) {
            let pod = mainClass.pods.get(podMetric.metadata.name)

            pod.cpuUsage = 0
            pod.memUsage = 0
            for (let i = 0; i < podMetric.containers.length; ++i) {
                pod.cpuUsage += decodeCpuUsage(podMetric.containers[i].usage.cpu);
                pod.memUsage += decodeMemoryCapacity(podMetric.containers[i].usage.memory);
            }

            //FIXME compute pod usage color
            // switch (loadType) {
            //     case 'Memory Usage':
            //         pod.color = computeLoadColor(pod.memLoad)
            //         break;
            //     case 'CPU Usage':
            //     default:
            //         pod.color = computeLoadColor(pod.cpuLoad)
            //         break;
            // }
            mainClass.pods.set(podMetric.metadata.name, pod)
        }
    );


    // set pods' load for each node
    for (let [pName, pod] of mainClass.pods) {
        if (pod.phase != "Pending") {
            let node = mainClass.nodes.get(pod.nodeName);
            node.pods.push(pod)
            mainClass.nodes.set(node.name, node);
        }
    }

    return this;
}

function refreshLoadMap(data, loadType)
{
    k8sLoad = K8sLoad(data, loadType)

    $( "#load-map-container" ).empty();
    $( "#host-list-container" ).html('<ul class="list-unstyled">');

    const DEFAULT_NODE_ROW_COUNT = Math.ceil( Math.sqrt(k8sLoad.maxCpu) );
    const DEFAULT_CELL_SHAPE = {side: 50, margin: 2, node_margin: 7.5};
    const DEFAULT_NODE_SIDE = DEFAULT_NODE_ROW_COUNT * DEFAULT_CELL_SHAPE.side + (DEFAULT_NODE_ROW_COUNT - 1) * DEFAULT_CELL_SHAPE.margin;
    const DRAWING_AREA_SIZE = {width: 750, height: "100%"};

    let raphael = new Raphael("load-map-container", DRAWING_AREA_SIZE.width, DRAWING_AREA_SIZE.height);
    let drawingCursor = {x: DEFAULT_CELL_SHAPE.node_margin, y : DEFAULT_CELL_SHAPE.node_margin};
    for (let [name, node] of k8sLoad.nodes) {
        if (drawingCursor.x + DEFAULT_NODE_SIDE > DRAWING_AREA_SIZE.width) {
            drawingCursor.y += DEFAULT_NODE_SIDE + 2 * DEFAULT_CELL_SHAPE.node_margin;
            drawingCursor.x = DEFAULT_CELL_SHAPE.node_margin;
        }

        // draw the node core per core
        node.shape = raphael.set();
        // draw node bounding shape
        raphael.rect(drawingCursor.x, drawingCursor.y, DEFAULT_NODE_SIDE, DEFAULT_NODE_SIDE).attr({fill: '#E6E6E6', 'stroke-width': 0.5});

        // draw each individual cores
        for (let cpuIndex=0; cpuIndex < node.cpuCapacity; ++cpuIndex) {
            let cpuShape = raphael.rect(
                drawingCursor.x + Math.floor(cpuIndex / DEFAULT_NODE_ROW_COUNT) * (DEFAULT_CELL_SHAPE.side + DEFAULT_CELL_SHAPE.margin),
                drawingCursor.y + (cpuIndex % DEFAULT_NODE_ROW_COUNT) * (DEFAULT_CELL_SHAPE.side + DEFAULT_CELL_SHAPE.margin),
                DEFAULT_CELL_SHAPE.side,
                DEFAULT_CELL_SHAPE.side);
            cpuShape.attr({fill: node.color, 'stroke-width': 0.5});
            cpuShape.attr({title: generateTooltip(node)});
            node.shape.push(cpuShape);
        }
        k8sLoad.nodes.set(name, node);
        drawingCursor.x += DEFAULT_NODE_SIDE + 2 * DEFAULT_CELL_SHAPE.node_margin;
    }

    // set dynamic HTML content
    $("#load-map-container").height(drawingCursor.y + DEFAULT_NODE_SIDE + DEFAULT_CELL_SHAPE.node_margin);
    $("#host-list-container").html('<ul>'+k8sLoad.nodeHtmlList+"</ul>");
    $("#popup-container").html(k8sLoad.popupContent);
}

function triggerRefreshLoadMap(dataFile, loadType)
{
    $.ajax({
        type: "GET",
        url: dataFile,
        dataType: "json",
        success: function(data) {
            refreshLoadMap(data, currentLoadType);
            $("#title-container").html(currentLoadType);
            currentLoadType = loadType;
        },
        error: function (xhr, ajaxOptions, thrownError) {
            $("#error-message").html('error ' + xhr.status + ' (' + thrownError +')');
        }
    });
}

(function($)
{
    $(document).ready(function()
    {
        $.ajaxSetup(
            {
                cache: false,
                beforeSend: function() {
                    $('#load-map-container').hide();
                    $('#loading-container').show();
                },
                complete: function() {
                    $('#loading-container').hide();
                    $('#load-map-container').show();
                },
                success: function() {
                    $('#loading-container').hide();
                    $('#load-map-container').show();
                }
            });
        // let $container = $("#load-map-container");
        currentLoadType = 'CPU Usage';
        triggerRefreshLoadMap(dataFile)
        setInterval(function() {triggerRefreshLoadMap(dataFile);}, 5000000); // update every 5 mins
    });
})(jQuery);
