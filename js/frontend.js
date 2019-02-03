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



var currentLoadType = '';
const DrawingAreaWidth = 0.745 * (window.innerWidth || document.documentElement.clientWidth || document.body.clientWidth);
const DrawingMemScaleUnit = 2e6;
const DrawingMinNodeSide = 128;
const DrawingMaxNodeSide = 512;

requirejs.config({
    baseUrl: 'js',
    paths: {
        jquery: './lib/jquery-1.11.0.min',
        bootswatch: './lib/bootswatch',
        bootstrap: './lib/bootstrap.min',
        d3Selection: './d3-selection/dist/d3-selection.min',
        stackedAreaChart: './britecharts/umd/stackedArea.min',
        stackedBarChart: './britecharts/umd/stackedBar.min',
        dotnutChart: './britecharts/umd/donut.min',
        legend: './britecharts/umd/legend.min',
        colors: './britecharts/umd/colors.min',
        tooltip: './britecharts/umd/tooltip.min'
    },
    shim: {
        "bootstrap": ["jquery"],
        "bootswatch": ["jquery", "bootstrap"]
    }
});


define(['jquery', 'd3Selection', 'stackedAreaChart', 'stackedBarChart', 'dotnutChart', 'legend', 'colors', 'tooltip'], 
    function ($, d3Selection, stackedAreaChart, stackedBarChart, donut, legend, colors, tooltip) {
        let stackedArea14DaysUsage = stackedAreaChart();
        let stackedArea14CostEstimate = stackedAreaChart();
        let donutChartNode = donut();

        const truncateText = function(str, length, ending) {
            if (length == null) {
              length = 100;
            }
            if (ending == null) {
              ending = '...';
            }
            if (str.length > length) {
              return str.substring(0, length - ending.length) + ending;
            } else {
              return str;
            }
        };

        function updateStackedAreaChart(dataset, myStackedAreaChart, targetDivContainer, yLabel, optionalColorSchema) {
            let chartTooltip = tooltip();
            let container = d3Selection.select('.'+targetDivContainer);
            let containerWidth = container.node() ? container.node().getBoundingClientRect().width : false;

            if (containerWidth) {
                myStackedAreaChart
                    .isAnimated(false)
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
                    //.colorSchema(colors.colorSchemas.orange)
                    .on('customDataEntryClick', function(d, mousePosition) {
                        console.log('Data entry marker clicked', d, mousePosition);
                    })
                    .on('customMouseOver', chartTooltip.show)
                    .on('customMouseMove', function(dataPoint, topicColorMap, dataPointXPosition) {
                        chartTooltip.update(dataPoint, topicColorMap, dataPointXPosition);
                    })
                    .on('customMouseOut', chartTooltip.hide);

                if (optionalColorSchema) {
                    myStackedAreaChart.colorSchema(optionalColorSchema);
                }

                container.datum(dataset.data).call(myStackedAreaChart);

                chartTooltip
                    .topicLabel('values')
                    .title('Namespaces Usage');

                let tooltipContainer = d3Selection.select('.'+targetDivContainer+' .metadata-group .vertical-marker-container');
                tooltipContainer.datum([]).call(chartTooltip);

                d3Selection.select('#button').on('click', function() {
                    myStackedAreaChart.exportChart('stacked-area.png', 'Britecharts Stacked Area');
                });
            }
        }


        function updateStackedBarChart(dataset, myStackedBarChart, targetDivContainer, optionalColorSchema) {
            let chartTooltip = tooltip();
            let container = d3Selection.select('.'+targetDivContainer);
            let containerWidth = container.node() ? container.node().getBoundingClientRect().width : false;

            if (containerWidth) {
                myStackedBarChart
                    .width(containerWidth)
                    .tooltipThreshold(400)
                    .betweenBarsPadding(0.3)
                    .isAnimated(true)
                    .isHorizontal(false)
                    .nameLabel('category')
                    .stackLabel('item')
                    .valueLabel('value')
                    .margin({left: 50, top: 0, right: 0, bottom: 20})
                    .on('customMouseOver', chartTooltip.show)
                    .on('customMouseMove', function(dataPoint, topicColorMap, x, y) {
                        chartTooltip.update(dataPoint, topicColorMap, x, y);
                    })
                    .on('customMouseOut', chartTooltip.hide);

                container.datum(dataset.data).call(myStackedBarChart);

                chartTooltip
                    .title('Pod Usage (%)')
                    .topicLabel('values')
                    .dateLabel('date');

                let tooltipContainer = d3Selection.select('.metadata-group');
                tooltipContainer.datum([]).call(chartTooltip);

                d3Selection.select('#button').on('click', function() {
                    stackedBar.exportChart('stacked-bar.png', 'Britecharts Stacked Bar');
                });
            }
        }

        function getLegendChart(dataset, targetDivContainer, optionalColorSchema) {
            let legendChart = legend();
            let legendContainer = d3Selection.select('.'+targetDivContainer);

            let containerWidth = legendContainer.node() ? legendContainer.node().getBoundingClientRect().width : false;

            if (containerWidth) {
                d3Selection.select('.'+targetDivContainer+' .britechart-legend').remove();
                legendChart
                    .width(containerWidth*0.8)
                    .colorSchema(colors.colorSchemas.orange)
                    .height(200)
                    .numberFormat('s');

                if (optionalColorSchema) {
                    legendChart.colorSchema(optionalColorSchema);
                }
                legendContainer.datum(dataset).call(legendChart);
                return legendChart;
            }
        }

        function updateDonutChart(dataset, myDonutChart, targetDivContainer, legendContainer, optionalColorSchema) {
            let legendChart = getLegendChart(dataset, legendContainer, optionalColorSchema);
            let donutContainer = d3Selection.select('.'+targetDivContainer);
            let containerWidth = donutContainer.node() ? donutContainer.node().getBoundingClientRect().width : false;

            if (containerWidth) {
                d3Selection.select('#button').on('click', function() {
                    myDonutChart.exportChart();
                });

                myDonutChart
                    .isAnimated(true)
                    .highlightSliceById(2)
                    .width(containerWidth)
                    .height(containerWidth)
                    .externalRadius(containerWidth/2.5)
                    .internalRadius(containerWidth/5)
                    .colorSchema(colors.colorSchemas.orange)
                    .on('customMouseOver', function(data) {
                        legendChart.highlight(data.data.id);
                    })
                    .on('customMouseOut', function() {
                        legendChart.clearHighlight();
                    });

                if (optionalColorSchema) {
                    myDonutChart.colorSchema(optionalColorSchema);
                }

                donutContainer.datum(dataset).call(myDonutChart);

                d3Selection.select('#button').on('click', function() {
                    myDonutChart.exportChart('donut.png', 'Britecharts Donut Chart');
                });
            }
        }


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


        function buildNodesLoadDataSet(data, loadType)
        {
            let dataset = { "data": new Map };

            let nodeHtmlList = '';
            let popupContent = '';
            for (let nname in data) {
                if (data.hasOwnProperty(nname)) {
                    let node = data[nname];
                    nodeHtmlList += '<li><a href="#" data-toggle="modal" data-target="#'+node.id+'">'+ node.name+'</a></li>';
                    popupContent += createPopupContent(node);
                }
            }
            $("#host-list-container").html('<ul>'+nodeHtmlList+"</ul>");
            $("#popup-container").html(popupContent);

            for (let nname in data) {
                if (! data.hasOwnProperty(nname)) {
                    continue;
                }
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
                        $("#error-message-container").show();
                        return;
                }

                let node = data[nname];
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

                // sort pods in ascending order in against resource usage
                node.podsRunning.sort(
                    function(p1, p2) {
                        if (p1[resUsage] < p2[resUsage])
                            return -1;
                        if (p1[resUsage] > p2[resUsage])
                            return 1;
                        return 0;
                    }
                );

                let nodeData = [];
                let sumLoad = 0.0;
                for (let pid = 0; pid < node.podsRunning.length; pid++) {
                    let pod = node.podsRunning[pid];
                    let podLoad = computeLoad(pod[resUsage], node[resCapacity]);
                    sumLoad += podLoad;
                    nodeData.push({
                        "name": truncateText(pod.name, 25, '...'),
                        "id": pid,
                        "quantity": pod[resUsage],
                        "percentage": podLoad
                    });
                }
                nodeData.push({
                    "name": 'unused',
                    "id": 9999,
                    "quantity": node[resCapacity] - (node[resCapacity] * sumLoad/100),
                    "percentage": (100 - sumLoad)
                });
                dataset.data.set(nname, nodeData)
            }
            return dataset;
        }


        function computeLoad(used, capacity)
        {
            return Math.ceil(1e4*used/capacity ) / 100
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
            console.log(Date(), 'starting update')
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
                    updateStackedAreaChart(dataset,
                        stackedArea14DaysUsage,
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
                    updateStackedAreaChart(dataset,
                        stackedArea14CostEstimate,
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
                    let dataset = buildNodesLoadDataSet(data, currentLoadType, 'donut');
                    let dynHtml = '';
                    for (let [nname, _] of dataset.data) {
                        dynHtml += '<div class="col-md-4">';
                        dynHtml += '  <legent>'+nname+'</dilegentv>';
                        dynHtml += '  <div class="'+nname+'"></div>';
                        dynHtml += '  <div class="'+nname+'-legend" britechart-legend"></div>';
                        dynHtml += '</div>';
                    }
                    $("#js-nodes-load-container").html(dynHtml);
                    for (let [nname, ndata] of dataset.data) {
                        updateDonutChart(ndata,
                            donutChartNode,
                            nname,
                            nname+'-legend');
                    }
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
                            $('#js-node-load-container').hide();
                        },
                        complete: function() {
                            $('#js-node-load-container').show();
                        },
                        success: function() {
                            $('#js-node-load-container').show();
                        }
                    });
                triggerRefreshUsageCharts(frontendDataLocation, Menus.PodsCpuUsageHeatMap);
                setInterval(function() {triggerRefreshUsageCharts(frontendDataLocation);}, 300000); // update every 5 mins
            });
        })(jQuery);
    }
);