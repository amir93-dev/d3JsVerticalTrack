const LogarithmicTrackComponent = {
  setChartSeriesData: function (
    chart,
    _data,
    xAxisInterval,
    isRangeFilled,
    xAxisMin,
    xAxisMax,
    yAxisInterval,
    yAxisMinRange,
    yAxisMaxRange,
    chartWidth,
    isCurveEditor
  ) {
    if (chart != undefined && chart != null) {
      let data = JSON.parse(_data);
      let _series = [];
    }
  },
  setChartProps: function (
    chartId,
    height,
    width,
    xAxisVisible,
    xAxisInterval,
    yAxisVisible,
    yAxisInterval,
    yAxisMinRange,
    yAxisMaxRange,
    allowSelection,
    allowZooming,
    xAxisLabelPosition,
    edgeLabelPlacement
  ) {
    let _width = parseInt(width);
    let _height = parseInt(height);
    document.getElementById(chartId).innerHTML = '';
    let div = document.getElementById(chartId);
    // Create the SVG element
    let svgEle = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    // Set the width and height attributes
    svgEle.setAttribute('width', width);
    svgEle.setAttribute('height', height);
    // Optionally, set other attributes such as style or class
    svgEle.style.border = '1px solid #b5b5b5'; // For visibility
    // Append the SVG to the div
    div.appendChild(svgEle);

    const margin = { top: -1, right: 0, bottom: 0, left: -1 };
    width = width - margin.left - margin.right;
    height = height - margin.top - margin.bottom;

    let svg, x, y, areaPath;
    svg = d3
      .select('#' + chartId + ' > svg')
      .attr('width', width + margin.left + margin.right)
      .attr('height', height + margin.top + margin.bottom)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // Define the scales
    //x = d3.scaleLinear().range([0, width]);
    //y = d3.scaleLinear().range([height, 0]);

    // Add x-axis
    svg
      .append('g')
      .attr('class', 'x axis')
      .attr('transform', `translate(0,${height})`);
    //.call(d3.axisBottom(x).tickFormat(""));

    // Add y-axis
    svg.append('g').attr('class', 'y axis');
    //.call(d3.axisLeft(y).tickFormat(""));

    areaPath = svg.append('path').attr('class', 'area');
    return { svg, areaPath };
  },
};
