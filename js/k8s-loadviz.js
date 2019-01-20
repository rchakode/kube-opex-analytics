/*
# File: k8s-loadviz.js                                                             #
#                                                                                 #
# Copyright © 2019 by Rodrigue Chakode <rodrigue.chakode at gmail dot com>        #
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


const DrawingAreaWidth = 0.745 * (window.innerWidth || document.documentElement.clientWidth || document.body.clientWidth);
const DrawingMemScaleUnit = 2e6;
const DrawingMinNodeSide = 256;
const DrawingMaxNodeSide = 512;

function generateTooltip(node)
{
    let tooltip = 'Host: '+node.name;
    tooltip += '\nID: '+node.id;
    tooltip += '\nContainer Runtime: ' + node.containerRuntime;
    tooltip += '\nState: '+ node.state;
    tooltip += '\nCPU: ' + node.cpuCapacity;
    tooltip += '\n  Allocatable: ' + computeLoad(node.cpuAllocatable, node.cpuCapacity) + '%';
    tooltip += '\n  Usage: ' + computeLoad(node.cpuUsage, node.cpuCapacity)+ '%';
    tooltip += '\nMemory: ' + node.memCapacity;
    tooltip += '\n  Allocatable: ' + computeLoad(node.memAllocatable, node.memAllocatable) + '%';
    tooltip += '\n  Usage: ' + computeLoad(node.memUsage, node.memCapacity)+ '%';
    tooltip += '\nPods: ' + parseInt(node.podsRunning.length + node.podsNotRunning.length);
    tooltip += '\n  Running: ' + node.podsRunning.length;
    tooltip += '\n  Not Running: ' + node.podsNotRunning.length;
    return tooltip;
}

function createPopupContent(nodeInfo)
{
    return ('<div class="modal fade" id="'+nodeInfo.id+'" tabindex="-1" role="dialog" aria-labelledby="'+nodeInfo.name+'" aria-hidden="true">'
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
        +'</div>');
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


function computeLoad(used, capacity)
{
    return Math.ceil( (1e4*used)/capacity ) / 100
}


function  computeLoadHeatMapColor(load) {
    const NUM_COLORS = 4;
    const HeatMapColors = Object.freeze({
        '0': [0,0,255],
        '1': [0,255,0],
        '2': [255,255,0],
        '3': [255,0,0]
    });

    let colorLevel = load / 100;
    let idx1 = 0;
    let idx2 = 0;
    let fractBetween = 0;
    if (colorLevel <= 0) {
        idx1 = idx2 = 0;
    } else if (colorLevel >= 1)  {
        idx1 = idx2 = NUM_COLORS - 1;
    } else {
        let tmpValue = colorLevel * (NUM_COLORS - 1);
        idx1  = Math.floor(tmpValue);
        idx2  = idx1+1;
        fractBetween = tmpValue - idx1;
    }

    let r = (HeatMapColors[idx2][0] - HeatMapColors[idx1][0])*fractBetween + HeatMapColors[idx1][0];
    let g = (HeatMapColors[idx2][1] - HeatMapColors[idx1][1])*fractBetween + HeatMapColors[idx1][1];
    let b = (HeatMapColors[idx2][2] - HeatMapColors[idx1][2])*fractBetween + HeatMapColors[idx1][2];
    return 'rgb('+r+','+g+',' +b+')';
}


function K8sLoad(data, loadType)
{
    let mainClass = this
    this.loadType = loadType;
    this.nodes = new Map();
    this.pods = new Map();
    this.popupContent = '';
    this.nodeHtmlList = '';
    this.maxCpu = 1;
    this.maxMem = 1;

    if (data.length != 4 || $.isEmptyObject(data[0]) || $.isEmptyObject(data[1]) || $.isEmptyObject(data[2]) || $.isEmptyObject(data[3])) {
        $("#error-message").html('invalid data:'+ JSON.stringify(data));
        $("#error-message").show();
        return;
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
            mainClass.maxCpu = Math.max(mainClass.maxCpu, node.cpuCapacity);
            mainClass.maxMem = Math.max(mainClass.maxMem, node.memCapacity);
            node.podsRunning = [];
            node.podsNotRunning = [];

            for (let i = 0; i < nodeApiData.status.conditions.length; ++i) {
                let cond = nodeApiData.status.conditions[i];
                node.message = cond.message;
                if (cond.type === "Ready" && cond.status === "True") {
                    node.state = "Ready";
                    break;
                }
                if (cond.type === "KernelDeadlock" && cond.status === "True") {
                    node.state = "KernelDeadlock";
                    break;
                }
                if (cond.type === "NetworkUnavailable" && cond.status === "True") {
                    node.state = "NetworkUnavailable";
                    break;
                }
                if (cond.type === "OutOfDisk" && cond.status === "True") {
                    node.state = "OutOfDisk";
                    break
                }
                if (cond.type === "MemoryPressure" && cond.status === "True") {
                    node.state = "MemoryPressure";
                    break;
                }
                if (cond.type === "DiskPressure" && cond.status === "True") {
                    node.state = "DiskPressure";
                    break;
                }
            }
            mainClass.nodeHtmlList += '<li><a href="#" data-toggle="modal" data-target="#'+node.id+'">'+ node.name+'</a></li>';
            mainClass.nodes.set(node.name, node);
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
            node.memUsage = decodeMemoryCapacity(nodeMetric.usage.memory);
            mainClass.popupContent += createPopupContent(node);
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
            let pod = mainClass.pods.get(podMetric.metadata.name);
            pod.cpuUsage = 0;
            pod.memUsage = 0;
            for (let i = 0; i < podMetric.containers.length; ++i) {
                pod.cpuUsage += decodeCpuUsage(podMetric.containers[i].usage.cpu);
                pod.memUsage += decodeMemoryCapacity(podMetric.containers[i].usage.memory);
            }
            mainClass.pods.set(podMetric.metadata.name, pod)
        }
    );


    // set pods' load for each node
    for (let [pName, pod] of mainClass.pods) {
        if (pod.phase != "Pending") {
            let node = mainClass.nodes.get(pod.nodeName);
            if (typeof pod.cpuUsage !== "undefined" &&  typeof pod.memUsage !== "undefined") {
                node.podsRunning.push(pod)
            } else {
                node.podsNotRunning.push(pod)
            }
            mainClass.nodes.set(node.name, node);
        }
    }

    return this;
}


function refreshResouceUsageByPod(k8sLoad)
{
    $( "#load-map-container" ).empty();
    $( "#host-list-container" ).html('<ul class="list-unstyled">');

    const DRAWING_AREA_SIZE = {width: DrawingAreaWidth, height: '100%'};
    const CELL_MARGIN = 10;
    const RECT_ROUND = 3;
    const NODE_SIDE = Math.min(Math.max(Math.sqrt(Math.ceil(k8sLoad.maxMem / DrawingMemScaleUnit)), DrawingMinNodeSide), DrawingMaxNodeSide);
    const NODE_SHIFT = NODE_SIDE + CELL_MARGIN;
    const MAP_NODE_PER_ROW = Math.floor(DrawingAreaWidth / NODE_SHIFT);

    let raphael = new Raphael("load-map-container", DRAWING_AREA_SIZE.width, DRAWING_AREA_SIZE.height);

    let drawingCursor = {
        x: 0,
        y : 0
    };

    let currentNodeIndex = 0;
    for (let [name, node] of k8sLoad.nodes) {
        let resUsage = '';
        let resCapacity = '';
        switch (k8sLoad.loadType) {
            case Menus.MemoryUsageByPod:
                resUsage = 'memUsage';
                resCapacity = 'memCapacity';
                break;
            case Menus.CpuUsageByPod:
                resUsage = 'cpuUsage';
                resCapacity = 'cpuCapacity';
                break;
            default:
                $("#error-message").html('unknown load type: '+ k8sLoad.loadType);
                $("#error-message").show();
                return;
        }


        if (typeof node[resUsage] === "undefined" || node[resUsage] == 0) {
            $("#error-message").html('No '+resUsage+' metric on node: ' + node.name +'\n');
            $("#error-message").show();
            continue;
        }

        if (node[resUsage] == 0) {
            $("#error-message").html('ignoring node '+node.name+' with '+resUsage+' equals to zero ');
            $("#error-message").show();
            continue;
        }

        let sumPodResUsages = 0.0;
        for (let pod of node.podsRunning) {
            sumPodResUsages += pod[resUsage];
        }

        node.podsRunning.sort(
            function(p1, p2) {
                if (p1[resUsage] < p2[resUsage])
                    return -1;
                if (p1[resUsage] > p2[resUsage])
                    return 1;
                return 0;
            }
        );
        node.podsRunning.reverse();

        if (currentNodeIndex % MAP_NODE_PER_ROW == 0) {
            drawingCursor.x = CELL_MARGIN;
            drawingCursor.y = (currentNodeIndex / MAP_NODE_PER_ROW) * NODE_SHIFT + CELL_MARGIN;
        } else {
            drawingCursor.x += NODE_SHIFT;
        }

        raphael.rect(drawingCursor.x-1, drawingCursor.y-1, NODE_SIDE+3, NODE_SIDE+3, RECT_ROUND)
            .attr({
                'stroke-width': 3,
                'stroke': computeLoadHeatMapColor(computeLoad(node[resUsage], node[resCapacity])),
                fill: '#E6E6E6',
                title: generateTooltip(node)
            });

        // draw each individual cores
        const NODE_AREA = NODE_SIDE * NODE_SIDE;
        let remainingWidth = NODE_SIDE;
        let remainingHeight = NODE_SIDE;
        let shiftX = 0.0;
        let shiftY = 0.0;
        let DrawingOrientations = Object.freeze({"Horizontal":1, "Vertical":2});
        let drawingOrientation = DrawingOrientations.Horizontal;

        node.shape = raphael.set();
        for (let pid = 0; pid < node.podsRunning.length; pid++) {
            let pod = node.podsRunning[pid];
            //let usageRatio = pod[resUsage] / sumPodResUsages;
            let usageRatio = pod[resUsage] / node[resUsage];
            let podArea =  usageRatio * NODE_AREA;
            let podWidth = 0.0;
            let podHeight = 0.0;
            if (drawingOrientation == DrawingOrientations.Horizontal) {
                podWidth = remainingWidth;
                podHeight = podArea / podWidth;
            } else {
                podHeight = remainingHeight;
                podWidth = podArea / podHeight;
            }

            let heatMapTooltip =
                '\nPod: ' + pod.name + ' (' + Math.round(1e4 * usageRatio) / 1e2 + '% of node\'s '+resUsage+')' +
                '\nNode: '+node.name+' (' + computeLoad(node[resUsage], node[resCapacity]) + '% of '+resUsage+')';

            let podShape = raphael.rect(drawingCursor.x + shiftX,
                drawingCursor.y + shiftY,
                Math.max(podWidth, 0),
                Math.max(podHeight, 0),
                RECT_ROUND)
                .attr({
                    //fill: generateRandomColor(),
                    fill: computeLoadHeatMapColor(100 * usageRatio),
                    'stroke-width': 0.5,
                    'stroke': '#fff',
                    title: heatMapTooltip
                });

            node.shape.push(podShape);
            if (drawingOrientation == DrawingOrientations.Horizontal) {
                // no shift on x (shiftX += 0;)
                shiftY += podHeight;
                remainingHeight -= podHeight;
                drawingOrientation = DrawingOrientations.Vertical;
            } else {
                // no shift on y (shiftY += 0;)
                shiftX += podWidth;
                remainingWidth -= podWidth;
                drawingOrientation = DrawingOrientations.Horizontal;
            }
        }
        k8sLoad.nodes.set(name, node);
        currentNodeIndex++;
    }

    // set dynamic HTML content
    $("#load-map-container").height(drawingCursor.y + NODE_SHIFT);
    $("#host-list-container").html('<ul>'+k8sLoad.nodeHtmlList+"</ul>");
    $("#popup-container").html(k8sLoad.popupContent);
}


function refreshPodLoadHeatmapCentered(k8sLoad)
{
    $( "#load-map-container" ).empty();
    $( "#host-list-container" ).html('<ul class="list-unstyled">');

    const DRAWING_AREA_SIZE = {width: DrawingAreaWidth, height: '100%'};
    const CELL_MARGIN = 10;
    const RECT_ROUND = 3;
    const NODE_SIDE = Math.min(Math.max(Math.sqrt(Math.ceil(k8sLoad.maxMem / DrawingMemScaleUnit)), DrawingMinNodeSide), DrawingMaxNodeSide);
    const NODE_SHIFT = NODE_SIDE + CELL_MARGIN;
    const MAP_NODE_PER_ROW = Math.floor(DrawingAreaWidth / NODE_SHIFT);

    let raphael = new Raphael("load-map-container", DRAWING_AREA_SIZE.width, DRAWING_AREA_SIZE.height);

    let drawingCursor = {
        x: 0,
        y : 0
    };

    let currentNodeIndex = 0;
    for (let [name, node] of k8sLoad.nodes) {
        let resUsage = '';
        let resCapacity = '';
        switch (k8sLoad.loadType) {
            case Menus.PodsMemoryUsageHeatMap:
                resUsage = 'memUsage';
                resCapacity = 'memCapacity';
                break;
            case Menus.PodsCpuUsageHeatMap:
                resUsage = 'cpuUsage';
                resCapacity = 'cpuCapacity';
                break;
            default:
                $("#error-message").html('unknown load type: '+ k8sLoad.loadType);
                $("#error-message").show();
                return;
        }


        if (typeof node[resUsage] === "undefined" || node[resUsage] == 0) {
            $("#error-message").html('No '+resUsage+' metric on node: ' + node.name +'\n');
            $("#error-message").show();
            continue;
        }

        if (node[resUsage] == 0) {
            $("#error-message").html('ignoring node '+node.name+' with '+resUsage+' equals to zero ');
            $("#error-message").show();
            continue;
        }

        node.podsRunning.sort(
            function(p1, p2) {
                if (p1[resUsage] < p2[resUsage])
                    return -1;
                if (p1[resUsage] > p2[resUsage])
                    return 1;
                return 0;
            }
        );
        node.podsRunning.reverse();

        if (currentNodeIndex % MAP_NODE_PER_ROW == 0) {
            drawingCursor.x = CELL_MARGIN;
            drawingCursor.y = (currentNodeIndex / MAP_NODE_PER_ROW) * NODE_SHIFT + CELL_MARGIN;
        } else {
            drawingCursor.x += NODE_SHIFT;
        }

        raphael.rect(
            drawingCursor.x,
            drawingCursor.y,
            NODE_SIDE,
            NODE_SIDE, RECT_ROUND)
            .attr({
                'stroke-width': 3,
                'stroke': computeLoadHeatMapColor(computeLoad(node[resUsage], node[resCapacity])),
                fill: '#E6E6E6',
                title: generateTooltip(node)
            });

        let sumPodResUsages = 0.0;
        for (let pod of node.podsRunning) {
            sumPodResUsages += pod[resUsage];
        }

        const NODE_AREA = NODE_SIDE * NODE_SIDE;
        node.shape = raphael.set();
        for (let pid = 0; pid < node.podsRunning.length; pid++) {
            let pod = node.podsRunning[pid];
            //let usageRatio = pod[resUsage] / node.podsRunning[0][resUsage];
            //let usageRatio = pod[resUsage] / sumPodResUsages;
            let usageRatio = pod[resUsage] / node[resUsage];
            let podArea =  usageRatio * NODE_AREA;
            let podSide = Math.ceil(Math.sqrt(podArea));
            let shift = (NODE_SIDE / 2) - (podSide / 2);

            let heatMapTooltip =
                '\nPod: ' + pod.name + ' (' + Math.round(1e4 * usageRatio) / 1e2 + '% of node\'s '+resUsage+')' +
                '\nNode: '+node.name+' (' + computeLoad(node[resUsage], node[resCapacity]) + '% of '+resUsage+')';

            let podShape = raphael.rect(
                drawingCursor.x + shift,
                drawingCursor.y + shift,
                podSide,
                podSide,
                RECT_ROUND)
                .attr({
                    fill: computeLoadHeatMapColor(100 * usageRatio),
                    'stroke-width': 0.25,
                    'stroke': '#fff',
                    title: heatMapTooltip
                });

            node.shape.push(podShape);
        }
        k8sLoad.nodes.set(name, node);
        currentNodeIndex++;
    }

    // set dynamic HTML content
    $("#load-map-container").height(drawingCursor.y + NODE_SHIFT);
    $("#host-list-container").html('<ul>'+k8sLoad.nodeHtmlList+"</ul>");
    $("#popup-container").html(k8sLoad.popupContent);
}


function refreshLoadMapByNodeUsage(k8sLoad)
{
    $( "#load-map-container" ).empty();
    $( "#host-list-container" ).html('<ul class="list-unstyled">');

    const DEFAULT_NODE_ROW_COUNT = Math.ceil( Math.sqrt(k8sLoad.maxCpu) );
    const DEFAULT_CELL_SHAPE = {side: 50, margin: 2, node_margin: 7.5};
    const DEFAULT_NODE_SIDE = DEFAULT_NODE_ROW_COUNT * DEFAULT_CELL_SHAPE.side + (DEFAULT_NODE_ROW_COUNT - 1) * DEFAULT_CELL_SHAPE.margin;
    const DRAWING_AREA_SIZE = {width: DrawingAreaWidth, height: '100%'};
    const RECT_ROUND = 3;

    let raphael = new Raphael("load-map-container", DRAWING_AREA_SIZE.width, DRAWING_AREA_SIZE.height);
    let drawingCursor = {x: DEFAULT_CELL_SHAPE.node_margin, y : DEFAULT_CELL_SHAPE.node_margin};
    for (let [name, node] of k8sLoad.nodes) {
        if (drawingCursor.x + DEFAULT_NODE_SIDE > DRAWING_AREA_SIZE.width) {
            drawingCursor.y += DEFAULT_NODE_SIDE + 2 * DEFAULT_CELL_SHAPE.node_margin;
            drawingCursor.x = DEFAULT_CELL_SHAPE.node_margin;
        }

        let nodeTooltip = generateTooltip(node);
        raphael.rect(drawingCursor.x,
            drawingCursor.y,
            DEFAULT_NODE_SIDE,
            DEFAULT_NODE_SIDE,
            RECT_ROUND)
            .attr({
                fill: '#E6E6E6',
                'stroke-width': 0.2,
                title: nodeTooltip
            });


        let resUsage = '';
        let resCapacity = '';
        switch (k8sLoad.loadType) {
            case Menus.NodesMemoryUsage:
                resUsage = 'memUsage';
                resCapacity = 'memCapacity';
                break;
            case Menus.NodesCpuUsage:
                resUsage = 'cpuUsage';
                resCapacity = 'cpuCapacity';
                break;
            default:
                $("#error-message").html('unknown load type: '+ k8sLoad.loadType);
                $("#error-message").show();
                return;
        }

        if (typeof node[resUsage] === "undefined" || node[resUsage] == 0) {
            $("#error-message").html('No '+resUsage+' on node', node.name);
            $("#error-message").show();
            continue;
        }

        let nodeLoadColor = computeLoadHeatMapColor(computeLoad(node[resUsage], node[resCapacity]));
        node.shape = raphael.set();
        for (let cpuIndex=0; cpuIndex < node.cpuCapacity; ++cpuIndex) {
            let cpuShape = raphael.rect(
                drawingCursor.x + Math.floor(cpuIndex / DEFAULT_NODE_ROW_COUNT) * (DEFAULT_CELL_SHAPE.side + DEFAULT_CELL_SHAPE.margin),
                drawingCursor.y + (cpuIndex % DEFAULT_NODE_ROW_COUNT) * (DEFAULT_CELL_SHAPE.side + DEFAULT_CELL_SHAPE.margin),
                DEFAULT_CELL_SHAPE.side,
                DEFAULT_CELL_SHAPE.side,
                RECT_ROUND)
                .attr({
                    fill: nodeLoadColor,
                    'stroke-width': 0.5,
                    title: nodeTooltip
                });
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
    currentLoadType = loadType;
    $.ajax({
        type: "GET",
        url: dataFile,
        dataType: "json",
        success: function(data) {
            let k8sLoad = K8sLoad(data, loadType)
            if (typeof k8sLoad === "undefined") {
                return;
            }

            switch (loadType) {
                case Menus.NodesMemoryUsage:
                case Menus.NodesCpuUsage:
                    refreshLoadMapByNodeUsage(k8sLoad);
                    break;
                case Menus.PodsCpuUsageHeatMap:
                case Menus.PodsMemoryUsageHeatMap:
                    refreshPodLoadHeatmapCentered(k8sLoad);
                    break;
                case Menus.CpuUsageByPod:
                case Menus.MemoryUsageByPod:
                default:
                    refreshResouceUsageByPod(k8sLoad);
                    break;
            }

            $("#title-container").html(loadType);
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
        triggerRefreshLoadMap(dataFile, Menus.CpuUsageByPod);
        setInterval(function() {triggerRefreshLoadMap(dataFile);}, 5000000); // update every 5 mins
    });
})(jQuery);
