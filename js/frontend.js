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
        d3: './lib/d3.min',
        d3Selection: './d3-selection/dist/d3-selection.min'
    },
    shim: {
        "bootstrap": ["jquery"],
        "bootswatch": ["jquery", "bootstrap"]
    }
});


define(['jquery', 'bootstrap', 'bootswatch', 'd3', 'd3Selection'],
    function ($, bootstrap, bootswatch, d3, d3Selection) {

        const truncateText = function (str, length, ending) {
            if (length === null || length === undefined) {
                length = 100;
            }
            if (ending === null || ending === undefined) {
                ending = '...';
            }
            if (str.length > length) {
                return str.substring(0, length - ending.length) + ending;
            } else {
                return str;
            }
        };

        // Centralized error handling utilities
        function showError(message, clearPrevious = false) {
            const $errorMessage = $("#error-message");
            const $errorContainer = $("#error-message-container");

            if (clearPrevious) {
                $errorMessage.html('');
            }

            // Escape HTML to prevent XSS
            const safeMessage = $('<div>').text(message).html();
            $errorMessage.append(`<li>${safeMessage}</li>`);
            $errorContainer.show();
        }

        function clearErrors() {
            $("#error-message-container").hide();
            $("#error-message").html('');
        }


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
                .style('fill', 'var(--text-primary)')
                .text(d => d.name);

            // Add resource usage column (quantity and percentage) - right aligned
            legendItems.append('text')
                .attr('x', legendWidth - 20)
                .attr('y', markerSize / 2)
                .attr('dy', '0.35em')
                .style('font-size', '12px')
                .style('text-anchor', 'end')
                .style('fill', 'var(--text-primary)')
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


        function updateLineOrAreaChart(dataset, htmlContainerClass, resourceType, trendType) {
            let yLabel = trendType === "usage" ? "Resource usage" : "Usage/Requests efficiency";
            let chartTitle = `${resourceType} - Hourly trends`;
            let htmlContainer = d3Selection.select('.' + htmlContainerClass);
            let htmlContainerNode = htmlContainer.node();

            if (!htmlContainerNode) {
                return;
            }

            // Check if we should show area fill (for usage trend type)
            let showAreaFill = trendType === 'usage';

            // Clear previous chart
            htmlContainer.selectAll('*').remove();

            // Get container dimensions
            let htmlContainerWidth = htmlContainerNode.getBoundingClientRect().width;
            let margin = {left: 75, top: 50, right: 25, bottom: 50};
            let width = htmlContainerWidth - margin.left - margin.right;
            let height = 400 - margin.top - margin.bottom;

            // Check if data is in dataset.data or directly in dataset
            let rawData = dataset.hasOwnProperty('data') ? dataset.data : dataset;

            // Filter out invalid data and parse
            let validData = [];
            rawData.forEach(function(d) {
                // Handle both formats: {dateUTC, usage} and {date, value}
                let dateStr = d.dateUTC || d.date;
                let usageVal = d.usage !== undefined ? d.usage : d.value;

                let parsedDate = new Date(dateStr);
                let parsedUsage = parseFloat(usageVal);
                if (!isNaN(parsedDate.getTime()) && !isNaN(parsedUsage)) {
                    validData.push({
                        name: d.name,
                        date: parsedDate,
                        usage: parsedUsage
                    });
                }
            });

            if (validData.length === 0) {
                return;
            }

            // Group data by name (series)
            let seriesMap = {};
            validData.forEach(function(d) {
                if (!seriesMap[d.name]) {
                    seriesMap[d.name] = [];
                }
                seriesMap[d.name].push({
                    date: d.date,
                    usage: d.usage
                });
            });

            // Convert to array of series
            let seriesData = Object.keys(seriesMap).map(function(name) {
                return {
                    name: name,
                    values: seriesMap[name].sort(function(a, b) { return a.date - b.date; })
                };
            });

            // Create scales
            let xScale = d3.scaleTime()
                .domain(d3.extent(validData, function(d) { return d.date; }))
                .range([0, width]);

            let yScale = d3.scaleLinear()
                .domain([0, d3.max(validData, function(d) { return d.usage; })])
                .nice()
                .range([height, 0]);

            let colorScale = d3.scaleOrdinal()
                .domain(seriesData.map(function(d) { return d.name; }))
                .range(KoaColorSchema);

            // Create line generator
            let line = d3.line()
                .x(function(d) { return xScale(d.date); })
                .y(function(d) { return yScale(d.usage); })
                .curve(d3.curveMonotoneX);

            // Create area generator if needed
            let area = null;
            if (showAreaFill) {
                area = d3.area()
                    .x(function(d) { return xScale(d.date); })
                    .y0(height)
                    .y1(function(d) { return yScale(d.usage); })
                    .curve(d3.curveMonotoneX);
            }

            // Create tooltip
            let tooltipDiv = d3.select('body').selectAll('.areachart-tooltip').data([0]);
            let tooltipEnter = tooltipDiv.enter().append('div')
                .attr('class', 'areachart-tooltip')
                .style('position', 'absolute')
                .style('padding', '8px')
                .style('background', 'rgba(0, 0, 0, 0.8)')
                .style('color', '#fff')
                .style('border-radius', '4px')
                .style('font-size', '12px')
                .style('pointer-events', 'none')
                .style('opacity', 0)
                .style('z-index', 1000);

            let tooltip = tooltipDiv.merge(tooltipEnter);

            // Create SVG
            let svg = htmlContainer.append('svg')
                .attr('width', htmlContainerWidth)
                .attr('height', 400);

            let g = svg.append('g')
                .attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');

            // Add grid lines
            g.append('g')
                .attr('class', 'grid')
                .attr('opacity', 0.1)
                .call(d3.axisLeft(yScale)
                    .tickSize(-width)
                    .tickFormat(''));

            g.append('g')
                .attr('class', 'grid')
                .attr('opacity', 0.1)
                .call(d3.axisBottom(xScale)
                    .tickSize(-height)
                    .tickFormat(''));

            // Add area paths if needed
            if (showAreaFill && area) {
                g.selectAll('.area-path')
                    .data(seriesData)
                    .join('path')
                    .attr('class', 'area-path')
                    .attr('d', function(d) { return area(d.values); })
                    .attr('fill', function(d) { return colorScale(d.name); })
                    .attr('opacity', 0.3)
                    .style('pointer-events', 'none');
            }

            // Add line paths
            g.selectAll('.line-path')
                .data(seriesData)
                .join('path')
                .attr('class', 'line-path')
                .attr('d', function(d) { return line(d.values); })
                .attr('stroke', function(d) { return colorScale(d.name); })
                .attr('stroke-width', 2)
                .attr('fill', 'none')
                .on('mouseover', function(event, d) {
                    d3.select(this).attr('stroke-width', 3);
                    tooltip.transition()
                        .duration(200)
                        .style('opacity', 0.9);
                })
                .on('mousemove', function(event, d) {
                    let mouseX = d3.pointer(event, g.node())[0];
                    let dateValue = xScale.invert(mouseX);

                    // Find closest data point
                    let bisect = d3.bisector(function(d) { return d.date; }).left;
                    let index = bisect(d.values, dateValue);
                    let dataPoint = d.values[index] || d.values[d.values.length - 1];

                    let formatDate = d3.timeFormat('%b %d %H:%M');

                    tooltip.html('<strong>' + d.name + '</strong><br/>' +
                        'Date: ' + formatDate(dataPoint.date) + '<br/>' +
                        chartTitle + ': ' + dataPoint.usage.toFixed(6))
                        .style('left', (event.pageX + 10) + 'px')
                        .style('top', (event.pageY - 28) + 'px');
                })
                .on('mouseout', function() {
                    d3.select(this).attr('stroke-width', 2);
                    tooltip.transition()
                        .duration(500)
                        .style('opacity', 0);
                });

            // Add axes
            g.append('g')
                .attr('class', 'x-axis')
                .attr('transform', 'translate(0,' + height + ')')
                .call(d3.axisBottom(xScale)
                    .ticks(2)
                    .tickFormat(d3.timeFormat('%b %d %H:%M')));

            g.append('g')
                .attr('class', 'y-axis')
                .call(d3.axisLeft(yScale).tickFormat(d3.format('.2f')));

            // Add y-axis label
            g.append('text')
                .attr('transform', 'rotate(-90)')
                .attr('y', 0 - margin.left)
                .attr('x', 0 - (height / 2))
                .attr('dy', '1em')
                .style('text-anchor', 'middle')
                .text(yLabel);
        }


        function updateStackedBarChart(dataset, htmlContainerClass, yLabel, chartTitle) {
            let htmlContainer = d3Selection.select('.' + htmlContainerClass);
            let htmlContainerNode = htmlContainer.node();

            if (!htmlContainerNode) {
                return;
            }

            // Clear previous chart
            htmlContainer.selectAll('*').remove();

            // Get container dimensions
            let htmlContainerWidth = htmlContainerNode.getBoundingClientRect().width;
            let margin = {left: 75, top: 50, right: 25, bottom: 50};
            let width = htmlContainerWidth - margin.left - margin.right;
            let height = 400 - margin.top - margin.bottom;

            // Group data by date for stacking
            let dateMap = {};
            dataset.data.forEach(function(d) {
                if (!dateMap[d.date]) {
                    dateMap[d.date] = [];
                }
                dateMap[d.date].push(d);
            });

            // Get dates and sort them
            let dates = Object.keys(dateMap).sort(function(date1, date2) {
                let ts1 = Date.parse(date1 + ' GMT');
                let ts2 = Date.parse(date2 + ' GMT');
                return ts1 - ts2;
            });

            let stacks = Array.from(new Set(dataset.data.map(function(d) { return d.stack; })));

            // Transform data for stacking
            let stackData = dates.map(function(date) {
                let entry = {date: date};
                dateMap[date].forEach(function(d) {
                    entry[d.stack] = d.usage;
                });
                return entry;
            });

            // Create stack generator
            let stack = d3.stack()
                .keys(stacks)
                .value((d, key) => d[key] || 0);

            let series = stack(stackData);

            // Create scales
            let xScale = d3.scaleBand()
                .domain(dates)
                .range([0, width])
                .padding(0.2);

            let yScale = d3.scaleLinear()
                .domain([0, d3.max(series, s => d3.max(s, d => d[1]))])
                .nice()
                .range([height, 0]);

            let colorScale = d3.scaleOrdinal()
                .domain(stacks)
                .range(KoaColorSchema);

            // Create tooltip
            let tooltipDiv = d3.select('body').selectAll('.stackedbar-tooltip').data([0]);
            let tooltipEnter = tooltipDiv.enter().append('div')
                .attr('class', 'stackedbar-tooltip')
                .style('position', 'absolute')
                .style('padding', '8px')
                .style('background', 'rgba(0, 0, 0, 0.8)')
                .style('color', '#fff')
                .style('border-radius', '4px')
                .style('font-size', '12px')
                .style('pointer-events', 'none')
                .style('opacity', 0)
                .style('z-index', 1000);

            let tooltip = tooltipDiv.merge(tooltipEnter);

            // Create SVG
            let svg = htmlContainer.append('svg')
                .attr('width', htmlContainerWidth)
                .attr('height', 400);

            let g = svg.append('g')
                .attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');

            // Add grid lines
            g.append('g')
                .attr('class', 'grid')
                .attr('opacity', 0.1)
                .call(d3.axisLeft(yScale)
                    .tickSize(-width)
                    .tickFormat(''));

            // Add stacked bars
            g.selectAll('.series')
                .data(series)
                .join('g')
                .attr('class', 'series')
                .attr('fill', function(d) { return colorScale(d.key); })
                .selectAll('rect')
                .data(function(d) { return d; })
                .join('rect')
                .attr('x', function(d) { return xScale(d.data.date); })
                .attr('y', function(d) { return yScale(d[1]); })
                .attr('height', function(d) { return yScale(d[0]) - yScale(d[1]); })
                .attr('width', xScale.bandwidth())
                .on('mouseover', function(event, d) {
                    let stackKey = d3.select(this.parentNode).datum().key;
                    let value = d.data[stackKey];

                    tooltip.transition()
                        .duration(200)
                        .style('opacity', 0.9);

                    tooltip.html('<strong>' + stackKey + '</strong><br/>' +
                        'Date: ' + d.data.date + '<br/>' +
                        chartTitle + ': ' + value.toFixed(3))
                        .style('left', (event.pageX + 10) + 'px')
                        .style('top', (event.pageY - 28) + 'px');
                })
                .on('mouseout', function() {
                    tooltip.transition()
                        .duration(500)
                        .style('opacity', 0);
                });

            // Add axes
            g.append('g')
                .attr('class', 'x-axis')
                .attr('transform', 'translate(0,' + height + ')')
                .call(d3.axisBottom(xScale));

            g.append('g')
                .attr('class', 'y-axis')
                .call(d3.axisLeft(yScale).tickFormat(d3.format(',f')));

            // Add y-axis label
            g.append('text')
                .attr('transform', 'rotate(-90)')
                .attr('y', 0 - margin.left)
                .attr('x', 0 - (height / 2))
                .attr('dy', '1em')
                .style('text-anchor', 'middle')
                .text(yLabel);
        }


        function updateDonutChart(dataset, selectedChart, targetDivContainer, legendContainer, chartTitle) {
            let legendChart = renderLegend(dataset, legendContainer);
            let donutContainer = d3.select('.' + targetDivContainer);
            let containerWidth = donutContainer.node() ? donutContainer.node().getBoundingClientRect().width : false;

            if (!containerWidth) {
                return;
            }

            // Clear previous chart
            donutContainer.selectAll('*').remove();

            let width = containerWidth;
            let height = containerWidth;
            let externalRadius = containerWidth / 2.5;
            let internalRadius = containerWidth / 5;

            // Create tooltip
            let tooltipDiv = d3.select('body').selectAll('.donut-tooltip').data([0]);
            let tooltipEnter = tooltipDiv.enter().append('div')
                .attr('class', 'donut-tooltip')
                .style('position', 'absolute')
                .style('padding', '8px')
                .style('background', 'rgba(0, 0, 0, 0.8)')
                .style('color', '#fff')
                .style('border-radius', '4px')
                .style('font-size', '12px')
                .style('pointer-events', 'none')
                .style('opacity', 0)
                .style('z-index', 1000);

            let tooltip = tooltipDiv.merge(tooltipEnter);

            // Create pie generator
            let pie = d3.pie()
                .value(d => d.quantity || 0)
                .sort(null);

            // Create arc generator
            let arc = d3.arc()
                .innerRadius(internalRadius)
                .outerRadius(externalRadius);

            // Create highlighted arc (slightly larger)
            let arcHover = d3.arc()
                .innerRadius(internalRadius)
                .outerRadius(externalRadius + 5);

            // Create SVG
            let svg = donutContainer.append('svg')
                .attr('width', width)
                .attr('height', height);

            let g = svg.append('g')
                .attr('transform', `translate(${width / 2}, ${height / 2})`);

            // Create arcs
            let arcs = g.selectAll('.arc')
                .data(pie(dataset))
                .enter().append('g')
                .attr('class', 'arc');

            // Add paths
            arcs.append('path')
                .attr('d', arc)
                .attr('fill', (d, i) => KoaColorSchema[i % KoaColorSchema.length])
                .attr('stroke', 'white')
                .attr('stroke-width', 2)
                .style('cursor', 'pointer')
                .on('mouseover', function(event, d) {
                    // Highlight arc
                    d3.select(this)
                        .transition()
                        .duration(200)
                        .attr('d', arcHover);

                    // Highlight legend
                    if (legendChart) {
                        legendChart.highlight(d.data.id);
                    }

                    // Show tooltip
                    tooltip.transition()
                        .duration(200)
                        .style('opacity', 0.9);

                    let tooltipText = `<strong>${d.data.name}</strong><br/>`;
                    if (d.data.quantity !== undefined) {
                        tooltipText += `Quantity: ${d.data.quantity.toFixed(2)}<br/>`;
                    }
                    if (d.data.percentage !== undefined) {
                        tooltipText += `Percentage: ${d.data.percentage.toFixed(1)}%`;
                    }

                    tooltip.html(tooltipText)
                        .style('left', (event.pageX + 10) + 'px')
                        .style('top', (event.pageY - 28) + 'px');
                })
                .on('mousemove', function(event) {
                    tooltip
                        .style('left', (event.pageX + 10) + 'px')
                        .style('top', (event.pageY - 28) + 'px');
                })
                .on('mouseout', function(event, d) {
                    // Reset arc
                    d3.select(this)
                        .transition()
                        .duration(200)
                        .attr('d', arc);

                    // Clear legend highlight
                    if (legendChart) {
                        legendChart.clearHighlight();
                    }

                    // Hide tooltip
                    tooltip.transition()
                        .duration(500)
                        .style('opacity', 0);
                });

            // Add animation on load
            arcs.selectAll('path')
                .transition()
                .duration(750)
                .attrTween('d', function(d) {
                    let interpolate = d3.interpolate({startAngle: 0, endAngle: 0}, d);
                    return function(t) {
                        return arc(interpolate(t));
                    };
                });
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
                refreshTrendsChartByType('CPU', 'rf');
                refreshTrendsChartByType('Memory', 'rf');
            } else {
                $("#chart-block-trends-rf").hide();
                $("#chart-block-trends-hourly-usage").show();
                refreshTrendsChartByType('CPU', 'usage');
                refreshTrendsChartByType('Memory', 'usage');
                refreshGpuTrendsChart('cpu');
                refreshGpuTrendsChart('mem');
            }
        }


        function showCumulativeUsageByType() {
            cumulativeUsageType = $("#selected-cumulative-usage-type option:selected").val();
            if (cumulativeUsageType === 'monthly-usage') {
                $("#chart-block-daily").hide();
                $("#chart-block-monthly").show();
                refreshCumulativeChartByType('CPU', 'usage', 'monthly');
                refreshCumulativeChartByType('Memory', 'usage', 'monthly');
                refreshGpuCumulativeChart('cpu', 'monthly');
                refreshGpuCumulativeChart('mem', 'monthly');
            } else if (cumulativeUsageType === 'monthly-requests') {
                $("#chart-block-daily").hide();
                $("#chart-block-monthly").show();
                refreshCumulativeChartByType('CPU', 'requests', 'monthly');
                refreshCumulativeChartByType('Memory', 'requests', 'monthly');
                refreshGpuCumulativeChart('cpu', 'monthly');
                refreshGpuCumulativeChart('mem', 'monthly');
            } else if (cumulativeUsageType === 'daily-requests') {
                $("#chart-block-monthly").hide();
                $("#chart-block-daily").show();
                refreshCumulativeChartByType('CPU', 'requests', 'daily');
                refreshCumulativeChartByType('Memory', 'requests', 'daily');
                refreshGpuCumulativeChart('cpu', 'daily');
                refreshGpuCumulativeChart('mem', 'daily');
            } else { // handle as daily-usage
                $("#chart-block-monthly").hide();
                $("#chart-block-daily").show();
                refreshCumulativeChartByType('CPU', 'usage', 'daily');
                refreshCumulativeChartByType('Memory', 'usage', 'daily');
                refreshGpuCumulativeChart('cpu', 'daily');
                refreshGpuCumulativeChart('mem', 'daily');
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


        function exportImage(chartContainerClass, filename) {
            let svgElement = d3Selection.select('.' + chartContainerClass + ' svg').node();

            if (!svgElement) {
                console.error('SVG element not found for export');
                return;
            }

            // Clone the SVG element
            let clonedSvg = svgElement.cloneNode(true);

            // Add XML namespace if not present
            if (!clonedSvg.getAttribute('xmlns')) {
                clonedSvg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
            }

            // Serialize the SVG
            let serializer = new XMLSerializer();
            let svgString = serializer.serializeToString(clonedSvg);

            // Create blob and download link
            let blob = new Blob([svgString], {type: 'image/svg+xml'});
            let url = URL.createObjectURL(blob);

            // Create temporary link and trigger download
            let link = document.createElement('a');
            link.href = url;
            link.download = filename;
            document.body.appendChild(link);
            link.click();

            // Cleanup
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
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
                    showError(`Failed loading backend config (${xhr.status} error)`);
                    if (thrownError) {
                        console.error('Backend config error:', thrownError);
                    }
                }
            });
        }


        function refreshTrendsChartByType(resourceType, trendType) {
            let resourceTypeLowered = resourceType.toLowerCase();
            let dataFile = `${resourceTypeLowered}_${trendType}_trends.json`;
            let datasetPath = `${FrontendApi.DATA_DIR}/${dataFile}`;

            $.ajax({
                type: "GET",
                url: datasetPath,
                dataType: 'json',
                success: function (data) {
                    let chartCategory = `${resourceTypeLowered}-${trendType}`;
                    let chartContainerClass = `js-chart-trends-${chartCategory}`;
                    installExporter(`trends-${resourceTypeLowered}-png`, '', () => exportImage(chartContainerClass, 'kopex-trends-' + chartCategory + '.svg'));
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
                            updateLineOrAreaChart(dataset, chartContainerClass, resourceType, trendType);
                            $("#error-message-container").hide();
                        } else {
                            showError('No trends data found in the selected range', true);
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
                            updateLineOrAreaChart(dataset, `js-chart-trends-${chartCategory}`, resourceType, trendType);
                            $("#error-message-container").hide();
                        } else {
                            showError('No trends data found in the selected range', true);
                        }
                    }

                },
                error: function (xhr, ajaxOptions, thrownError) {
                    showError(`Error ${xhr.status} downloading data file ${dataFile}`);
                    if (thrownError) {
                        console.error('Trends chart error:', thrownError);
                    }
                }
            });
        }


        function refreshCumulativeChartByType(resourceType, usageType, periodType) {
            let resourceTypeLowered = resourceType.toLowerCase();
            let DATASET_FILES = Object.freeze({
                "daily-usage": `${resourceTypeLowered}_usage_period_1209600.json`,
                "daily-requests": `${resourceTypeLowered}_requests_period_1209600.json`,
                "monthly-usage": `${resourceTypeLowered}_usage_period_31968000.json`,
                "monthly-requests": `${resourceTypeLowered}_requests_period_31968000.json`,
            });

            let dataSetKey = (periodType+'-'+usageType).toLowerCase();
            let filenamePrefix = 'kopex-' + resourceTypeLowered + '-' + dataSetKey;
            let dataFile = DATASET_FILES[dataSetKey];
            $.ajax({
                type: "GET",
                url: `${FrontendApi.DATA_DIR}/${dataFile}`,
                dataType: 'json',
                success: function (data) {
                    let chartContainerClass = `js-chart-${periodType}-${resourceTypeLowered}-usage`;
                    installExporter(`consolidated-${resourceTypeLowered}-usage-png`, '', () => exportImage(chartContainerClass, filenamePrefix + '.svg'));
                    installExporter(`consolidated-${resourceTypeLowered}-usage-json`, filenamePrefix + '.json', () => exportJSON(data));
                    installExporter(`consolidated-${resourceTypeLowered}-usage-csv`, filenamePrefix + '.csv', () => exportCSV(data));

                    updateStackedBarChart({"data": data},
                        chartContainerClass,
                        `${resourceType} consumption`,
                        `${periodType} ${resourceType} ${usageType}`);
                },
                error: function (xhr, ajaxOptions, thrownError) {
                    showError(`Error ${xhr.status} downloading data file ${dataFile}`);
                    if (thrownError) {
                        console.error('Cumulative chart error:', thrownError);
                    }
                }
            });
        }


        function refreshGpuTrendsChart(resourceType) {
            let dataFile = `gpu_${resourceType}_usage_trends.json`;
            let datasetPath = `${FrontendApi.DATA_DIR}/${dataFile}`;

            $.ajax({
                type: "GET",
                url: datasetPath,
                dataType: 'json',
                success: function (data) {
                    let chartContainerClass = `js-chart-trends-gpu-${resourceType}-usage`;

                    let filterDate1 = $("#filter-start-date").val();
                    let filterDate2 = $('#filter-end-date').val();
                    if (filterDate1 > filterDate2) {
                        let df = filterDate1;
                        filterDate1 = filterDate2;
                        filterDate2 = df;
                    }

                    const dataset = data.filter(item => (item.dateUTC >= filterDate1 && item.dateUTC <= filterDate2))
                        .map(({name, usage, dateUTC}) => ({
                            name: name.replace('__gpu', ''),
                            date: dateUTC,
                            value: usage
                        }));

                    if (dataset.length > 0) {
                        updateLineOrAreaChart(dataset, chartContainerClass, `GPU ${resourceType.toUpperCase()}`, 'usage');
                        $("#error-message-container").hide();
                    } else {
                        showError('No GPU trends data found in the selected range', true);
                    }
                },
                error: function (xhr, ajaxOptions, thrownError) {
                    showError(`Error ${xhr.status} downloading GPU data file ${dataFile}`);
                    if (thrownError) {
                        console.error('GPU trends chart error:', thrownError);
                    }
                }
            });
        }


        function refreshGpuCumulativeChart(resourceType, periodType) {
            let GPU_DATASET_FILES = Object.freeze({
                "daily": `gpu_${resourceType}_usage_period_1209600.json`,
                "monthly": `gpu_${resourceType}_usage_period_31968000.json`,
            });

            let dataFile = GPU_DATASET_FILES[periodType];
            let chartContainerClass = `js-chart-${periodType}-gpu-${resourceType}-usage`;

            $.ajax({
                type: "GET",
                url: `${FrontendApi.DATA_DIR}/${dataFile}`,
                dataType: 'json',
                success: function (data) {
                    updateStackedBarChart({"data": data},
                        chartContainerClass,
                        `GPU ${resourceType.toUpperCase()} consumption`,
                        `${periodType} GPU ${resourceType.toUpperCase()} usage`);
                },
                error: function (xhr, ajaxOptions, thrownError) {
                    showError(`Error ${xhr.status} downloading GPU data file ${dataFile}`);
                    if (thrownError) {
                        console.error('GPU cumulative chart error:', thrownError);
                    }
                }
            });
        }


        function updateAllCharts() {
            clearErrors();
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
                .on('mousemove', function(event) {
                    tooltipDiv.style('left', (event.pageX + 10) + 'px')
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
                .attr('text-anchor', 'middle')
                .attr('dominant-baseline', 'middle')
                .style('font-size', '14px')
                .style('font-weight', 'bold')
                .style('fill', '#ffffff')
                .style('pointer-events', 'none')
                .text(d => d.name.length > 10 ? d.name.substring(0, 10) + '...' : d.name);

            // Add usage percentage text
            nodeGroups.append('text')
                .attr('class', 'node-usage-text')
                .attr('x', d => (Math.min(d.rectSize || maxRectSize, maxRectSize)) / 2)
                .attr('y', d => (Math.min(d.rectSize || maxRectSize, maxRectSize)) / 2 + 15)
                .attr('text-anchor', 'middle')
                .attr('dominant-baseline', 'middle')
                .style('font-size', '13px')
                .style('fill', '#ffffff')
                .style('pointer-events', 'none')
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
                        for (let [nname, _] of dataset.data) {
                            let nodeCssId = getNodeCssId(nname);
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
                                null,
                                getNodeCssClass(nodeCssId),
                                getNodeLegendCssClass(nodeCssId)
                            );
                        }
                    },
                    error: function (xhr, ajaxOptions, thrownError) {
                        showError(`Error ${xhr.status} downloading node data`);
                        if (thrownError) {
                            console.error('Node data error:', thrownError);
                        }
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
