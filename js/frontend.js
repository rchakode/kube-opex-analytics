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


var selectedUsageType = '';
var usageTrendType = 'usage-trend-type-default';
var cumulativeUsageType = 'daily';

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
        donutChart: './britecharts/umd/donut.min',
        lineChart: './britecharts/umd/line.min',
        legend: './britecharts/umd/legend.min',
        colors: './britecharts/umd/colors.min',
        tooltip: './britecharts/umd/tooltip.min'
    },
    shim: {
        "bootstrap": ["jquery"],
        "bootswatch": ["jquery", "bootstrap"]
    }
});


define(['jquery', 'bootstrap', 'bootswatch', 'd3Selection', 'stackedAreaChart', 'stackedBarChart', 'donutChart', 'lineChart', 'legend', 'colors', 'tooltip'],
    function ($, bootstrap, bootswatch, d3Selection, stackedAreaChart, stackedBarChart, donut, lineChart, legend, colors, tooltip) {
        let cpuUsageTrendsChart = stackedAreaChart();
        let memoryUsageTrendsChart = stackedAreaChart();
        let cpuRfTrendsChart = lineChart();
        let memoryRfTrendsChart = lineChart();
        let dailyCpuUsageChart = stackedBarChart();
        let dailyMemoryUsageChart = stackedBarChart();
        let monthlyCpuUsageChart = stackedBarChart();
        let monthlyMemoryUsageChart = stackedBarChart();

        const truncateText = function (str, length, ending) {
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
            const legendContainer = d3Selection.select('.' + targetDivContainer);
            const containerWidth = legendContainer.node() ? legendContainer.node().getBoundingClientRect().width : false;

            if (!containerWidth) return null;

            // Clear previous legend
            legendContainer.selectAll('*').remove();

            // Enable scrollbar when content exceeds height
            legendContainer.style('max-height', '400px')
                .style('overflow-y', 'auto')
                .style('overflow-x', 'hidden');

            // Create SVG for legend (single column layout)
            const legendWidth = containerWidth * 0.8;
            const markerSize = 10;
            const itemHeight = 25;

            // Calculate height based on number of items (single column)
            const legendHeight = (dataset.length * itemHeight) + 20; // 20px padding

            const svg = legendContainer.append('svg')
                .attr('width', legendWidth)
                .attr('height', legendHeight)
                .attr('class', 'britechart-legend');

            const g = svg.append('g')
                .attr('transform', 'translate(10, 10)');

            // Sort dataset by percentage in descending order
            const sortedDataset = dataset.slice().sort((a, b) => {
                const percentA = a.percentage !== undefined ? a.percentage : 0;
                const percentB = b.percentage !== undefined ? b.percentage : 0;
                return percentB - percentA;
            });

            // Create legend items (two columns)
            const legendItems = g.selectAll('.legend-item')
                .data(sortedDataset)
                .enter().append('g')
                .attr('class', 'legend-item')
                .attr('transform', (d, i) => `translate(0, ${i * itemHeight})`)
                .style('cursor', 'pointer');

            // Add colored markers
            legendItems.append('rect')
                .attr('width', markerSize)
                .attr('height', markerSize)
                .attr('fill', (d, i) => KoaColorSchema[i % KoaColorSchema.length]);

            // Add text labels (name)
            legendItems.append('text')
                .attr('x', markerSize + 5)
                .attr('y', markerSize / 2)
                .attr('dy', '0.35em')
                .style('font-size', '12px')
                .text(d => d.name);

            // Add resource usage column (quantity and percentage) - right aligned
            legendItems.append('text')
                .attr('x', legendWidth - 20)
                .attr('y', markerSize / 2)
                .attr('dy', '0.35em')
                .style('font-size', '12px')
                .style('text-anchor', 'end')
                .text(d => {
                    if (d.quantity !== undefined && d.percentage !== undefined) {
                        return `${d.quantity.toFixed(2)} (${d.percentage.toFixed(1)}%)`;
                    }
                    return '';
                });

            // Return legend API for compatibility
            return {
                highlight: function(id) {
                    legendItems.style('opacity', (d, i) => d.id === id ? 1 : 0.3);
                },
                clearHighlight: function() {
                    legendItems.style('opacity', 1);
                }
            };
        }

/*        function renderLegend(dataset, targetDivContainer) {
            let legendChart = legend();
            let legendContainer = d3Selection.select('.' + targetDivContainer);

            let containerWidth = legendContainer.node() ? legendContainer.node().getBoundingClientRect().width : false;

            if (containerWidth) {
                d3Selection.select('.' + targetDivContainer + ' .britechart-legend').remove();
                legendChart
                    .width(containerWidth * 0.8)
                    .height(400)
                    .marginRatio(2)
                    .markerSize(10)
                    .numberFormat('.2s');

                if (KoaColorSchema) {
                    legendChart.colorSchema(KoaColorSchema);
                }
                legendContainer.datum(dataset).call(legendChart);
                return legendChart;
            }
        }    */


        function updateLineOrAreaChart(dataset, mychart, htmlContainerClass, yLabel, chartTitle) {
            let htmlContainer = d3Selection.select('.' + htmlContainerClass);
            let htmlContainerWidth = htmlContainer.node() ? htmlContainer.node().getBoundingClientRect().width : false;
            let chartTooltip = tooltip();

            if (!htmlContainerWidth) {
                return;
            }

            mychart
                .isAnimated(true)
                .tooltipThreshold(600)
                .height(400)
                .grid('full')
                .xAxisFormat('custom')
                .xAxisCustomFormat('%b %d %H:%M')
                .xTicks(2)
                .yAxisLabel(yLabel)
                .width(htmlContainerWidth)
                .margin({left: 75, top: 50, right: 25, bottom: 50})
                .colorSchema(KoaColorSchema)
                .on('customMouseOver', chartTooltip.show)
                .on('customMouseMove', function (dataPoint, topicColorMap, dataPointXPosition) {
                    chartTooltip.update(dataPoint, topicColorMap, dataPointXPosition);
                })
                .on('customMouseOut', chartTooltip.hide);

            htmlContainer.datum(dataset).call(mychart);

            chartTooltip
                .dateFormat('custom')
                .dateCustomFormat('%b %d %H:%M')
                .title(chartTitle);

            if (!dataset.hasOwnProperty('data')) {
                chartTooltip.topicLabel('values');
            }

            let tooltipContainer = d3Selection.select('.' + htmlContainerClass + ' .metadata-group .vertical-marker-container');
            tooltipContainer.datum([]).call(chartTooltip);
        }


        function updateStackedBarChart(dataset, mychart, htmlContainerClass, yLabel, chartTitle) {
            let chartTooltip = tooltip();
            let htmlContainer = d3Selection.select('.' + htmlContainerClass);
            let htmlContainerWidth = htmlContainer.node() ? htmlContainer.node().getBoundingClientRect().width : false;

            if (!htmlContainerWidth) {
                return;
            }

            dataset.data.sort(
                function (data1, data2) {
                    let ts1 = Date.parse(data1.date + ' GMT')
                    let ts2 = Date.parse(data2.date + ' GMT')
                    if (ts1 < ts2)
                        return -1;
                    if (ts1 > ts2)
                        return 1;
                    return 0;
                }
            );

            mychart
                .isAnimated(true)
                .tooltipThreshold(400)
                .height(400)
                .width(htmlContainerWidth)
                .grid('horizontal')
                .stackLabel('stack')
                .nameLabel('date')
                .valueLabel('usage')
                .valueLabelFormat(',f')
                .betweenBarsPadding(0.2)
                .yAxisLabel(yLabel)
                .colorSchema(KoaColorSchema)
                .margin({left: 75, top: 50, right: 25, bottom: 50})
                .on('customMouseOver', function (data) {
                    chartTooltip.show();
                })
                .on('customMouseOut', function () {
                    chartTooltip.hide();
                })
                .on('customMouseMove', function (dataPoint, topicColorMap, pos) {
                    chartTooltip.update(dataPoint, topicColorMap, pos);
                });

            htmlContainer.datum(dataset.data).call(mychart);

            chartTooltip
                .nameLabel('stack')
                .dateLabel('date')
                .topicLabel('values')
                .shouldShowDateInTitle(false)
                .title(chartTitle);

            let tooltipContainer = d3Selection.select('.' + htmlContainerClass + ' .metadata-group');
            tooltipContainer.datum([]).call(chartTooltip);
        }


        function updateDonutChart(dataset, selectedChart, targetDivContainer, legendContainer, chartTitle) {
            let legendChart = renderLegend(dataset, legendContainer);
            let donutContainer = d3Selection.select('.' + targetDivContainer);
            let containerWidth = donutContainer.node() ? donutContainer.node().getBoundingClientRect().width : false;

            if (containerWidth) {
                selectedChart
                    .isAnimated(true)
                    .highlightSliceById(2)
                    .width(containerWidth)
                    .height(containerWidth)
                    .externalRadius(containerWidth / 2.5)
                    .internalRadius(containerWidth / 5)
                    .on('customMouseOver', function (data) {
                        legendChart.highlight(data.data.id);
                    })
                    .on('customMouseOut', function () {
                        legendChart.clearHighlight();
                    });

                if (KoaColorSchema) {
                    selectedChart.colorSchema(KoaColorSchema);
                }

                donutContainer.datum(dataset).call(selectedChart);
            }
        }


        function generateTooltip(node) {
            let tooltip = '<table class="table table-striped"><tbody>';

            tooltip += '<tr><td>Host</td><td>' + node.name + '</td></tr>';
            tooltip += '<tr><td>UID</td><td>' + node.id + '</td></tr>';
            tooltip += '<tr><td>Container Runtime</td><td>' + node.containerRuntime + '</td></tr>';
            tooltip += '<tr><td>State</td><td>' + node.state + '</td></tr>';
            tooltip += '<tr><td>CPU</td><td>' + node.cpuCapacity + '</td></tr>';
            tooltip += '<tr><td>&nbsp;&nbsp;Allocatable</td><td>' + computeLoadPercent(node.cpuAllocatable, node.cpuCapacity) + '</td></tr>';
            tooltip += '<tr><td>&nbsp;&nbsp;Usage</td><td>' + computeLoadPercent(node.cpuUsage, node.cpuCapacity) + '</td></tr>';
            tooltip += '<tr><td>Memory</td><td>' + node.memCapacity + '</td></tr>';
            tooltip += '<tr><td>&nbsp;&nbsp;Allocatable</td><td>' + computeLoadPercent(node.memAllocatable, node.memAllocatable) + '</td></tr>';
            tooltip += '<tr><td>&nbsp;&nbsp;Usage</td><td>' + computeLoadPercent(node.memUsage, node.memCapacity) + '</td></tr>';
            tooltip += '<tr><td>Pods Running</td><td>' + node.podsRunning.length + '</td></tr>';

            tooltip += '</tbody></table>';
            return tooltip;
        }


        function computeNodePopupHtml(nodeInfo) {
            return ('<div class="modal fade" id="' + nodeInfo.id + '" tabindex="-1" role="dialog" aria-labelledby="' + nodeInfo.name + '" aria-hidden="true">'
                + '<div class="modal-dialog">'
                + '<div class="modal-content">'
                + '<div class="modal-header">'
                + '<button type="button" class="close" data-dismiss="modal" aria-hidden="true">&times;</button>'
                + '<h4 class="modal-title" id="' + nodeInfo.name + '">' + nodeInfo.name + '</h4>'
                + '</div>'
                + '<div class="modal-body">'
                + generateTooltip(nodeInfo)
                + '</div>'
                + '<div class="modal-footer">'
                + '<button type="button" class="btn btn-default" data-dismiss="modal">Close</button>'
                + '</div>'
                + '</div>'
                + '</div>'
                + '</div>');
        }

        function buildNodesDataSet(data, usageType) {
            let dataset = {"data": new Map()};

            let nodeHtmlList = '';
            let nodePopupHtml = '';
            for (let nname in data) {
                if (data.hasOwnProperty(nname)) {
                    let node = data[nname];
                    nodeHtmlList += '<li><a href="#" data-toggle="modal" data-target="#' + node.id + '">' + nname + '</a></li>';
                    nodePopupHtml += computeNodePopupHtml(node);
                }
            }
            $("#host-list-container").html('<ul>' + nodeHtmlList + "</ul>");
            $("#popup-container").html(nodePopupHtml);

            let $errorMessage = $("#error-message");
            let $errorContainer = $("#error-message-container");
            for (let nname in data) {
                if (!data.hasOwnProperty(nname)) {
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
                        $errorMessage.append('<li>unknown load type: ' + encodeURIComponent(usageType) + '</li>');
                        $errorContainer.show();
                        return;
                }

                let node = data[nname];
                if (typeof node[resUsage] === "undefined" || node[resUsage] === 0) {
                    $errorMessage.append('<li>No ' + resUsage + ' metric on node ' + encodeURIComponent(node.name) + '</li>');
                    $errorContainer.show();
                    continue;
                }

                if (node[resUsage] === 0) {
                    $errorMessage.append('<li>Node ' + node.name + ' has ' + encodeURIComponent(resUsage) + ' equals to zero' + '</li>');
                    $errorContainer.show();
                    continue;
                }

                // sort pods in ascending order in against resource usage
                node.podsRunning.sort(
                    function (p1, p2) {
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
                    let podUsageLoadOverNodeCapacity = computeLoadPercent(pod[resUsage], node[resCapacity]);
                    let podUsageLoadOverNodeUsage = computeLoadPercent(pod[resUsage], node[resUsage]);
                    loadColors.push(computeLoadPercentHeatColor(podUsageLoadOverNodeUsage));
                    sumLoad += podUsageLoadOverNodeCapacity;
                    if (pod[resUsage] > 0.0) {
                        chartData.push({
                            "name": truncateText(pod.name, 25, '...'),
                            "id": pid,
                            "quantity": pod[resUsage],
                            "percentage": podUsageLoadOverNodeCapacity
                        });
                    }
                }

                let nonAllocatableCapacity = node[resCapacity] - node[resAllocatable]
                let nonAllocatableRatio = computeLoadPercent(nonAllocatableCapacity, node[resCapacity])
                sumLoad += nonAllocatableRatio;

                chartData.push({
                    "name": 'non allocatable',
                    "id": 9998,
                    "quantity": nonAllocatableCapacity,
                    "percentage": nonAllocatableRatio
                });

                let unusedCapacity = node[resCapacity] * (1 - sumLoad / 100) ;
                chartData.push({
                    "name": 'unused',
                    "id": 9999,
                    "quantity": unusedCapacity,
                    "percentage": (100.0 - sumLoad)
                });

                loadColors.push(computeLoadPercentHeatColor(0));
                dataset.data.set(nname, {'chartData': chartData, 'colorSchema': loadColors})
            }
            return dataset;
        }


        function computeLoadPercent(used, capacity) {
            return Math.ceil(1e4 * used / capacity) / 100
        }


        function computeLoadPercentHeatColor(load) {
            const NUM_COLORS = 4;
            const HeatMapColors = Object.freeze({
                '0': [0, 0, 255],
                '1': [0, 255, 0],
                '2': [255, 255, 0],
                '3': [255, 0, 0]
            });

            let colorLevel = load / 100;
            let idx1 = 0;
            let idx2 = 0;
            let fractBetween = 0;
            if (colorLevel <= 0) {
                idx1 = idx2 = 0;
            } else if (colorLevel >= 1) {
                idx1 = idx2 = NUM_COLORS - 1;
            } else {
                let tmpValue = colorLevel * (NUM_COLORS - 1);
                idx1 = Math.floor(tmpValue);
                idx2 = idx1 + 1;
                fractBetween = tmpValue - idx1;
            }

            let r = (HeatMapColors[idx2][0] - HeatMapColors[idx1][0]) * fractBetween + HeatMapColors[idx1][0];
            let g = (HeatMapColors[idx2][1] - HeatMapColors[idx1][1]) * fractBetween + HeatMapColors[idx1][1];
            let b = (HeatMapColors[idx2][2] - HeatMapColors[idx1][2]) * fractBetween + HeatMapColors[idx1][2];
            return 'rgb(' + r + ',' + g + ',' + b + ')';
        }

        function getNodeCssId(nodeName) {
            return 'kn-' + nodeName.replaceAll('.', '_');
        }

        function getNodeCssClass(nodeCssId) {
            return "js-" + nodeCssId ;
        }

        function getNodeLegendCssClass(nodeCssId) {
            return "js-" + nodeCssId + "-legend" ;
        }

        function showUsageTrendByType() {
            usageTrendType = $("#selected-usage-trend-type option:selected").val();
            if (usageTrendType === 'usage-efficiency') {
                $('#chart-block-trends-hourly-usage').hide();
                $("#chart-block-trends-rf").show();
                refreshTrendsChartByType(cpuRfTrendsChart, 'CPU', 'rf');
                refreshTrendsChartByType(memoryRfTrendsChart, 'Memory', 'rf');
            } else {
                $("#chart-block-trends-rf").hide();
                $("#chart-block-trends-hourly-usage").show();
                refreshTrendsChartByType(cpuUsageTrendsChart, 'CPU', 'usage');
                refreshTrendsChartByType(memoryUsageTrendsChart, 'Memory', 'usage');
            }
        }


        function showCumulativeUsageByType() {
            cumulativeUsageType = $("#selected-cumulative-usage-type option:selected").val();
            if (cumulativeUsageType === 'monthly-usage') {
                $("#chart-block-daily").hide();
                $("#chart-block-monthly").show();
                refreshCumulativeChartByType(monthlyCpuUsageChart, 'CPU', 'usage', 'monthly');
                refreshCumulativeChartByType(monthlyMemoryUsageChart, 'Memory', 'usage', 'monthly');
            } else if (cumulativeUsageType === 'monthly-requests') {
                $("#chart-block-daily").hide();
                $("#chart-block-monthly").show();
                refreshCumulativeChartByType(monthlyCpuUsageChart, 'CPU', 'requests', 'monthly');
                refreshCumulativeChartByType(monthlyMemoryUsageChart, 'Memory', 'requests', 'monthly');
            } else if (cumulativeUsageType === 'daily-requests') {
                $("#chart-block-monthly").hide();
                $("#chart-block-daily").show();
                refreshCumulativeChartByType(dailyCpuUsageChart, 'CPU', 'requests', 'daily');
                refreshCumulativeChartByType(dailyMemoryUsageChart, 'Memory', 'requests', 'daily');
            } else { // handle as daily-usage
                $("#chart-block-monthly").hide();
                $("#chart-block-daily").show();
                refreshCumulativeChartByType(dailyCpuUsageChart, 'CPU', 'usage', 'daily');
                refreshCumulativeChartByType(dailyMemoryUsageChart, 'Memory', 'usage', 'daily');
            }
        }


        function exportJSON(data) {
            return new Blob(
                [JSON.stringify(data)],
                {type: 'application/json'})
        }


        function exportCSV(data) {
            data = JSON.parse(JSON.stringify(data));
            let csv = '';

            if (data.length > 0) {
                // header
                const keys = Object.keys(data[0]);
                const row = keys.reduce((acc, p) => acc + (!acc ? '' : ',') + p, '');

                csv += row + '\n';

                // content
                data.map(item => keys.reduce((acc, p) => acc + (!acc ? '' : ',') + item[p], ''))
                    .forEach(row => csv += row + '\n')
            }

            return new Blob(
                [csv],
                {type: 'text/csv;charset=utf-8'}
            );
        }


        function exportImage(chartElt, filename) {
            return new Blob(
                [chartElt.exportChart(filename)],
                {type: 'image/png'}
            );
        }


        function installExporter(targetDivId, filename, exporterFunc) {
            $(`#${targetDivId}`)
                .unbind('click')
                .attr('href', '#')
                .click(function () {
                    if (this.href.endsWith('#')) {
                        let blob = exporterFunc();
                        let url = window.URL.createObjectURL(blob);

                        this.href = url;
                        this.target = '_blank';
                        this.download = filename
                    }
                })
                .parent()
                .removeClass('disabled')
        }


        function loadBackendConfig() {
            $(".accounting-cost-model").text('');
            $.ajax({
                type: "GET",
                url: FrontendApi.DATA_DIR + '/backend.json',
                dataType: 'json',
                success: function (backend_config) {
                    $(".accounting-cost-model").text('(' + backend_config.cost_model  + ' ' + backend_config.currency + ')');
                },
                error: function (xhr, ajaxOptions, thrownError) {
                    $(".accounting-cost-model").text('(%)');
                    $("#error-message").append(`failed loading backend config (${xhr.status} error)`);
                }
            });
        }


        function refreshTrendsChartByType(chart, resourceType, trendType) {
            let resourceTypeLowered = resourceType.toLowerCase();
            let dataFile = `${resourceTypeLowered}_${trendType}_trends.json`;
            let datasetPath = `${FrontendApi.DATA_DIR}/${dataFile}`;

            const TREND_TYPE_LABELS = Object.freeze({
                "usage": "Hourly Usage",
                "rf": "Hourly Usage Efficiency",
            });

            $.ajax({
                type: "GET",
                url: datasetPath,
                dataType: 'json',
                success: function (data) {
                    let chartCategory = `${resourceTypeLowered}-${trendType}`;
                    installExporter(`trends-${resourceTypeLowered}-png`, '', () => exportImage(chart, 'kopex-trends-' + chartCategory + '.png'));
                    installExporter(`trends-${resourceTypeLowered}-json`, 'kopex-trends-' + chartCategory + '.json', () => exportJSON(data));
                    installExporter(`trends-${resourceTypeLowered}-csv`, 'kopex-trends-' + chartCategory + '.csv', () => exportCSV(data));

                    let filterDate1 = $("#filter-start-date").val();
                    let filterDate2 = $('#filter-end-date').val();
                    if (filterDate1 > filterDate2) {
                        let df = filterDate1;
                        filterDate1 =  filterDate2;
                        filterDate2 =  df;
                    }

                    if (trendType === 'rf') {
                        const dataset = {
                            data:
                                data.filter(item => (item.dateUTC >= filterDate1 && item.dateUTC <= filterDate2))
                                    .map(
                                        ({name, usage, dateUTC}) => ({
                                            topicName: name.substring(0, name.length - 4),
                                            name: name,
                                            date: dateUTC,
                                            value: usage
                                        })
                                    )
                        };
                        if (dataset.data.length > 0) {
                            updateLineOrAreaChart(dataset, chart, `js-chart-trends-${chartCategory}`, `${resourceType} ${TREND_TYPE_LABELS[trendType]}`, `${TREND_TYPE_LABELS[trendType]}`);
                            $("#error-message-container").hide();
                        } else {
                            $("#error-message").html('<li>no trends data found in the selected range</li>');
                            $("#error-message-container").show();
                        }
                    } else {
                        const dataset =
                            data.filter(item => (item.dateUTC >= filterDate1 && item.dateUTC <= filterDate2))
                                .map(
                                    ({name, usage, dateUTC}) => ({
                                        name: name,
                                        date: dateUTC,
                                        value: usage
                                    })
                                );
                        if (dataset.length > 0) {
                            updateLineOrAreaChart(dataset, chart, `js-chart-trends-${chartCategory}`, `${resourceType} ${TREND_TYPE_LABELS[trendType]}`, `${TREND_TYPE_LABELS[trendType]}`);
                            $("#error-message-container").hide();
                        } else {
                            $("#error-message").html('<li>no trends data found in the selected range</li>');
                            $("#error-message-container").show();
                        }
                    }

                },
                error: function (xhr, ajaxOptions, thrownError) {
                    $("#error-message").append(`<li>error ${xhr.status} downloading data file ${dataFile}</li>`);
                    $("#error-message-container").show();
                }
            });
        }


        function refreshCumulativeChartByType(chart, resourceType, usageType, periodType) {
            let resourceTypeLowered = resourceType.toLowerCase();
            let DATASET_FILES = Object.freeze({
                "daily-usage": `${resourceTypeLowered}_usage_period_1209600.json`,
                "daily-requests": `${resourceTypeLowered}_requests_period_1209600.json`,
                "monthly-usage": `${resourceTypeLowered}_usage_period_31968000.json`,
                "monthly-requests": `${resourceTypeLowered}_requests_period_31968000.json`,
            });

            let dataSetKey = (periodType+'-'+usageType).toLowerCase();
            let filenamePrefix = 'kopex-' + resourceTypeLowered + '-' + dataSetKey;
            $.ajax({
                type: "GET",
                url: `${FrontendApi.DATA_DIR}/${DATASET_FILES[dataSetKey]}`,
                dataType: 'json',
                success: function (data) {
                    installExporter(`consolidated-${resourceTypeLowered}-usage-png`, '', () => exportImage(chart, filenamePrefix + '.png'));
                    installExporter(`consolidated-${resourceTypeLowered}-usage-json`, filenamePrefix + '.json', () => exportJSON(data));
                    installExporter(`consolidated-${resourceTypeLowered}-usage-csv`, filenamePrefix + '.csv', () => exportCSV(data));

                    updateStackedBarChart(
                        {"data": data},
                        chart,
                        `js-chart-${periodType}-${resourceTypeLowered}-usage`,
                        `${resourceType} consumption`,
                        `${periodType} ${resourceType} ${usageType}`);
                },
                error: function (xhr, ajaxOptions, thrownError) {
                    $("#error-message").append(`<li>error ${xhr.status} downloading data file ${DATASET_FILES[periodType]}</li>`);
                    $("#error-message-container").show();
                }
            });
        }

        function updateAllCharts() {
            $("#error-message-container").hide();
            $("#error-message").html('')
            loadBackendConfig();
            showUsageTrendByType();
            showCumulativeUsageByType();
            updateNodeUsage();
        }


        function initDateFilters() {
            const formatDatetimeFilter = (dt) => {
                let dformat;
                dformat = [dt.getFullYear(),
                        (dt.getMonth() + 1).toString().padStart(2, 0),
                        dt.getDate().toString().padStart(2, 0)].join('-') + 'T' +
                    [dt.getHours().toString().padStart(2, 0),
                        dt.getMinutes().toString().padStart(2, 0),
                        dt.getSeconds().toString().padStart(2, 0)].join(':');
                return dformat ;
            }

            let todayDatetime = new Date();
            let sevenDayBefore = new Date();
            sevenDayBefore.setDate(todayDatetime.getDate() - 7);
            let filterDate1 = formatDatetimeFilter(sevenDayBefore);
            let filterDate2 = formatDatetimeFilter(todayDatetime);

            let dateFilter1 = document.getElementById("filter-start-date");
            dateFilter1.setAttribute("min", filterDate1);
            dateFilter1.setAttribute("max", filterDate2);
            dateFilter1.setAttribute("value", filterDate1);
            dateFilter1.onchange = function () { showUsageTrendByType(); };

            let dateFilter2 = document.getElementById("filter-end-date");
            dateFilter2.setAttribute("min", filterDate1);
            dateFilter2.setAttribute("max", filterDate2);
            dateFilter2.setAttribute("value", filterDate2);
            dateFilter2.onchange = function () { showUsageTrendByType(); };
        }


        (function ($) {
            $(document).ready(function () {
                $.ajaxSetup(
                    {
                        cache: false,
                        beforeSend: function () {
                            $('#js-node-load-container').hide();
                        },
                        complete: function () {
                            $('#js-node-load-container').show();
                        },
                        success: function () {
                            $('#js-node-load-container').show();
                        }
                    });

                initDateFilters();
                updateAllCharts(UsageTypes.CPU);
                setInterval(function () {
                    updateAllCharts();
                }, 300000); // update every 5 mins
            });
        })(jQuery);


        // Node Heatmap Functionality
        function getUsageColor(percentage) {
            if (percentage <= 50) return '#2ecc71';      // Green - Low usage
            if (percentage <= 80) return '#f39c12';      // Orange - Medium usage
            return '#e74c3c';                            // Red - High usage
        }

        function formatBytes(bytes) {
            if (bytes === 0) return '0 B';
            const k = 1024;
            const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
            const i = Math.floor(Math.log(bytes) / Math.log(k));
            return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
        }

        function createNodeHeatmap(nodes, resourceType) {
            const container = d3Selection.select('#js-node-heatmap-chart');
            container.selectAll('*').remove(); // Clear previous heatmap

            if (!nodes || nodes.length === 0) {
                container.append('div')
                    .attr('class', 'no-data-message')
                    .html('<p>No node data available for heatmap visualization.</p>');
                return;
            }

            // Calculate percentages if not provided or zero
            nodes.forEach(node => {
                if (!node.cpuUsagePercent || node.cpuUsagePercent === 0) {
                    node.cpuUsagePercent = node.cpuCapacity > 0
                        ? (node.cpuUsage / node.cpuCapacity) * 100
                        : 0;
                }
                if (!node.memoryUsagePercent || node.memoryUsagePercent === 0) {
                    node.memoryUsagePercent = node.memoryCapacity > 0
                        ? (node.memoryUsage / node.memoryCapacity) * 100
                        : 0;
                }
            });

            // Create SVG canvas
            const margin = {top: 20, right: 20, bottom: 60, left: 20};
            const containerWidth = container.node().getBoundingClientRect().width;
            const width = containerWidth - margin.left - margin.right;
            const height = 400 - margin.top - margin.bottom;

            const svg = container.append('svg')
                .attr('width', containerWidth)
                .attr('height', 400);

            const g = svg.append('g')
                .attr('transform', `translate(${margin.left},${margin.top})`);

            // Calculate grid layout
            const nodesPerRow = Math.ceil(Math.sqrt(nodes.length));
            const rectPadding = 10;
            const maxRectSize = Math.min((width - (nodesPerRow * rectPadding)) / nodesPerRow,
                                        (height - (Math.ceil(nodes.length / nodesPerRow) * rectPadding)) / Math.ceil(nodes.length / nodesPerRow));

            // Create tooltip
            const tooltip = d3Selection.select('body').selectAll('.heatmap-tooltip')
                .data([0]);

            const tooltipEnter = tooltip.enter().append('div')
                .attr('class', 'heatmap-tooltip')
                .style('opacity', 0);

            const tooltipDiv = tooltip.merge(tooltipEnter);

            // Create nodes
            const nodeGroups = g.selectAll('.node-group')
                .data(nodes)
                .enter().append('g')
                .attr('class', 'node-group')
                .attr('transform', (d, i) => {
                    const row = Math.floor(i / nodesPerRow);
                    const col = i % nodesPerRow;
                    const x = col * (maxRectSize + rectPadding);
                    const y = row * (maxRectSize + rectPadding);
                    return `translate(${x},${y})`;
                });

            // Add rectangles
            nodeGroups.append('rect')
                .attr('class', 'node-rect')
                .attr('width', d => Math.min(d.rectSize || maxRectSize, maxRectSize))
                .attr('height', d => Math.min(d.rectSize || maxRectSize, maxRectSize))
                .attr('fill', d => {
                    const percentage = resourceType === 'cpu' ? d.cpuUsagePercent : d.memoryUsagePercent;
                    return percentage > 0 ? getUsageColor(percentage) : '#95a5a6';
                })
                .on('mouseover', function(event, d) {
                    const percentage = resourceType === 'cpu' ? d.cpuUsagePercent : d.memoryUsagePercent;
                    const capacity = resourceType === 'cpu' ? d.cpuCapacity + ' cores' : formatBytes(d.memoryCapacity);
                    const usage = resourceType === 'cpu' ? d.cpuUsage.toFixed(2) + ' cores' : formatBytes(d.memoryUsage);

                    tooltipDiv.style('opacity', .9)
                        .html(`
                            <strong>${d.name}</strong><br/>
                            ${resourceType.toUpperCase()} Usage: ${percentage.toFixed(1)}%<br/>
                            Used: ${usage}<br/>
                            Capacity: ${capacity}<br/>
                            State: ${d.state}<br/>
                            Pods: ${d.podsRunning}
                        `)
                        .style('left', (event.pageX + 10) + 'px')
                        .style('top', (event.pageY - 28) + 'px');
                })
                .on('mouseout', function(d) {
                    tooltipDiv.style('opacity', 0);
                });

            // Add node labels
            nodeGroups.append('text')
                .attr('class', 'node-label')
                .attr('x', d => (Math.min(d.rectSize || maxRectSize, maxRectSize)) / 2)
                .attr('y', d => (Math.min(d.rectSize || maxRectSize, maxRectSize)) / 2 - 5)
                .text(d => d.name.length > 8 ? d.name.substring(0, 6) + '...' : d.name);

            // Add usage percentage text
            nodeGroups.append('text')
                .attr('class', 'node-usage-text')
                .attr('x', d => (Math.min(d.rectSize || maxRectSize, maxRectSize)) / 2)
                .attr('y', d => (Math.min(d.rectSize || maxRectSize, maxRectSize)) / 2 + 8)
                .text(d => {
                    const percentage = resourceType === 'cpu' ? d.cpuUsagePercent : d.memoryUsagePercent;
                    return percentage > 0 ? percentage.toFixed(1) + '%' : 'N/A';
                });
        }

        function updateNodeUsage() {
            const usageType = document.getElementById('js-node-usage-type').value;
            const heatmapContainer = document.getElementById('js-nodes-heatmap-container');
            const podsContainer = document.getElementById('js-nodes-pods-container');

            if (usageType.includes('heatmap')) {
                heatmapContainer.style.display = 'block';
                podsContainer.style.display = 'none';

                const resourceType = usageType.includes('cpu') ? 'cpu' : 'memory';

                // Fetch heatmap data
                fetch('/api/nodes/heatmap')
                    .then(response => {
                        if (! response.ok) {
                            throw new Error(`HTTP error! status: ${response.status}`);
                        }
                        return response.json();
                    })
                    .then(data => {
                        if (data.error) {
                            console.error('Error fetching heatmap data:', data.error);
                            document.getElementById('js-node-heatmap-chart').innerHTML =
                                '<p class="error-message">Error loading heatmap data: ' + data.error + '</p>';
                        } else {
                            createNodeHeatmap(data.nodes, resourceType);
                        }
                    })
                    .catch(error => {
                        console.error('Error fetching heatmap data:', error);
                        document.getElementById('js-node-heatmap-chart').innerHTML =
                            '<p class="error-message">Error loading heatmap data</p>';
                    });
            } else {
                heatmapContainer.style.display = 'none';
                podsContainer.style.display = 'block';
                $.ajax({
                    type: "GET",
                    url: `${FrontendApi.DATA_DIR}/nodes.json`,
                    dataType: 'json',
                    success: function (data) {
                        let dataset = buildNodesDataSet(data, usageType, 'donut');
                        let dynHtml = '';
                        let donuts = new Map();
                        for (let [nname, _] of dataset.data) {
                            let nodeCssId = getNodeCssId(nname);
                            donuts[nname] = donut();
                            dynHtml += '<div class="col-md-4">';
                            dynHtml += '  <h4>' + nname + '</h4>';
                            dynHtml += '  <div class="' + getNodeCssClass(nodeCssId) + '"></div>';
                            dynHtml += '  <div class="' + getNodeLegendCssClass(nodeCssId) + ' britechart-legend"></div>'
                            dynHtml += '</div>';
                        }

                        // $("#js-nodes-load-container").html(dynHtml);
                        podsContainer.innerHTML = dynHtml;
                        for (let [nname, ndata] of dataset.data) {
                            let nodeCssId = getNodeCssId(nname);
                            updateDonutChart(ndata['chartData'],
                                donuts[nname],
                                getNodeCssClass(nodeCssId),
                                getNodeLegendCssClass(nodeCssId)
                            );
                        }
                    },
                    error: function (xhr, ajaxOptions, thrownError) {
                        $("#error-message").append('<li>download node data' + ' (' + xhr.status + ')</li>');
                        $("#error-message-container").show();
                    }
                });
            }
        }

        // export API
        FrontendApi.refreshUsageCharts = updateAllCharts;
        FrontendApi.updateNodeUsage = updateNodeUsage;
        FrontendApi.showSelectedUsageTrendType = showUsageTrendByType;
        FrontendApi.showCumulativeUsageByType = showCumulativeUsageByType;
    }
);
