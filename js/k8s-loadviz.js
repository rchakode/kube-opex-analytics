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


const DrawingAreaWith = 0.7 * (window.innerWidth || document.documentElement.clientWidth || document.body.clientWidth);
const HostListAreaWidth = 0.25 * (window.innerWidth || document.documentElement.clientWidth || document.body.clientWidth);

function generateTooltip(node)
{
    let tooltip = 'Host: '+node.name;
    tooltip += '\nID: '+node.id;
    tooltip += '\nState: '+ node.state;
    tooltip += '\nCPU: ' + node.cpuCapacity;
    tooltip += '\n  Allocatable: ' + computeLoad(node.cpuAllocatable, node.cpuCapacity) + '%';
    tooltip += '\n  Usage: ' + computeLoad(node.cpuUsage, node.cpuCapacity)+ '%';
    tooltip += '\nMemory: ' + node.memCapacity;
    tooltip += '\n  Allocatable: ' + computeLoad(node.memAllocatable, node.memAllocatable) + '%';
    tooltip += '\n  Usage: ' + computeLoad(node.memUsage, node.memCapacity)+ '%';
    tooltip += '\nPods: ' + node.pods.length;
    tooltip += '\nContainer Runtime: ' + node.containerRuntime;
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

function generateRandomColor() {
    let letters = '0123456789ABCDEF';
    let color = '#';
    for (let i = 0; i < 6; i++) {
        color += letters[Math.floor(Math.random() * 16)];
    }
    return color;
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

    if (data.length != 4 ||
        ! 'items' in data[0] ||
        ! 'items' in data[1] ||
        ! 'items' in data[2] ||
        ! 'items' in data[3]) {
        $("#error-message").html('invalid data, check console for details');
        $("#error-message").show();
        console.log(data);
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
            mainClass.maxCpu = Math.max(mainClass.maxCpu, node.cpuCapacity)
            node.pods = [];
            //TODO node.runningPods = parseInt( $(this).find('RUNNING_VMS').text() );

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
            node.memUsage = decodeMemoryCapacity(nodeMetric.usage.memory)
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
            node.pods.push(pod)
            mainClass.nodes.set(node.name, node);
        }
    }

    return this;
}


function refreshLoadMapByNodeUsage(k8sLoad)
{
    $( "#load-map-container" ).empty();
    $( "#host-list-container" ).html('<ul class="list-unstyled">');

    const DEFAULT_NODE_ROW_COUNT = Math.ceil( Math.sqrt(k8sLoad.maxCpu) );
    const DEFAULT_CELL_SHAPE = {side: 50, margin: 2, node_margin: 7.5};
    const DEFAULT_NODE_SIDE = DEFAULT_NODE_ROW_COUNT * DEFAULT_CELL_SHAPE.side + (DEFAULT_NODE_ROW_COUNT - 1) * DEFAULT_CELL_SHAPE.margin;
    const DRAWING_AREA_SIZE = {width: DrawingAreaWith, height: HostListAreaWidth};
    const RECT_ROUND = 3;

    let raphael = new Raphael("load-map-container", DRAWING_AREA_SIZE.width, DRAWING_AREA_SIZE.height);
    let drawingCursor = {x: DEFAULT_CELL_SHAPE.node_margin, y : DEFAULT_CELL_SHAPE.node_margin};
    for (let [name, node] of k8sLoad.nodes) {
        if (drawingCursor.x + DEFAULT_NODE_SIDE > DRAWING_AREA_SIZE.width) {
            drawingCursor.y += DEFAULT_NODE_SIDE + 2 * DEFAULT_CELL_SHAPE.node_margin;
            drawingCursor.x = DEFAULT_CELL_SHAPE.node_margin;
        }

        let nodeTooltip = generateTooltip(node);
        node.shape = raphael.set();
        raphael.rect(drawingCursor.x,
            drawingCursor.y,
            DEFAULT_NODE_SIDE,
            DEFAULT_NODE_SIDE,
            RECT_ROUND)
            .attr({fill: '#E6E6E6', 'stroke-width': 0.5, title: nodeTooltip});

        // draw each individual cores
        let nodeLoadColor = '';
        switch (k8sLoad.loadType) {
            case Menus.NodesMemoryUsage:
                nodeLoadColor = 'rgb('+computeLoadGradientColor(computeLoad(node.memUsage, node.memCapacity))+')';
                break;
            case Menus.NodesCpuUsage:
            default:
                nodeLoadColor = 'rgb('+computeLoadGradientColor(computeLoad(node.cpuUsage, node.cpuCapacity))+')';
                break;
        }

        for (let cpuIndex=0; cpuIndex < node.cpuCapacity; ++cpuIndex) {
            let cpuShape = raphael.rect(
                drawingCursor.x + Math.floor(cpuIndex / DEFAULT_NODE_ROW_COUNT) * (DEFAULT_CELL_SHAPE.side + DEFAULT_CELL_SHAPE.margin),
                drawingCursor.y + (cpuIndex % DEFAULT_NODE_ROW_COUNT) * (DEFAULT_CELL_SHAPE.side + DEFAULT_CELL_SHAPE.margin),
                DEFAULT_CELL_SHAPE.side,
                DEFAULT_CELL_SHAPE.side,
                RECT_ROUND)
                .attr({fill: nodeLoadColor, 'stroke-width': 0.5, title: nodeTooltip});
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


function refreshPodLoadHeatmap(k8sLoad)
{
    $( "#load-map-container" ).empty();
    $( "#host-list-container" ).html('<ul class="list-unstyled">');

    const DEFAULT_NODE_ROW_COUNT = Math.ceil( Math.sqrt(k8sLoad.maxCpu) );
    const DEFAULT_CELL_SETTINGS = {side: 50, margin: 10};
    const DEFAULT_NODE_SIDE = DEFAULT_NODE_ROW_COUNT * DEFAULT_CELL_SETTINGS.side;
    const DRAWING_AREA_SIZE = {width: DrawingAreaWith, HOST_LIST_AREA_WIDTH: HostListAreaWidth};
    const RECT_ROUND = 3;

    let raphael = new Raphael("load-map-container", DRAWING_AREA_SIZE.width, DRAWING_AREA_SIZE.height);
    let drawingCursor = {x: DEFAULT_CELL_SETTINGS.margin, y : DEFAULT_CELL_SETTINGS.margin};

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
            console.log('no '+resUsage+' on node '+node.name);
            continue;
        }

        if (drawingCursor.x + DEFAULT_NODE_SIDE > DRAWING_AREA_SIZE.width) {
            drawingCursor.y += DEFAULT_NODE_SIDE + DEFAULT_CELL_SETTINGS.margin;
            drawingCursor.x = DEFAULT_CELL_SETTINGS.margin;
        }


        if (node[resUsage] == 0) {
            $("#error-message").html('ignoring node '+node.name+' with '+resUsage+' equals to zero ');
            $("#error-message").show();
            continue;
        }

        // let podResUsages = [];

        let podsList = []
        let sumPodResUsages = 0.0;
        for (let pod of node.pods) {
            if (typeof pod[resUsage] !== "undefined") {
                podsList.push(pod);
                sumPodResUsages += pod[resUsage];
            }
        }

        podsList.sort(
            function(p1, p2) {
                if (p1[resUsage] < p2[resUsage])
                    return -1;
                if (p1[resUsage] > p2[resUsage])
                    return 1;
                return 0;
            }
        );
        podsList.reverse();

        node.shape = raphael.set();
        raphael.rect(drawingCursor.x, drawingCursor.y, DEFAULT_NODE_SIDE, DEFAULT_NODE_SIDE, RECT_ROUND)
            .attr({'stroke-width': 0.1})
            .attr({title: generateTooltip(node)});

        // draw each individual cores
        const NODE_AREA = DEFAULT_NODE_SIDE * DEFAULT_NODE_SIDE;
        let remainingWidth = DEFAULT_NODE_SIDE;
        let remainingHeight = DEFAULT_NODE_SIDE;
        let shiftX = 0.0;
        let shiftY = 0.0;
        let DrawingOrientations = Object.freeze({"Horizontal":1, "Vertical":2});
        let drawingOrientation = DrawingOrientations.Horizontal;

        for (let pid = 0; pid < podsList.length; pid++) {
            let pod = podsList[pid];
            let usageRatio = pod[resUsage] / sumPodResUsages;
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
                'Node => '+node.name+' => ' + computeLoad(node[resUsage], node[resCapacity]) + '% of global resources' +
                '\n|||||||||||||||||||||||||||||||||||||||||||||||||||||' +
                '\nPod => ' + pod.name + ' => ' + Math.round(1e4 * usageRatio) / 1e2 + '% of used resources'

            let podShape = raphael.rect(drawingCursor.x + shiftX,
                drawingCursor.y + shiftY,
                Math.max(podWidth, 0),
                Math.max(podHeight, 0),
                RECT_ROUND)
                .attr({fill: generateRandomColor(), 'stroke-width': 0.2, title: heatMapTooltip});

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
        drawingCursor.x += DEFAULT_NODE_SIDE + 2 * DEFAULT_CELL_SETTINGS.margin;
    }

    // set dynamic HTML content
    $("#load-map-container").height(drawingCursor.y + DEFAULT_NODE_SIDE + DEFAULT_CELL_SETTINGS.margin);
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
                    //refreshLoadMapByPodUsage(k8sLoad);
                    refreshPodLoadHeatmap(k8sLoad);
                    break;
                default:
                    refreshPodLoadHeatmap(k8sLoad);
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
        triggerRefreshLoadMap(dataFile, currentLoadType)
        setInterval(function() {
                triggerRefreshLoadMap(dataFile);
            },
            5000000); // update every 5 mins
    });
})(jQuery);
