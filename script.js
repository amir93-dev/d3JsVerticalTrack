/* =========================================================
   CONFIGURATION
========================================================= */

const CONFIG = {
  name: 'logrithmic-Chart',
  width: 250,
  height: 600,
  border: true,
  enableSelection: true,
  margin: { top: 10, right: 0, bottom: 0, left: 10 },

  xAxis: {
    min: 1,
    max: 100000,
    scaleType: 'log', // "log" | "linear"
    showTicks: false,
    showLabels: false,
    showGrid: true,
    isOpposite: false,
  },

  yAxis: {
    min: 1000,
    max: 16000,
    interval: 20,
    isInvers: true,
    show: false,
  },

  zoom: {
    min: 1,
    max: 50,
    enable: true,
  },
  chartBorder: {
    show: true,
    color: '#8c8c8c',
    width: 1,
  },
};

if (CONFIG.yAxis.show) {
  CONFIG.margin.left = CONFIG.margin.left + 50;
}
if (CONFIG.xAxis.showTicks || CONFIG.xAxis.showLabels) {
  CONFIG.margin.top = CONFIG.margin.top + 20;
}

let seriesData = _data;
/* =====================================================
   SVG
===================================================== */
const container = d3.select('#' + CONFIG.name);
let svg = container
  .append('svg')
  .attr('width', CONFIG.width)
  .attr('height', CONFIG.height);

if (CONFIG.chartBorder.show) {
  svg
    .insert('rect', ':first-child') // ensure it's behind everything
    .attr('class', 'chart-border')
    .attr('x', CONFIG.margin.left)
    .attr('y', CONFIG.margin.top)
    .attr('width', CONFIG.width - CONFIG.margin.left - CONFIG.margin.right)
    .attr('height', CONFIG.height - CONFIG.margin.top - CONFIG.margin.bottom)
    .attr('fill', 'none')
    .attr('stroke', CONFIG.chartBorder.color)
    .attr('stroke-width', CONFIG.chartBorder.width)
    .attr('shape-rendering', 'crispEdges');
}
/* =====================================================
   SCALES (X SWITCHABLE)
===================================================== */

let xScale =
  CONFIG.xAxis.scaleType === 'log'
    ? d3
        .scaleLog()
        .domain([CONFIG.xAxis.min, CONFIG.xAxis.max])
        .range([CONFIG.margin.left, CONFIG.width])
    : d3
        .scaleLinear()
        .domain([CONFIG.xAxis.min, CONFIG.xAxis.max])
        .range([CONFIG.margin.left, CONFIG.width]);

let yBase = CONFIG.yAxis.isInvers
  ? d3
      .scaleLinear()
      .domain([CONFIG.yAxis.max, CONFIG.yAxis.min])
      .range([CONFIG.height, CONFIG.margin.top])
  : d3
      .scaleLinear()
      .domain([CONFIG.yAxis.min, CONFIG.yAxis.max])
      .range([CONFIG.height, CONFIG.margin.top]);

let yCurrent = yBase.copy();

/* =====================================================
   AXES
===================================================== */

let xAxis = CONFIG.xAxis.isOpposite
  ? d3.axisBottom(xScale)
  : d3.axisTop(xScale);

if (!CONFIG.xAxis.showTicks) xAxis.tickSize(0);
if (!CONFIG.xAxis.showLabels) xAxis.tickFormat('');

if (CONFIG.xAxis.showTicks) {
  let position = CONFIG.xAxis.isOpposite ? CONFIG.height : CONFIG.margin.top;
  svg.append('g').attr('transform', `translate(0,${position})`).call(xAxis);
}
let yAxisG = undefined;
if (CONFIG.yAxis.show) {
  let yAxis = d3.axisLeft(yCurrent);
  yAxis.tickSize(5);
  yAxisG = svg
    .append('g')
    .attr('class', 'axis')
    .attr('transform', `translate(${CONFIG.margin.left},0)`)
    .call(yAxis);
} else {
}

/* =====================================================
   CLIP
===================================================== */

svg
  .append('defs')
  .append('clipPath')
  .attr('id', 'clip')
  .append('rect')
  .attr('x', CONFIG.margin.left)
  .attr('y', CONFIG.margin.top)
  .attr('width', CONFIG.width)
  .attr('height', CONFIG.height);

/* =====================================================
   LAYERS
===================================================== */
let xGridLayer = svg.append('g').attr('clip-path', 'url(#clip)');
let gridLayer = svg.append('g').attr('clip-path', 'url(#clip)');
let contentLayer = svg.append('g').attr('clip-path', 'url(#clip)');
/* =====================================================
   DRAW FUNCTIONS
===================================================== */

function drawDepthGrid(scale) {
  let ticks = scale.ticks(CONFIG.yAxis.interval);
  let grid = gridLayer.selectAll('.depth-grid').data(ticks, (d) => d);

  grid
    .enter()
    .append('line')
    .attr('class', 'depth-grid')
    .merge(grid)
    .attr('x1', CONFIG.margin.left)
    .attr('x2', CONFIG.width)
    .attr('y1', (d) => scale(d))
    .attr('y2', (d) => scale(d));

  grid.exit().remove();
}

function drawSeries(scale) {
  contentLayer.selectAll('.series').remove();

  seriesData.forEach((curve) => {
    if (curve.type === 'Line') {
      let line = d3
        .line()
        .defined((d) => d.y != null)
        .x((d) => xScale(d.y))
        .y((d) => scale(d.x));

      for (let i = 0; i < curve.dataSource.length - 1; i++) {
        if (
          curve.dataSource[i].y != null &&
          curve.dataSource[i + 1].y != null
        ) {
          contentLayer
            .append('path')
            .attr('class', 'series')
            .datum([curve.dataSource[i], curve.dataSource[i + 1]])
            .attr('d', line)
            .attr('stroke', curve.fill)
            .attr('stroke-width', curve.width)
            .attr('fill', 'none');
        }
      }
    }

    if (curve.type === 'StepArea') {
      let area = d3
        .area()
        .defined((d) => d.y != null)
        .x0(CONFIG.margin.left)
        .x1((d) => xScale(d.y))
        .y((d) => scale(d.x));

      contentLayer
        .append('path')
        .attr('class', 'series')
        .datum(curve.dataSource)
        .attr('d', area)
        .attr('fill', curve.fill)
        .attr('opacity', curve.opacity);
    }
  });
}

function drawXGrid() {
  if (!CONFIG.xAxis.showGrid) return;

  let { major, minor } = getXGridTicks(
    CONFIG.xAxis.scaleType,
    CONFIG.xAxis.min,
    CONFIG.xAxis.max
  );

  // ---- MINOR ----
  xGridLayer
    .selectAll('.x-grid-minor')
    .data(minor)
    .enter()
    .append('line')
    .attr('class', 'x-grid-minor')
    .attr('x1', (d) => xScale(d))
    .attr('x2', (d) => xScale(d))
    .attr('y1', CONFIG.margin.top)
    .attr('y2', CONFIG.height)
    .attr('stroke', '#e5e5e5')
    .attr('stroke-width', 0.5)
    .attr('shape-rendering', 'crispEdges');

  // ---- MAJOR ----
  xGridLayer
    .selectAll('.x-grid-major')
    .data(major)
    .enter()
    .append('line')
    .attr('class', 'x-grid-major')
    .attr('x1', (d) => xScale(d))
    .attr('x2', (d) => xScale(d))
    .attr('y1', CONFIG.margin.top)
    .attr('y2', CONFIG.height)
    .attr('stroke', '#b5b5b5')
    .attr('stroke-width', 1)
    .attr('shape-rendering', 'crispEdges');
}

function getXGridTicks(scaleType, min, max) {
  if (scaleType === 'log') {
    let major = [];
    let minor = [];

    let start = Math.floor(Math.log10(min));
    let end = Math.ceil(Math.log10(max));

    for (let e = start; e <= end; e++) {
      let decade = Math.pow(10, e);
      if (decade >= min && decade <= max) major.push(decade);

      // 7 minor divisions per decade
      [2, 3, 4, 5, 6, 7, 8].forEach((m) => {
        let v = m * decade;
        if (v >= min && v <= max) minor.push(v);
      });
    }
    return { major, minor };
  }

  // LINEAR
  let ticks = d3.scaleLinear().domain([min, max]).ticks(10);

  return { major: ticks, minor: [] };
}

/* =====================================================
   INITIAL DRAW
===================================================== */

drawDepthGrid(yCurrent);
drawSeries(yCurrent);
drawXGrid();
/* =====================================================
   Y-AXIS TRACK SELECTION (PROPER DEPTH)
===================================================== */
if (CONFIG.enableSelection) {
  let brush = d3
    .brushY()
    .extent([
      [CONFIG.margin.left, CONFIG.margin.top],
      [CONFIG.width, CONFIG.height],
    ])
    .on('end', (e) => {
      if (!e.selection) return;

      let [y1, y2] = e.selection.map(yCurrent.invert);
      console.log('Selected depth range:', y1.toFixed(2), y2.toFixed(2));
    });
  contentLayer.append('g').attr('class', 'brush').call(brush);
}

/* =====================================================
   ZOOM (Y ONLY, NO PAN)
===================================================== */
if (CONFIG.zoom.enable) {
  let scrollbar = null,
    handle = null,
    toolbar = null;

  const yScrollbar = d3
    .scaleLinear()
    .domain(yBase.domain())
    .range([0, CONFIG.height]);

  const zoom = d3
    .zoom()
    .scaleExtent([CONFIG.zoom.min, CONFIG.zoom.max])
    .filter((e) => e.type === 'wheel' || e.type === 'dblclick')
    .translateExtent([
      [0, 0],
      [CONFIG.width, CONFIG.height],
    ])
    .extent([
      [0, 0],
      [CONFIG.width, CONFIG.height],
    ])
    .on('zoom', zoomed);

  svg.call(zoom);

  // Zoom handler
  function zoomed(event) {
    yCurrent = event.transform.rescaleY(yBase);
    if (CONFIG.yAxis.show) {
      yAxisG.call(d3.axisLeft(yCurrent));
    }
    initializeScroll(event.transform.k > 1);
    drawXGrid();
    drawDepthGrid(yCurrent);
    drawSeries(yCurrent);
    if (handle != null) {
      const [d0, d1] = yCurrent.domain();
      handle
        .attr('y', yScrollbar(d0))
        .attr('height', yScrollbar(d1) - yScrollbar(d0));
    }
  }

  function initializeScroll(enable) {
    if (enable) {
      if (scrollbar == null) {
        scrollbar = container
          .append('svg')
          .attr('width', 16)
          .attr('transform', `translate(0,${CONFIG.margin.top})`)
          .attr('height', CONFIG.height - CONFIG.margin.top);

        if (handle == null) {
          handle = scrollbar
            .append('rect')
            .attr('x', 0)
            .attr('width', 16)
            .attr('fill', '#ccc')
            .attr('y', 0)
            .attr('height', CONFIG.height - CONFIG.margin.top);

          let drag = d3.drag().on('drag', function (event) {
            let dy = event.dy;
            svg.call(zoom.translateBy, 0, dy);
          });
          handle.call(drag);
        }
      }
    } else {
      if (scrollbar != null) {
        scrollbar.remove();
        scrollbar = null;
        handle.remove();
        handle = null;
      }
    }
    initializeToolbar(enable);
  }
  // Scrollbar drag = zoom
  function initializeToolbar(enable) {
    if (enable) {
      if (toolbar == null) {
        toolbar = container.append('div').attr('class', 'toolbar');
        // Zoom In
        toolbar
          .append('button')
          .attr('id', 'zoomIn')
          .text('+')
          .on('click', () => {
            svg.transition().call(zoom.scaleBy, 1.2);
          });

        // Zoom Out
        toolbar
          .append('button')
          .attr('id', 'zoomOut')
          .text('−')
          .on('click', () => {
            svg.transition().call(zoom.scaleBy, 0.8);
          });

        // Reset
        toolbar
          .append('button')
          .attr('id', 'reset')
          .text('Reset')
          .on('click', () => {
            svg.transition().call(zoom.transform, d3.zoomIdentity);
          });
      }
    } else {
      toolbar.remove();
      toolbar = null;
    }
  }
}
