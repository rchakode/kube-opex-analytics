/*
# File: frontend.js                                                                      #
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
*/
'use strict';

requirejs.config({
    baseUrl: 'js',
    paths: {
        jquery: './lib/jquery-1.11.0.min',
        bootswatch: './lib/bootswatch',
        bootstrap: './lib/bootstrap.min',
        raphael: './lib/raphael-min',
        d3Selection: './d3-selection/dist/d3-selection.min',
        stackedAreaChart: './britecharts/umd/stackedArea.min',
        colors: './britecharts/umd/colors.min',
        tooltip: './britecharts/umd/tooltip.min'
    },
    shim: {
        "bootstrap": ["jquery"],
        "bootswatch": ["jquery", "bootstrap"]
    }
});

var currentLoadType = '';

define(['jquery', 'bootswatch', 'bootstrap', 'raphael', 'd3Selection', 'stackedAreaChart', 'colors', 'tooltip'],
    function ($, bootswatch, bootstrap, raphael, d3Selection, stackedAreaChart, colors, tooltip) {

        function createUsageChartWithTooltip(dataset, chartContainer, yLabel, optionalColorSchema) {
            let stackedArea = stackedAreaChart();
            let chartTooltip = tooltip();
            let container = d3Selection.select('.'+chartContainer);
            let containerWidth = container.node() ? container.node().getBoundingClientRect().width : false;
            let tooltipContainer;

            if (containerWidth) {
                stackedArea
                    .isAnimated(true)
                    .aspectRatio(0.5)
                    .margin(5)
                    .grid('full')
                    .xAxisFormat('custom')
                    .xAxisCustomFormat('%a %m/%d %H:%M')
                    .yAxisLabel(yLabel)
                    .tooltipThreshold(600)
                    .width(containerWidth)
                    .dateLabel('dateUTC')
                    .valueLabel('usage')
                    .on('customDataEntryClick', function(d, mousePosition) {
                        // eslint-disable-next-line no-console
                        console.log('Data entry marker clicked', d, mousePosition);
                    })
                    .on('customMouseOver', chartTooltip.show)
                    .on('customMouseMove', function(dataPoint, topicColorMap, dataPointXPosition) {
                        chartTooltip.update(dataPoint, topicColorMap, dataPointXPosition);
                    })
                    .on('customMouseOut', chartTooltip.hide);

                if (optionalColorSchema) {
                    stackedArea.colorSchema(optionalColorSchema);
                }

                container.datum(dataset.data).call(stackedArea);

                // Tooltip Setup and start
                chartTooltip
                    .topicLabel('values')
                    .title('Namespaces\' Resource Usage');

                // Note that if the viewport width is less than the tooltipThreshold value,
                // this container won't exist, and the tooltip won't show up
                tooltipContainer = d3Selection.select('.'+chartContainer+' .metadata-group .vertical-marker-container');
                tooltipContainer.datum([]).call(chartTooltip);

                d3Selection.select('#button').on('click', function() {
                    stackedArea.exportChart('stacked-area.png', 'Britecharts Stacked Area');
                });
            }
        }


        const DrawingAreaWidth = 0.745 * (window.innerWidth || document.documentElement.clientWidth || document.body.clientWidth);
        const DrawingMemScaleUnit = 2e6;
        const DrawingMinNodeSide = 128;
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


        function refreshPodLoadHeatmapCentered(data, loadType)
        {
            let nodeHtmlList = '';
            let popupContent = '';
            let maxCpu = 1;
            let maxMem = 1;
            for (let nname in data) {
                if (data.hasOwnProperty(nname)) {
                    let node = data[nname];
                    maxCpu = Math.max(maxCpu, node.cpuCapacity);
                    maxMem = Math.max(maxMem, node.memCapacity);
                    nodeHtmlList += '<li><a href="#" data-toggle="modal" data-target="#'+node.id+'">'+ node.name+'</a></li>';
                    popupContent += createPopupContent(node);
                }
            }
            $("#host-list-container").html('<ul>'+nodeHtmlList+"</ul>");
            $("#popup-container").html(popupContent);
            $("#load-map-container").empty();

            const DRAWING_AREA_SIZE = {width: DrawingAreaWidth, height: '100%'};
            const CELL_MARGIN = 10;
            const RECT_ROUND = 3;
            const NODE_SIDE = Math.min(Math.max(Math.sqrt(Math.ceil(maxMem / DrawingMemScaleUnit)), DrawingMinNodeSide), DrawingMaxNodeSide);
            const NODE_SHIFT = NODE_SIDE + CELL_MARGIN;
            const MAP_NODE_PER_ROW = Math.floor(DrawingAreaWidth / NODE_SHIFT);

            let raphael = new Raphael("load-map-container", DRAWING_AREA_SIZE.width, DRAWING_AREA_SIZE.height);

            let drawingCursor = { x: 0, y : 0};

            let currentNodeIndex = 0;
            for (let nname in data) {
                if (! data.hasOwnProperty(nname)) {
                    continue;
                }
                let node = data[nname];
                let resUsage = '';
                let resCapacity = '';

                switch (loadType) {
                    case Menus.PodsMemoryUsageHeatMap:
                        resUsage = 'memUsage';
                        resCapacity = 'memCapacity';
                        break;
                    case Menus.PodsCpuUsageHeatMap:
                        resUsage = 'cpuUsage';
                        resCapacity = 'cpuCapacity';
                        break;
                    default:
                        $("#error-message").html('unknown load type: '+ loadType);
                        $("#error-message").show();
                        return;
                }

                if (typeof node[resUsage] === "undefined" || node[resUsage] == 0) {
                    $("#error-message").html('No '+resUsage+' metric on node: ' + node.name +'\n');
                    $("#error-message-container").show();
                    continue;
                }

                if (node[resUsage] == 0) {
                    $("#error-message").html('ignoring node '+node.name+' with '+resUsage+' equals to zero ');
                    $("#error-message-container").show();
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

                const NODE_AREA = NODE_SIDE * NODE_SIDE;
                node.shape = raphael.set();
                for (let pid = 0; pid < node.podsRunning.length; pid++) {
                    let pod = node.podsRunning[pid];
                    let absUsageRatio = pod[resUsage] / node[resUsage];
                    let podArea =  absUsageRatio * NODE_AREA;
                    let podSide = Math.ceil(Math.sqrt(podArea));
                    let shift = (NODE_SIDE / 2) - (podSide / 2);

                    let heatMapTooltip =
                        '\nPod: ' + pod.name + ' (' + Math.round(1e4 * absUsageRatio) / 1e2 + '% of node\'s '+resUsage+')' +
                        '\nNode: '+node.name+' (' + computeLoad(node[resUsage], node[resCapacity]) + '% of '+resUsage+')';

                    let relUsageRatio = pod[resUsage] / node.podsRunning[0][resUsage];
                    let podShape = raphael.rect(
                        drawingCursor.x + shift,
                        drawingCursor.y + shift,
                        podSide,
                        podSide,
                        RECT_ROUND)
                        .attr({
                            fill: computeLoadHeatMapColor(100 * relUsageRatio),
                            'stroke-width': 0.25,
                            'stroke': '#fff',
                            title: heatMapTooltip
                        });

                    node.shape.push(podShape);
                }
                currentNodeIndex++;
            }
            // set dynamic HTML content
            $("#load-map-container").height(drawingCursor.y + NODE_SHIFT);
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


        function triggerRefreshUsageCharts(frontendDataLocation, loadType)
        {
            console.log('updated', Date())
            $("#error-message-container").hide();
            if (typeof loadType !== "undefined") {
                currentLoadType = loadType;
            } else if (typeof currentLoadType === "undefined") {
                currentLoadType = Menus.PodsCpuUsageHeatMap;
            }

            $.ajax({
                type: "GET",
                url: frontendDataLocation+'/usage.json',
                dataType: "json",
                success: function(data) {
                    let dataset = { "data": data };
                    createUsageChartWithTooltip(dataset, 
                        'js-14-days-hourly-usage-per-namespace',
                        'share (%) of resource usage');
                },
                error: function (xhr, ajaxOptions, thrownError) {
                    $("#error-message").html('error ' + xhr.status + ' (' + thrownError +')');
                    $("#error-message-container").show();
                }
            });

            $.ajax({
                type: "GET",
                url: frontendDataLocation+'/estimated_costs.json',
                dataType: "json",
                success: function(data) {
                    let dataset = { "data": data };
                    createUsageChartWithTooltip(dataset, 
                        'js-14-days-hourly-estimated-cost-per-namespace',
                        'cost estimate in $');
                },
                error: function (xhr, ajaxOptions, thrownError) {
                    $("#error-message").html('error ' + xhr.status + ' (' + thrownError +')');
                    $("#error-message-container").show();
                }
            });

            $.ajax({
                type: "GET",
                url: frontendDataLocation+'/nodes.json',
                dataType: "json",
                success: function(data) {
                    refreshPodLoadHeatmapCentered(data, loadType);
                },
                error: function (xhr, ajaxOptions, thrownError) {
                    $("#error-message").html('error ' + xhr.status + ' (' + thrownError +')');
                    $("#error-message-container").show();
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
                triggerRefreshUsageCharts(frontendDataLocation, Menus.PodsCpuUsageHeatMap);
                setInterval(function() {triggerRefreshUsageCharts(frontendDataLocation);}, 300000); // update every 5 mins
            });
        })(jQuery);
    });