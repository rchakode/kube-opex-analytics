/*
# File: frontend.js                                                                      #
# Author: Rodrigue Chakode <rodrigue.chakode @ gmail dot com>                            #
#                                                                                        #
# Copyright © 2019 Rodrigue Chakode and contributors.                                    #
#                                                                                        #
# This file is part of Kubernetes Opex Analytics software.                               #
#                                                                                        #
# Kubernetes Opex Analytics is licensed under the Apache License 2.0 (the "License");    #
# you may not use this file except in compliance with the License. You may obtain        #
# a copy of the License at: http://www.apache.org/licenses/LICENSE-2.0                   #
#                                                                                        #
# Unless required by applicable law or agreed to in writing, software distributed        #
# under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR            #
# CONDITIONS OF ANY KIND, either express or implied. See the License for the             #
# specific language governing permissions and limitations under the License.             #
*/
'use strict';



var currentUsageType = '';
const KoaColorSchema = [
    "#6600ff",
    "#9966ff",
    "#cc66ff",
    "#ff99ff",
    "#ff99cc",
    "#ff9999",
    "#ff9966",
    "#ff9933",
    "#cc6600",
    "#cc3300",
    "#9900ff",
    "#cc00ff",
    "#ff00ff",
    "#ff33cc",
    "#ff3399",
    "#ff0066",
    "#ff5050",
    "#ff0000",
    "#990000",
    "#6600cc",
    "#9933ff",
    "#cc33ff",
    "#ff66ff",
    "#ff66cc",
    "#ff6699",
    "#ff6666",
    "#ff6600",
    "#ff3300",
    "#993300",
    "#9900cc",
    "#cc00cc",
    "#cc0099",
    "#cc3399",
    "#cc6699",
    "#cc0066",
    "#cc0000",
    "#800000",
    "#660066",
    "#993399",
    "#990099",
    "#993366",
    "#660033",
    "#660033",
    "#990033",
    "#993333"
    ]

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


define(['jquery', 'bootstrap', 'bootswatch',  'd3Selection', 'stackedAreaChart', 'stackedBarChart', 'dotnutChart', 'legend', 'colors', 'tooltip'],
    function ($, bootstrap, bootswatch, d3Selection, stackedAreaChart, stackedBarChart, donut, legend, colors, tooltip) {
        let cpuUsageTrendsChart = stackedAreaChart();
        let memoryUsageTrendsChart = stackedAreaChart();
        let dailyCpuUsageChart = stackedBarChart();
        let dailyMemoryUsageChart = stackedBarChart();
        let monthlyCpuUsageChart = stackedBarChart();
        let monthlyMemoryUsageChart = stackedBarChart();

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


        function renderLegend(dataset, targetDivContainer) {
            let legendChart = legend();
            let legendContainer = d3Selection.select('.'+targetDivContainer);

            let containerWidth = legendContainer.node() ? legendContainer.node().getBoundingClientRect().width : false;

            if (containerWidth) {
                d3Selection.select('.'+targetDivContainer+' .britechart-legend').remove();
                legendChart
                    .width(containerWidth*0.8)
                    .height(400)
                    .marginRatio(2)
                    .markerSize(10)
                    .numberFormat('');

                if (KoaColorSchema) {
                    legendChart.colorSchema(KoaColorSchema);
                }
                legendContainer.datum(dataset).call(legendChart);
                return legendChart;
            }
        }

        function updateStackedAreaChart(dataset, myStackedAreaChart, targetDivContainer, yLabel, chartTitle) {
            let chartTooltip = tooltip();
            let container = d3Selection.select('.'+targetDivContainer);
            let containerWidth = container.node() ? container.node().getBoundingClientRect().width : false;

            if (containerWidth) {

                dataset.data.sort(
                    function(data1, data2) {
                        let ts1 = Date.parse(data1.dateUTC)
                        let ts2 = Date.parse(data2.dateUTC)
                        if (ts1 < ts2)
                            return -1;
                        if (ts1 > ts2)
                            return 1;
                        return 0;
                    }
                );

                //container.html(myStackedBarChart.loadingState());
                myStackedAreaChart
                    .isAnimated(true)
                    .tooltipThreshold(600)
                    .height(400)
                    .grid('full')
                    .xAxisFormat('custom')
                    .xAxisCustomFormat('%b %d %H:%M')
                    .xTicks(2)
                    .yAxisLabel(yLabel)
                    .width(containerWidth)
                    .dateLabel('dateUTC')
                    .valueLabel('usage')
                    .margin({left: 75, top: 50, right: 25, bottom: 50})
                    .colorSchema(KoaColorSchema)
                    .on('customDataEntryClick', function(d, mousePosition) {
                        console.log('Data entry marker clicked', d, mousePosition);
                    })
                    .on('customMouseOver', chartTooltip.show)
                    .on('customMouseMove', function(dataPoint, topicColorMap, dataPointXPosition) {
                        chartTooltip.update(dataPoint, topicColorMap, dataPointXPosition);
                    })
                    .on('customMouseOut', chartTooltip.hide);

                if (KoaColorSchema) {
                    myStackedAreaChart.colorSchema(KoaColorSchema);
                }

                container.datum(dataset.data).call(myStackedAreaChart);

                chartTooltip
                    .topicLabel('values')
                    .title(chartTitle);

                let tooltipContainer = d3Selection.select('.'+targetDivContainer+' .metadata-group .vertical-marker-container');
                tooltipContainer.datum([]).call(chartTooltip);

                d3Selection.select('#button').on('click', function() {
                    myStackedAreaChart.exportChart('stacked-area.png', chartTitle);
                });
            }
        }


        function updateStackedBarChart(dataset, myStackedBarChart, targetDivContainer, yLabel, chartTitle) {
            let chartTooltip = tooltip();
            let container = d3Selection.select('.'+targetDivContainer);
            let containerWidth = container.node() ? container.node().getBoundingClientRect().width : false;

            if (containerWidth) {

                dataset.data.sort(
                    function(data1, data2) {
                        let ts1 = Date.parse(data1.date+' GMT')
                        let ts2 = Date.parse(data2.date+' GMT')
                        if (ts1 < ts2)
                            return -1;
                        if (ts1 > ts2)
                            return 1;
                        return 0;
                    }
                );
                //container.html(myStackedBarChart.loadingState());
                myStackedBarChart
                    .isAnimated(true)
                    //.hasPercentage(true)
                    .tooltipThreshold(400)
                    .height(400)
                    .width(containerWidth)
                    .grid('horizontal')
                    .stackLabel('stack')
                    .nameLabel('date')
                    .valueLabel('usage')
                    .nameLabelFormat('%b %d')
                    .betweenBarsPadding(0.2)
                    .yAxisLabel(yLabel)
                    .colorSchema(KoaColorSchema)
                    .margin({left: 75, top: 50, right: 25, bottom: 50})
                    .on('customMouseOver', function(data) {
                        chartTooltip.show();
                    })
                    .on('customMouseOut', function() {
                        chartTooltip.hide();
                    })
                    .on('customMouseMove', function(dataPoint, topicColorMap, pos) {
                        chartTooltip.update(dataPoint, topicColorMap, pos);
                    });

                container.datum(dataset.data).call(myStackedBarChart);

                chartTooltip
                    .nameLabel('stack')
                    .dateLabel('date')
                    .topicLabel('values')
                    .shouldShowDateInTitle(false)
                    .title(chartTitle);

                let tooltipContainer = d3Selection.select('.'+targetDivContainer+' .metadata-group');
                tooltipContainer.datum([]).call(chartTooltip);

                d3Selection.select('#button').on('click', function() {
                    stackedBar.exportChart('stacked-bar.png', chartTitle);
                });
            }
        }


        function updateDonutChart(dataset, myDonutChart, targetDivContainer, legendContainer, chartTitle) {
            let legendChart = renderLegend(dataset, legendContainer);
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
                    .on('customMouseOver', function(data) {
                        legendChart.highlight(data.data.id);
                    })
                    .on('customMouseOut', function() {
                        legendChart.clearHighlight();
                    });

                if (KoaColorSchema) {
                    myDonutChart.colorSchema(KoaColorSchema);
                }

                donutContainer.datum(dataset).call(myDonutChart);

                d3Selection.select('#button').on('click', function() {
                    myDonutChart.exportChart('donut.png', chartTitle);
                });
            }
        }


        function generateTooltip(node)
        {
            let tooltip = '<table class="table table-striped"><tbody>';

            tooltip += '<tr><td>Host</td><td>'+node.name+'</td></tr>';
            tooltip += '<tr><td>UID</td><td>'+node.id+'</td></tr>';
            tooltip += '<tr><td>Container Runtime</td><td>'+node.containerRuntime+'</td></tr>';
            tooltip += '<tr><td>State</td><td>'+node.state+'</td></tr>';
            tooltip += '<tr><td>CPU</td><td>'+node.cpuCapacity+'</td></tr>';
            tooltip += '<tr><td>&nbsp;&nbsp;Allocatable</td><td>'+computeLoad(node.cpuAllocatable, node.cpuCapacity)+'</td></tr>';
            tooltip += '<tr><td>&nbsp;&nbsp;Usage</td><td>'+computeLoad(node.cpuUsage, node.cpuCapacity)+'</td></tr>';
            tooltip += '<tr><td>Memory</td><td>'+node.memCapacity+'</td></tr>';
            tooltip += '<tr><td>&nbsp;&nbsp;Allocatable</td><td>'+computeLoad(node.memAllocatable, node.memAllocatable)+'</td></tr>';
            tooltip += '<tr><td>&nbsp;&nbsp;Usage</td><td>'+computeLoad(node.memUsage, node.memCapacity)+'</td></tr>';
            tooltip += '<tr><td>Pods Running</td><td>'+node.podsRunning.length+'</td></tr>';

            tooltip += '</tbody></table>';
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
                +generateTooltip(nodeInfo)
                +'</div>'
                +'<div class="modal-footer">'
                +'<button type="button" class="btn btn-default" data-dismiss="modal">Close</button>'
                +'</div>'
                +'</div>'
                +'</div>'
                +'</div>');
        }


        function buildNodesLoadDataSet(data, usageType)
        {
            let dataset = { "data": new Map() };

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
                let resAllocatable = '';

                switch (usageType) {
                    case UsageTypes.MEM:
                        resUsage = 'memUsage';
                        resCapacity = 'memCapacity';
                        resAllocatable = 'memAllocatable';
                        break;
                    case UsageTypes.CPU:
                        resUsage = 'cpuUsage';
                        resCapacity = 'cpuCapacity';
                        resAllocatable = 'cpuAllocatable';
                        break;
                    default:
                        $("#error-message").append('<li>unknown load type: '+ usageType+'</li>');
                        $("#error-message-container").show();
                        return;
                }

                let node = data[nname];
                if (typeof node[resUsage] === "undefined" || node[resUsage] == 0) {
                    $("#error-message").append('<li>No '+resUsage+' metric on node ' + node.name +'</li>');
                    $("#error-message-container").show();
                    continue;
                }

                if (node[resUsage] == 0) {
                    $("#error-message").append('<li>Node '+node.name+' has '+resUsage+' equals to zero'+'</li>');
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

                let chartData = [];
                let sumLoad = 0.0;
                let loadColors = [];
                for (let pid = 0; pid < node.podsRunning.length; pid++) {
                    let pod = node.podsRunning[pid];
                    let podLoad = computeLoad(pod[resUsage], node[resCapacity]);
                    let podLoadRel = computeLoad(pod[resUsage], node[resUsage]);
                    loadColors.push(computeLoadHeatMapColor(podLoadRel));
                    sumLoad += podLoad;
                    if (pod[resUsage] > 0.0 ) {
                        chartData.push({
                            "name": truncateText(pod.name, 25, '...'),
                            "id": pid,
                            "quantity": pod[resUsage],
                            "percentage": podLoad
                        });
                    }
                }

                let nonAllocatableCapacity = node[resCapacity] - node[resAllocatable]
                let nonAllocatableRatio = computeLoad(nonAllocatableCapacity, node[resCapacity])
                sumLoad += nonAllocatableRatio;

                chartData.push({
                    "name": 'non allocatable',
                    "id": 9998,
                    "quantity": nonAllocatableCapacity,
                    "percentage": nonAllocatableRatio
                });

                chartData.push({
                    "name": 'unused',
                    "id": 9999,
                    "quantity": node[resCapacity] * (1 - sumLoad/100),
                    "percentage": (100.0 - sumLoad)
                });
                loadColors.push(computeLoadHeatMapColor(0));
                dataset.data.set(nname, {'chartData': chartData, 'colorSchema': loadColors})
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


        function updateNodeUsage(frontendDataDir)
        {
            currentUsageType = $("#node-usage-type option:selected" ).val();
            $.ajax({
                type: "GET",
                url: frontendDataDir+'/nodes.json',
                dataType: 'json',
                success: function(data) {
                    let dataset = buildNodesLoadDataSet(data, currentUsageType, 'donut');
                    let dynHtml = '';
                    let donuts = new Map();
                    for (let [nname, _] of dataset.data) {
                        donuts[nname] = donut();
                        dynHtml += '<div class="col-md-4">';
                        dynHtml += '  <h4>'+nname+'</h4>';
                        dynHtml += '  <div class="js-'+nname+'"></div>';
                        dynHtml += '  <div class="js-'+nname+'-legend" britechart-legend"></div>';
                        dynHtml += '</div>';
                    }
                    $("#js-nodes-load-container").html(dynHtml);
                    for (let [nname, ndata] of dataset.data) {
                        updateDonutChart(ndata['chartData'],
                            donuts[nname],
                            'js-'+nname,
                            'js-'+nname+'-legend');
                    }
                },
                error: function (xhr, ajaxOptions, thrownError) {
                    $("#error-message").append('<li>download node data'+' ('+xhr.status+')</li>');
                    $("#error-message-container").show();
                }
            });
        }

        function loadBackendConfig(frontendDataDir)
        {
            $("#cost-model").text('');
            $.ajax({
                type: "GET",
                url: frontendDataDir+'/backend.json',
                dataType: 'json',
                success: function(backend_config) {
                    $("#cost-model").text(backend_config.cost_model+' ('+backend_config.currency+')');
                },
                error: function (xhr, ajaxOptions, thrownError) {
                    $("#cost-model").text('Ratio (%)');
                    console.log('failed loading backend config (',xhr.status, ' error)')
                }
            });
        }        

        function triggerRefreshUsageCharts(frontendDataDir)
        {
            console.log(Date(), 'updating usage...')
            $("#error-message-container").hide();
            $("#error-message").html('')

            loadBackendConfig(frontendDataDir);

            $.ajax({
                type: "GET",
                url: frontendDataDir+'/cpu_usage_trends.json',
                dataType: 'json',
                success: function(data) {
                    updateStackedAreaChart(
                        {"data": data},
                        cpuUsageTrendsChart,
                        'js-usage-cpu-trends',
                        'CPU Usage',
                        'Hourly CPU Usage');
                },
                error: function (xhr, ajaxOptions, thrownError) {
                    $("#error-message").append('<li>download hourly cpu usage'+' ('+xhr.status+')</li>');
                    $("#error-message-container").show();
                }
            });


            $.ajax({
                type: "GET",
                url: frontendDataDir+'/memory_usage_trends.json',
                dataType: 'json',
                success: function(data) {
                    updateStackedAreaChart(
                        {"data": data},
                        memoryUsageTrendsChart,
                        'js-usage-memory-trends',
                        'Memory Usage',
                        'Hourly Memory Usage');
                },
                error: function (xhr, ajaxOptions, thrownError) {
                    $("#error-message").append('<li>download hourly memory usage'+' ('+xhr.status+')</li>');
                    $("#error-message-container").show();
                }
            });

            $.ajax({
                type: "GET",
                url: frontendDataDir+'/cpu_usage_period_1209600.json',
                dataType: 'json',
                success: function(data) {
                    updateStackedBarChart(
                        {"data": data},
                        dailyCpuUsageChart,
                        'js-daily-cpu-usage',
                        'Cumulative CPU Usage',
                        'Daily CPU Usage');
                },
                error: function (xhr, ajaxOptions, thrownError) {
                    $("#error-message").append('<li>download daily cpu usage'+' ('+xhr.status+')</li>');
                    $("#error-message-container").show();
                }
            });


            $.ajax({
                type: "GET",
                url: frontendDataDir+'/memory_usage_period_1209600.json',
                dataType: 'json',
                success: function(data) {
                    updateStackedBarChart(
                        {"data": data},
                        dailyMemoryUsageChart,
                        'js-daily-memory-usage',
                        'Cumulative Memory Usage',
                        'Daily Memory Usage');
                },
                error: function (xhr, ajaxOptions, thrownError) {
                    $("#error-message").append('<li>download daily memory usage'+' ('+xhr.status+')</li>');
                    $("#error-message-container").show();
                }
            });

            $.ajax({
                type: "GET",
                url: frontendDataDir+'/cpu_usage_period_31968000.json',
                dataType: 'json',
                success: function(data) {
                    updateStackedBarChart(
                         {"data": data},
                         monthlyCpuUsageChart,
                        'js-montly-cpu-usage',
                        'Cumulative CPU Usage',
                        'Monthly CPU Usage');
                },
                error: function (xhr, ajaxOptions, thrownError) {
                    $("#error-message").append('<li>download monthly cpu usage'+' ('+xhr.status+')</li>');
                    $("#error-message-container").show();
                }
            });

            $.ajax({
                type: "GET",
                url: frontendDataDir+'/memory_usage_period_31968000.json',
                dataType: 'json',
                success: function(data) {
                    updateStackedBarChart(
                         {"data": data},
                         monthlyMemoryUsageChart,
                        'js-montly-memory-usage',
                        'Cumulative Memory Usage',
                        'Monthly Memory Usage');
                },
                error: function (xhr, ajaxOptions, thrownError) {
                    $("#error-message").append('<li>download monthly memory usage'+' ('+xhr.status+')</li>');
                    $("#error-message-container").show();
                }
            });

            // update nodes usage
            updateNodeUsage(frontendDataDir);
            console.log(Date(), 'updating completed')
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
                triggerRefreshUsageCharts(frontendDataDir, UsageTypes.CPU);
                setInterval(function() {triggerRefreshUsageCharts(frontendDataDir);}, 300000); // update every 5 mins
            });
        })(jQuery);

        // export API
        FrontendApi.refreshUsageCharts =  triggerRefreshUsageCharts;
        FrontendApi.updateNodeUsage =  updateNodeUsage;
    }
);