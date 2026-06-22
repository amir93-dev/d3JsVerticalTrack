const LogarithmicTrackComponent = (() => {
  /* =====================================================
      UTILITIES
  ===================================================== */
  let yCurrent = null;

  function splitDefinedSegments(data, accessor) {
    const segments = [];
    let seg = [];
    for (let i = 0; i < data.length; i++) {
      const v = accessor(data[i]);
      if (v == null || isNaN(v)) {
        if (seg.length > 1) segments.push(seg);
        seg = [];
      } else {
        seg.push(data[i]);
      }
    }
    if (seg.length > 1) segments.push(seg);
    return segments;
  }

  function createClip(svg, id, cfg) {
    svg
      .append('defs')
      .append('clipPath')
      .attr('id', id)
      .append('rect')
      .attr('x', cfg.margin.left)
      .attr('y', cfg.margin.top)
      .attr('width', cfg.width - cfg.margin.left - cfg.margin.right)
      .attr('height', cfg.height - cfg.margin.top - cfg.margin.bottom);
  }

  /* =====================================================
      GRID TICKS
  ===================================================== */

  function getXGridTicks(scaleType, min, max) {
    if (scaleType === 'log') {
      const major = [],
        minor = [];
      const start = Math.floor(Math.log10(min));
      const end = Math.ceil(Math.log10(max));
      for (let e = start; e <= end; e++) {
        const decade = Math.pow(10, e);
        if (decade >= min && decade <= max) major.push(decade);
        [2, 3, 4, 5, 6, 7, 8].forEach((m) => {
          const v = m * decade;
          if (v >= min && v <= max) minor.push(v);
        });
      }
      return { major, minor };
    }
    return { major: d3.scaleLinear().domain([min, max]).ticks(10), minor: [] };
  }

  /* =====================================================
      FIXED Y GRID GENERATOR (NEW)
  ===================================================== */

  function getFixedYPixelGrid(cfg) {
    const plotTop = cfg.margin.top;
    const plotBottom = cfg.height - cfg.margin.bottom;
    const majorStepPx = cfg.yAxis.interval; //((cfg.yAxis.max - cfg.yAxis.min) / cfg.yAxis.interval);//cfg.yAxis.interval + 10 || 80;
    const major = d3.range(
      cfg.yAxis.min,
      cfg.yAxis.max,
      (cfg.yAxis.max - cfg.yAxis.min) / cfg.yAxis.interval
    );
    //for (let y = plotTop; y <= plotBottom; y += majorStepPx) {
    //    major.push(y);
    //}
    return { major };
  }

  /* =====================================================
      CORE API
  ===================================================== */

  const api = {
    /* =====================================================
            CHART INIT
        ===================================================== */

    setChartProps(
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
      edgeLabelPlacement,
      enableMultipleYAxis = false
    ) {
      const config = {
        name: chartId,
        width: parseInt(width),
        height: parseInt(height),
        enableSelection: allowSelection,
        margin: { top: 0, right: 0, bottom: 0, left: 0 },

        xAxis: {
          min: yAxisMinRange,
          max: yAxisMaxRange,
          interval: yAxisInterval,
          scaleType: 'log', // 'log' | 'linear'
          showTicks: false,
          showLabels: false,
          showGrid: true,
          isOpposite: false,
        },

        yAxis: {
          min: 1,
          max: 10000,
          interval: xAxisInterval,
          isInverse: true,
          show: xAxisLabelPosition !== 0,
          enableMultiple: enableMultipleYAxis,

          /* NEW */
          majorGridPx: xAxisInterval + 10, // pixel spacing between major depth grid
          minorGridPx: 10, // pixel spacing between minor depth grid
        },

        zoom: {
          min: 1,
          max: 50,
          enable: allowZooming,
        },

        chartBorder: {
          show: true,
          color: '#8c8c8c',
          width: 0.5,
        },
      };

      if (config.yAxis.show) config.margin.left += 50;
      if (config.xAxis.showTicks || config.xAxis.showLabels)
        config.margin.top += 20;

      const randomId = '-' + randomNumber();
      const container = d3.select('#' + config.name);
      container.selectAll('*').remove();

      const svg = container
        .append('svg')
        .attr('width', config.width)
        .attr('height', config.height)
        .attr('viewBox', `0 0 ${config.width} ${config.height}`);
      if (config.yAxis.show) {
        svg.style('overflow', 'visible');
      }

      if (config.chartBorder.show) {
        svg
          .append('rect')
          .attr('class', 'chart-border')
          .attr('x', config.margin.left)
          .attr('y', config.margin.top)
          .attr(
            'width',
            config.width - config.margin.left - config.margin.right - 0.5
          )
          .attr(
            'height',
            config.height - config.margin.top - config.margin.bottom - 0.5
          )
          .attr('fill', 'none')
          .attr('stroke', config.chartBorder.color)
          .attr('stroke-width', config.chartBorder.width)
          .attr('shape-rendering', 'crispEdges');
      }

      createClip(svg, 'clip-' + config.name + randomId, config);

      /* ---------------- SCALES ---------------- */

      let xScale =
        config.xAxis.scaleType === 'log' ? d3.scaleLog() : d3.scaleLinear();

      xScale
        .domain([config.xAxis.min, config.xAxis.max])
        .range([config.margin.left, config.width - config.margin.right]);

      let yScale = d3
        .scaleLinear()
        .domain(
          config.yAxis.isInverse
            ? [config.yAxis.max, config.yAxis.min]
            : [config.yAxis.min, config.yAxis.max]
        )
        .range([config.height - config.margin.bottom, config.margin.top]);

      yCurrent = yScale.copy();

      /* ---------------- AXES ---------------- */

      let yAxisGroup = null;
      if (config.yAxis.show) {
        yAxisGroup = svg
          .append('g')
          .attr('class', 'y-axis')
          .attr('transform', `translate(${config.margin.left},0)`)
          .call(d3.axisLeft(yCurrent));
      }

      if (config.xAxis.showTicks || config.xAxis.showLabels) {
        let xAxis = config.xAxis.isOpposite
          ? d3.axisBottom(xScale)
          : d3.axisTop(xScale);
        if (!config.xAxis.showTicks) xAxis.tickSize(0);
        if (!config.xAxis.showLabels) xAxis.tickFormat('');
        svg
          .append('g')
          .attr(
            'transform',
            `translate(0,${
              config.xAxis.isOpposite ? config.height : config.margin.top
            })`
          )
          .call(xAxis);
      }

      /* ---------------- LAYERS ---------------- */

      const xGridLayer = svg
        .append('g')
        .attr('clip-path', `url(#clip-${config.name + randomId})`);
      const yGridLayer = svg
        .append('g')
        .attr('clip-path', `url(#clip-${config.name + randomId})`);
      const contentLayer = svg
        .append('g')
        .attr('clip-path', `url(#clip-${config.name + randomId})`);
      const brushLayer = svg
        .append('g')
        .attr('clip-path', `url(#clip-${config.name + randomId})`);

      api.drawXGrid(config, xGridLayer, xScale);
      api.drawFixedYGrid(config, yGridLayer, yScale);
      api.drawYLable(config, yAxisGroup, yScale);
      api.enableTrackSelection(config, brushLayer, yScale);

      return {
        config,
        container,
        svg,
        contentLayer,
        xGridLayer,
        yGridLayer,
        brushLayer,
        xScale,
        yScale,
        yAxisGroup,
        yCurrent,
      };
    },

    /* =====================================================
            SERIES SET
        ===================================================== */

    setChartSeriesData(
      chart,
      _data,
      xAxisInterval,
      xAxisMinRange,
      xAxisMaxRange,
      yAxisInterval,
      yAxisMinRange,
      yAxisMaxRange,
      isCurveEditor
    ) {
      if (!chart) return;

      const data = JSON.parse(_data);
      const cfg = chart.config;
      const xScale = chart.xScale;
      const yScale = chart.yScale;

      /* ----------- AXIS DOMAIN UPDATE ----------- */

      if (
        yAxisInterval != null &&
        yAxisMinRange != null &&
        yAxisMaxRange != null
      ) {
        xScale.domain([yAxisMinRange, yAxisMaxRange]);
        cfg.xAxis.min = yAxisMinRange;
        cfg.xAxis.max = yAxisMaxRange;
      }

      if (
        xAxisInterval != null &&
        xAxisMinRange != null &&
        xAxisMaxRange != null
      ) {
        yScale.domain([xAxisMaxRange, xAxisMinRange]);
        cfg.yAxis.min = xAxisMinRange;
        cfg.yAxis.max = xAxisMaxRange;
        cfg.yAxis.interval = xAxisInterval; // (xAxisMaxRange - xAxisMinRange) / xAxisInterval;
      } else {
        const allX = data.flatMap((d) => d.Data.map((p) => p.x));
        const ymin = d3.min(allX);
        const ymax = d3.max(allX);
        yScale.domain([ymax, ymin]);
        cfg.yAxis.min = ymin;
        cfg.yAxis.max = ymax;
        cfg.yAxis.interval = xAxisInterval; //(ymax - ymin) / xAxisInterval;
      }

      yCurrent = yScale.copy();

      /* ----------- SERIES NORMALIZATION ----------- */

      const series = [];
      data.forEach((e) => {
        if (e.IsVisible || isCurveEditor) {
          if (e.Data && e.Data.length) {
            series.push({
              type: e.IsColorZone ? 'MultiColoredLine' : e.ChartTypeName,
              shape: e.CurveStyleName,
              data: e.Data,
              fill: e.IsColorZone ? 'transparent' : e.FillColor,
              opacity:
                e.ChartTypeName === 'Area'
                  ? 0.7
                  : e.CurveStyleName === 'HistogramEmpty'
                  ? 0
                  : e.CurveStyleName === 'Histogram'
                  ? 0.7
                  : e.Opacity,
              width: e.Width || 1.5,
              ZOrder: e.ZOrder || 0,
            });
          }
        }
      });

      api.enableZoom(
        cfg,
        series,
        chart.container,
        chart.svg,
        chart.contentLayer,
        chart.xGridLayer,
        chart.yGridLayer,
        yCurrent,
        chart.yAxisGroup,
        xScale
      );
      api.drawXGrid(cfg, chart.xGridLayer, xScale);
      api.drawFixedYGrid(cfg, chart.yGridLayer, yCurrent);
      api.drawYLable(cfg, chart.yAxisGroup, yCurrent);
      api.drawSeriesData(cfg, series, chart.contentLayer, xScale, yCurrent);

      if (cfg.zoom.enable) {
        d3.selectAll('.chart-toolbar #btn-reset-zoom')?.dispatch('click');
      }
    },

    /* =====================================================
            GRID DRAWING
        ===================================================== */

    drawXGrid(config, layer, xScale) {
      if (!config.xAxis.showGrid) return;
      layer.selectAll('.x-grid').remove();

      const { major, minor } = getXGridTicks(
        config.xAxis.scaleType,
        config.xAxis.min,
        config.xAxis.max
      );

      const all = [
        ...minor.map((v) => ({ v, cls: 'minor', w: 0.5 })),
        ...major.map((v) => ({ v, cls: 'major', w: 0.2 })),
      ];

      const lines = layer.selectAll('.x-grid').data(all, (d) => d.v + d.cls);

      lines
        .enter()
        .append('line')
        .attr('class', (d) => `x-grid ${d.cls}`)
        .merge(lines)
        .attr('x1', (d) => xScale(d.v))
        .attr('x2', (d) => xScale(d.v))
        .attr('y1', config.margin.top)
        .attr('y2', config.height - config.margin.bottom)
        .attr('stroke', '#787878')
        .attr('stroke-width', (d) => d.w)
        .attr('vector-effect', 'non-scaling-stroke')
        .attr('shape-rendering', 'crispEdges');

      lines.exit().remove();
    },

    /* =====================================================
          FIXED Y GRID (NEW)
      ===================================================== */

    drawFixedYGrid(config, layer, scale) {
      layer.selectAll('.y-grid').remove();
      const { major } = getFixedYPixelGrid(config);
      const all = [...major.map((y) => ({ y, cls: 'major', w: 0.5 }))];
      const lines = layer.selectAll('.y-grid').data(all);
      lines
        .enter()
        .append('line')
        .attr('class', (d) => `y-grid ${d.cls}`)
        .merge(lines)
        .attr('x1', config.margin.left)
        .attr('x2', config.width - config.margin.right)
        .attr('y1', (d) => scale(d.y))
        .attr('y2', (d) => scale(d.y))
        .attr('stroke', '#787878')
        .attr('stroke-width', (d) => d.w)
        .attr('vector-effect', 'non-scaling-stroke')
        .attr('shape-rendering', 'crispEdges');
      lines.exit().remove();
    },

    drawYLable(config, axisGroup, scale) {
      if (!axisGroup) return;
      const { major } = getFixedYPixelGrid(config);
      let axis = d3.axisLeft(scale).tickValues(major);
      axisGroup.selectAll('path,line').attr('stroke', '#787878');
      axisGroup.call(axis);
    },

    /* =====================================================
            SERIES DRAWING (OPTIMIZED)
        ===================================================== */

    drawSeriesData(config, series, layer, xScale, yScale) {
      layer.selectAll('.series').remove();
      layer.selectAll('.series-root').remove();
      const g = layer.append('g').attr('class', 'series-root');

      series.forEach((curve) => {
        const data = curve.data;

        /* -------- LINE -------- */
        if (curve.type === 'Line') {
          const segments = splitDefinedSegments(data, (d) => d.y);
          const line = d3
            .line()
            .x((d) => (!isNaN(xScale(d.y)) ? xScale(d.y) : -100))
            .y((d) => (!isNaN(yScale(d.x)) ? yScale(d.x) : -100));

          g.selectAll(null)
            .data(segments)
            .enter()
            .append('path')
            .attr('class', 'series line')
            .attr('d', line)
            .attr('stroke', curve.fill)
            .attr('stroke-width', curve.width)
            .attr('fill', 'none')
            .attr('vector-effect', 'non-scaling-stroke');
        } else if (curve.type === 'Area') {
          /* -------- AREA -------- */
          const area = d3
            .area()
            .defined((d) => d.y != null)
            .x0(config.margin.left)
            .x1((d) => (!isNaN(xScale(d.y)) ? xScale(d.y) : -100))
            .y((d) => (!isNaN(yScale(d.x)) ? yScale(d.x) : -100));
          g.append('path')
            .attr('class', 'series area')
            .datum(data)
            .attr('d', area)
            .attr('fill', curve.fill)
            .attr('opacity', 0.5);
        } else if (
          /* -------- EMPTY HISTOGRAM -------- */
          curve.type === 'Histogram' &&
          curve.shape === 'HistogramEmpty'
        ) {
          const line = d3
            .line()
            .defined((d) => d.y != null)
            .x((d) => (!isNaN(xScale(d.y)) ? xScale(d.y) : -100))
            .y((d) => (!isNaN(yScale(d.x)) ? yScale(d.x) : -100))
            .curve(d3.curveStepAfter);

          g.append('path')
            .attr('class', 'series histogram-empty')
            .datum(data)
            .attr('d', line)
            .attr('stroke', curve.fill)
            .attr('stroke-width', 1.5)
            .attr('fill', 'none')
            .attr('vector-effect', 'non-scaling-stroke');
        } else if (curve.type === 'Histogram') {
          /* -------- HISTOGRAM -------- */
          const area = d3
            .area()
            .defined((d) => d.y != null)
            .x0(config.margin.left)
            .x1((d) => (!isNaN(xScale(d.y)) ? xScale(d.y) : -100))
            .y((d) => (!isNaN(yScale(d.x)) ? yScale(d.x) : -100))
            .curve(d3.curveStepAfter);

          g.append('path')
            .attr('class', 'series histogram')
            .datum(data)
            .attr('d', area)
            .attr('fill', curve.fill)
            .attr('opacity', curve.opacity);
        } else if (curve.type === 'MultiColoredLine') {
          /* -------- MULTI COLOR ZONES -------- */
          const segments = splitDefinedSegments(data, (d) => d.y);
          const zonesData = segments.map((seg) => ({
            color: seg[0].c,
            from: d3.min(seg, (d) => d.x),
            to: d3.max(seg, (d) => d.x),
          }));

          const zones = g
            .selectAll('.zone')
            .data(zonesData, (d) => d.from + '-' + d.to);
          zones
            .enter()
            .append('rect')
            .attr('class', 'zone')
            .merge(zones)
            .attr('x', config.margin.left)
            .attr('width', config.width - config.margin.right)
            .attr('y', (d) => yScale(d.from))
            .attr('height', (d) => Math.abs(yScale(d.from) - yScale(d.to)))
            .attr('fill', (d) => d.color)
            .attr('opacity', 0.4);

          zones.exit().remove();
        } else if (curve.type === 'Scatter') {
          /* -------- SCATTER -------- */
          const symbolScale = d3
            .scaleOrdinal()
            .domain(['Circle', 'Point', 'Diamond', 'Triangle', 'Square'])
            .range([
              d3.symbolCircle,
              d3.symbolCircle,
              d3.symbolDiamond,
              d3.symbolTriangle,
              d3.symbolSquare,
            ]);

          const symbol = d3
            .symbol()
            .type(symbolScale(curve.shape))
            .size(curve.shape === 'Point' ? 10 : 20);

          g.append('g')
            .attr('class', 'series scatter')
            .selectAll('path')
            .data(data.filter((d) => !isNaN(d.y) && !isNaN(xScale(d.y))))
            .enter()
            .append('path')
            .attr('d', symbol)
            .attr(
              'transform',
              (d) =>
                `translate(${isNaN(d.y) ? -100 : xScale(d.y)},${yScale(d.x)})`
            )
            .attr('fill', curve.fill)
            .attr('stroke', curve.fill)
            .attr('stroke-width', 0.1);
        }
      });
    },

    /* =====================================================
            TRACK SELECTION (BRUSH)
        ===================================================== */

    enableTrackSelection(config, brushLayer, yScale) {
      if (!config.enableSelection) return;
      const brush = d3
        .brushY()
        .extent([
          [config.margin.left, config.margin.top],
          [
            config.width - config.margin.right,
            config.height - config.margin.bottom,
          ],
        ])
        .on('end', (e) => {
          if (!e.selection) return;
          const [min, max] = e.selection.map(yCurrent.invert);
          ColorZoneEditorComponent?.addColorZone(
            +min.toFixed(2),
            +max.toFixed(2)
          );
          console.log('Selected depth:', min.toFixed(2), max.toFixed(2));
          brushG.call(brush.move, null);
        });
      const brushG = brushLayer.append('g').call(brush);
      brushLayer
        .selectAll('.selection')
        .attr('fill', 'rgba(0, 120, 215, 0.4)')
        .attr('stroke', '#0078d7');
    },

    /* =====================================================
            ZOOM + SCROLLBAR + TOOLBAR
        ===================================================== */

    enableZoom(
      config,
      seriesData,
      container,
      svg,
      contentLayer,
      xGridLayer,
      yGridLayer,
      yScale,
      yAxisGroup,
      xScale
    ) {
      if (!config.zoom.enable) return;

      let isSyncingScroll = false;
      let scrollbar = null,
        handle = null,
        toolbar = null;

      const zoom = d3
        .zoom()
        .scaleExtent([config.zoom.min, config.zoom.max])
        .translateExtent([
          [0, 0],
          [config.width, config.height],
        ])
        .extent([
          [0, 0],
          [config.width, config.height],
        ])
        .filter((e) => e.type === 'wheel' || e.type === 'dblclick')
        .on('zoom', zoomed);

      svg.call(zoom);

      function zoomed(event) {
        yCurrent = event.transform.rescaleY(yScale);
        api.drawXGrid(config, xGridLayer, xScale);
        api.drawFixedYGrid(config, yGridLayer, yCurrent);
        api.drawYLable(config, yAxisGroup, yCurrent);
        api.drawSeriesData(config, seriesData, contentLayer, xScale, yCurrent);
        initializeScrollbar(event.transform.k > 1);
        syncScrollbarFromZoom();
      }

      /* ---------- Scrollbar ---------- */

      function initializeScrollbar(enable) {
        if (!enable) {
          if (scrollbar) {
            scrollbar.remove();
            scrollbar = handle = null;
          }
          initializeToolbar(false);
          return;
        }

        if (scrollbar) return;

        scrollbar = container
          .append('svg')
          .attr('class', 'y-scrollbar')
          .attr('width', 10)
          .attr(
            'height',
            config.height - config.margin.top - config.margin.bottom
          )
          .style('position', 'absolute')
          .style('background', '#dadada');
        handle = scrollbar
          .append('rect')
          .attr('x', 0)
          .attr('width', 10)
          .attr('fill', '#162241')
          .attr('rx', 2)
          .attr('ry', 2);

        const drag = d3.drag().on('drag', (event) => {
          const dy = event.dy;
          svg.call(zoom.translateBy, 0, dy);
        });
        handle.call(drag);
        initializeToolbar(true);
      }

      function syncScrollbarFromZoom() {
        if (!handle) return;

        const full = yScale.domain();
        const cur = yCurrent.domain();

        const totalSpan = full[0] - full[1];
        const visibleSpan = cur[0] - cur[1];
        const offset = full[0] - cur[0];
        const ratio = offset / (totalSpan - visibleSpan);

        const trackH = config.height - config.margin.top - config.margin.bottom;
        const handleH = Math.max(20, trackH * (visibleSpan / totalSpan));

        isSyncingScroll = true;
        handle.attr('height', handleH).attr('y', ratio * (trackH - handleH));
        isSyncingScroll = false;
      }

      /* ---------- Toolbar ---------- */

      function initializeToolbar(enable) {
        if (!enable) {
          if (toolbar) {
            toolbar.remove();
            toolbar = null;
          }
          return;
        }

        if (toolbar) return;
        toolbar = container
          .append('div')
          .attr('class', 'chart-toolbar')
          .style('display', 'flex')
          .style('gap', '4px')
          .style('height', '20px')
          .style('position', 'relative')
          .style('top', '5px')
          .style('left', '-100px');

        toolbar
          .append('button')
          .attr('class', 'btn btn-outline-primary')
          .style('padding', '0px 4px')
          .style('line-height', '0')
          .text('+')
          .on('click', () => {
            svg.transition().call(zoom.scaleBy, 1.25);
          });

        toolbar
          .append('button')
          .attr('class', 'btn btn-outline-primary')
          .style('padding', '0px 4px')
          .style('line-height', '0')
          .text('−')
          .on('click', () => {
            const t = d3.zoomTransform(svg.node());
            if (t.k <= 1.01) {
              resetZoom();
            } else {
              svg.transition().call(zoom.scaleBy, 0.8);
            }
          });

        toolbar
          .append('button')
          .attr('id', 'btn-reset-zoom')
          .attr('class', 'btn btn-outline-primary')
          .style('padding', '0px 4px')
          .style('line-height', '0')
          .text('Reset')
          .on('click', resetZoom);
      }

      /* ---------- Reset ---------- */

      function resetZoom() {
        svg.transition().call(zoom.transform, d3.zoomIdentity);
      }
    },
  };

  return api;
})();

let _chart = LogarithmicTrackComponent.setChartProps(
  'logrithmic-Chart',
  '600px',
  '250px',
  true,
  20,
  true,
  1,
  0.1,
  10000,
  true,
  true,
  1,
  null,
  true
);
LogarithmicTrackComponent.setChartSeriesData(
  _chart,
  _data,
  10,
  10000,
  15766,
  1,
  0.1,
  100000,
  300,
  true
);

// const LogarithmicTrackComponent = (() => {
//   /* =====================================================
//       UTILITIES
//   ===================================================== */

//   function splitDefinedSegments(data, accessor) {
//     const segments = [];
//     let seg = [];
//     for (let i = 0; i < data.length; i++) {
//       const v = accessor(data[i]);
//       if (v == null || isNaN(v)) {
//         if (seg.length > 1) segments.push(seg);
//         seg = [];
//       } else {
//         seg.push(data[i]);
//       }
//     }
//     if (seg.length > 1) segments.push(seg);
//     return segments;
//   }

//   function createClip(svg, id, cfg) {
//     svg
//       .append('defs')
//       .append('clipPath')
//       .attr('id', id)
//       .append('rect')
//       .attr('x', cfg.margin.left)
//       .attr('y', cfg.margin.top)
//       .attr('width', cfg.width - cfg.margin.left - cfg.margin.right)
//       .attr('height', cfg.height - cfg.margin.top - cfg.margin.bottom);
//   }

//   /* =====================================================
//       GRID TICKS
//   ===================================================== */

//   function getXGridTicks(scaleType, min, max) {
//     if (scaleType === 'log') {
//       const major = [],
//         minor = [];
//       const start = Math.floor(Math.log10(min));
//       const end = Math.ceil(Math.log10(max));
//       for (let e = start; e <= end; e++) {
//         const decade = Math.pow(10, e);
//         if (decade >= min && decade <= max) major.push(decade);
//         [2, 3, 4, 5, 6, 7, 8].forEach((m) => {
//           const v = m * decade;
//           if (v >= min && v <= max) minor.push(v);
//         });
//       }
//       return { major, minor };
//     }
//     return { major: d3.scaleLinear().domain([min, max]).ticks(10), minor: [] };
//   }

//   /* =====================================================
//       CORE API
//   ===================================================== */

//   const api = {
//     /* =====================================================
//           CHART INIT
//       ===================================================== */

//     setChartProps(
//       chartId,
//       height,
//       width,
//       xAxisVisible,
//       xAxisInterval,
//       yAxisVisible,
//       yAxisInterval,
//       yAxisMinRange,
//       yAxisMaxRange,
//       allowSelection,
//       allowZooming,
//       xAxisLabelPosition,
//       edgeLabelPlacement,
//       enableMultipleYAxis = false
//     ) {
//       const config = {
//         name: chartId,
//         width: parseInt(width),
//         height: parseInt(height),
//         enableSelection: allowSelection,
//         margin: { top: 0, right: 0, bottom: 0, left: 0 },

//         xAxis: {
//           min: yAxisMinRange,
//           max: yAxisMaxRange,
//           interval: yAxisInterval,
//           scaleType: 'log', // 'log' | 'linear'
//           showTicks: false,
//           showLabels: false,
//           showGrid: true,
//           isOpposite: false,
//         },

//         yAxis: {
//           min: 1,
//           max: 10000,
//           interval: xAxisInterval,
//           isInverse: true,
//           show: xAxisLabelPosition !== 0,
//           enableMultiple: enableMultipleYAxis,
//         },

//         zoom: {
//           min: 1,
//           max: 50,
//           enable: allowZooming,
//         },

//         chartBorder: {
//           show: true,
//           color: '#8c8c8c',
//           width: 1,
//         },
//       };

//       if (config.yAxis.show) config.margin.left += 50;
//       if (config.xAxis.showTicks || config.xAxis.showLabels)
//         config.margin.top += 20;

//       const container = d3.select('#' + config.name);
//       container.selectAll('*').remove();

//       const svg = container
//         .append('svg')
//         .attr('width', config.width)
//         .attr('height', config.height)
//         .style('overflow', 'visible');

//       if (config.chartBorder.show) {
//         svg
//           .append('rect')
//           .attr('class', 'chart-border')
//           .attr('x', config.margin.left)
//           .attr('y', config.margin.top)
//           .attr(
//             'width',
//             config.width - config.margin.left - config.margin.right
//           )
//           .attr(
//             'height',
//             config.height - config.margin.top - config.margin.bottom
//           )
//           .attr('fill', 'none')
//           .attr('stroke', config.chartBorder.color)
//           .attr('stroke-width', config.chartBorder.width)
//           .attr('shape-rendering', 'crispEdges');
//       }

//       createClip(svg, 'clip-' + config.name, config);

//       /* ---------------- SCALES ---------------- */

//       let xScale =
//         config.xAxis.scaleType === 'log' ? d3.scaleLog() : d3.scaleLinear();

//       xScale
//         .domain([config.xAxis.min, config.xAxis.max])
//         .range([config.margin.left, config.width - config.margin.right]);

//       let yScale = d3
//         .scaleLinear()
//         .domain(
//           config.yAxis.isInverse
//             ? [config.yAxis.max, config.yAxis.min]
//             : [config.yAxis.min, config.yAxis.max]
//         )
//         .range([config.height - config.margin.bottom, config.margin.top]);

//       let yCurrent = yScale.copy();

//       /* ---------------- AXES ---------------- */

//       let yAxisGroup = null;
//       if (config.yAxis.show) {
//         yAxisGroup = svg
//           .append('g')
//           .attr('class', 'y-axis')
//           .attr('transform', `translate(${config.margin.left},0)`)
//           .call(d3.axisLeft(yCurrent));
//       }

//       if (config.xAxis.showTicks || config.xAxis.showLabels) {
//         let xAxis = config.xAxis.isOpposite
//           ? d3.axisBottom(xScale)
//           : d3.axisTop(xScale);
//         if (!config.xAxis.showTicks) xAxis.tickSize(0);
//         if (!config.xAxis.showLabels) xAxis.tickFormat('');
//         svg
//           .append('g')
//           .attr(
//             'transform',
//             `translate(0,${
//               config.xAxis.isOpposite ? config.height : config.margin.top
//             })`
//           )
//           .call(xAxis);
//       }

//       /* ---------------- LAYERS ---------------- */

//       const xGridLayer = svg
//         .append('g')
//         .attr('clip-path', `url(#clip-${config.name})`);
//       const yGridLayer = svg
//         .append('g')
//         .attr('clip-path', `url(#clip-${config.name})`);
//       const yAxisLayer = svg
//         .append('g')
//         .attr('clip-path', `url(#clip-${config.name})`);
//       const contentLayer = svg
//         .append('g')
//         .attr('clip-path', `url(#clip-${config.name})`);
//       const brushLayer = svg
//         .append('g')
//         .attr('clip-path', `url(#clip-${config.name})`);

//       api.drawXGrid(config, xGridLayer, xScale);
//       api.drawYGrid(config, yAxisLayer, yScale);
//       api.drawYLable(config, yAxisGroup, yScale);
//       api.enableTrackSelection(config, brushLayer, yScale);

//       return {
//         config,
//         container,
//         svg,
//         contentLayer,
//         xGridLayer,
//         yGridLayer,
//         yAxisLayer,
//         brushLayer,
//         xScale,
//         yScale,
//         yAxisGroup,
//         yCurrent,
//       };
//     },

//     /* =====================================================
//           SERIES SET
//       ===================================================== */

//     setChartSeriesData(
//       chart,
//       _data,
//       xAxisInterval,
//       xAxisMinRange,
//       xAxisMaxRange,
//       yAxisInterval,
//       yAxisMinRange,
//       yAxisMaxRange,
//       width,
//       isCurveEditor
//     ) {
//       if (!chart) return;

//       const data = JSON.parse(_data);
//       const cfg = chart.config;
//       const xScale = chart.xScale;
//       const yScale = chart.yScale;
//       const yAxisLayer = chart.yAxisLayer;

//       /* ----------- AXIS DOMAIN UPDATE ----------- */

//       if (
//         yAxisInterval != null &&
//         yAxisMinRange != null &&
//         yAxisMaxRange != null
//       ) {
//         xScale.domain([yAxisMinRange, yAxisMaxRange]);
//         cfg.xAxis.min = yAxisMinRange;
//         cfg.xAxis.max = yAxisMaxRange;
//       }

//       if (
//         xAxisInterval != null &&
//         xAxisMinRange != null &&
//         xAxisMaxRange != null
//       ) {
//         yScale.domain([xAxisMaxRange, xAxisMinRange]);
//         cfg.yAxis.min = xAxisMinRange;
//         cfg.yAxis.max = xAxisMaxRange;
//         cfg.yAxis.interval = (xAxisMaxRange - xAxisMinRange) / xAxisInterval;
//       } else {
//         const allX = data.flatMap((d) => d.Data.map((p) => p.x));
//         const ymin = d3.min(allX);
//         const ymax = d3.max(allX);
//         yScale.domain([ymax, ymin]);
//         cfg.yAxis.min = ymin;
//         cfg.yAxis.max = ymax;
//         cfg.yAxis.interval = (ymax - ymin) / xAxisInterval;
//       }

//       chart.yCurrent = yScale.copy();

//       /* ----------- SERIES NORMALIZATION ----------- */

//       const series = [];
//       data.forEach((e) => {
//         if (e.IsVisible || isCurveEditor) {
//           if (e.Data && e.Data.length) {
//             series.push({
//               type: e.IsColorZone ? 'MultiColoredLine' : e.ChartTypeName,
//               shape: e.CurveStyleName,
//               data: e.Data,
//               fill: e.IsColorZone ? 'transparent' : e.FillColor,
//               opacity:
//                 e.ChartTypeName === 'Area'
//                   ? 0.7
//                   : e.CurveStyleName === 'HistogramEmpty'
//                   ? 0
//                   : e.CurveStyleName === 'Histogram'
//                   ? 0.7
//                   : e.Opacity,
//               width: e.Width || 1.5,
//               ZOrder: e.ZOrder || 0,
//             });
//           }
//         }
//       });

//       api.enableZoom(
//         cfg,
//         series,
//         chart.container,
//         chart.svg,
//         chart.contentLayer,
//         chart.xGridLayer,
//         chart.yAxisLayer,
//         yScale,
//         chart.yAxisGroup,
//         xScale
//       );

//       api.drawXGrid(cfg, chart.xGridLayer, xScale);
//       api.drawYGrid(cfg, chart.yAxisLayer, yScale);
//       api.drawYLable(cfg, chart.yAxisGroup, yScale);
//       api.drawSeriesData(cfg, series, chart.contentLayer, xScale, yScale);
//     },

//     /* =====================================================
//           GRID DRAWING
//       ===================================================== */

//     drawXGrid(config, layer, xScale) {
//       if (!config.xAxis.showGrid) return;

//       const { major, minor } = getXGridTicks(
//         config.xAxis.scaleType,
//         config.xAxis.min,
//         config.xAxis.max
//       );

//       const all = [
//         ...minor.map((v) => ({ v, cls: 'minor', w: 0.5 })),
//         ...major.map((v) => ({ v, cls: 'major', w: 1 })),
//       ];

//       const lines = layer.selectAll('.x-grid').data(all, (d) => d.v + d.cls);

//       lines
//         .enter()
//         .append('line')
//         .attr('class', (d) => `x-grid ${d.cls}`)
//         .merge(lines)
//         .attr('x1', (d) => xScale(d.v))
//         .attr('x2', (d) => xScale(d.v))
//         .attr('y1', config.margin.top)
//         .attr('y2', config.height - config.margin.bottom)
//         .attr('stroke', '#787878')
//         .attr('stroke-width', (d) => d.w)
//         .attr('vector-effect', 'non-scaling-stroke')
//         .attr('shape-rendering', 'crispEdges');

//       lines.exit().remove();
//     },

//     drawYGrid(config, layer, scale) {
//       let ticks = scale.ticks(10);
//       debugger;
//       if (config.yAxis.isInverse) ticks = ticks.reverse();

//       const lines = layer.selectAll('.y-grid').data(ticks, (d) => d);

//       lines
//         .enter()
//         .append('line')
//         .attr('class', 'y-grid')
//         .merge(lines)
//         .attr('x1', config.margin.left)
//         .attr('x2', config.width - config.margin.right)
//         .attr('y1', (d) => scale(d))
//         .attr('y2', (d) => scale(d))
//         .attr('stroke', '#cfcfcf')
//         .attr('stroke-width', 1)
//         .attr('vector-effect', 'non-scaling-stroke')
//         .attr('shape-rendering', 'crispEdges');

//       lines.exit().remove();
//     },

//     drawYLable(config, axisGroup, scale) {
//       if (!axisGroup) return;
//       let ticks = scale.ticks(10);
//       if (config.yAxis.isInverse) ticks = ticks.reverse();
//       axisGroup.call(d3.axisLeft(scale).tickValues(ticks));
//     },

//     /* =====================================================
//           SERIES DRAWING (OPTIMIZED)
//       ===================================================== */

//     drawSeriesData(config, series, layer, xScale, yScale) {
//       layer.selectAll('.series').remove();
//       layer.selectAll('.series-root').remove();

//       const g = layer.append('g').attr('class', 'series-root');

//       series.forEach((curve) => {
//         const data = curve.data;

//         /* -------- LINE -------- */
//         if (curve.type === 'Line') {
//           const segments = splitDefinedSegments(data, (d) => d.y);
//           const line = d3
//             .line()
//             .x((d) => {
//               return !isNaN(xScale(d.y)) ? xScale(d.y) : -100;
//             })
//             .y((d) => {
//               return !isNaN(yScale(d.x)) ? yScale(d.x) : -100;
//             });

//           g.selectAll(null)
//             .data(segments)
//             .enter()
//             .append('path')
//             .attr('class', 'series line')
//             .attr('d', line)
//             .attr('stroke', curve.fill)
//             .attr('stroke-width', curve.width)
//             .attr('fill', 'none')
//             .attr('vector-effect', 'non-scaling-stroke');
//         } else if (curve.type === 'Area') {
//           /* -------- AREA -------- */
//           const area = d3
//             .area()
//             .defined((d) => d.y != null)
//             .x0(config.margin.left)
//             .x1((d) => {
//               return !isNaN(xScale(d.y)) ? xScale(d.y) : -100;
//             })
//             .y((d) => {
//               return !isNaN(yScale(d.x)) ? yScale(d.x) : -100;
//             });

//           g.append('path')
//             .attr('class', 'series area')
//             .datum(data)
//             .attr('d', area)
//             .attr('fill', curve.fill)
//             .attr('opacity', curve.opacity);
//         } else if (
//           /* -------- EMPTY HISTOGRAM -------- */
//           curve.type === 'Histogram' &&
//           curve.shape === 'HistogramEmpty'
//         ) {
//           const line = d3.line().defined((d) => d.y != null);
//           x1((d) => {
//             return !isNaN(xScale(d.y)) ? xScale(d.y) : -100;
//           })
//             .y((d) => {
//               return !isNaN(yScale(d.x)) ? yScale(d.x) : -100;
//             })
//             .curve(d3.curveStepAfter);

//           g.append('path')
//             .attr('class', 'series histogram-empty')
//             .datum(data)
//             .attr('d', line)
//             .attr('stroke', curve.fill)
//             .attr('stroke-width', 1.5)
//             .attr('fill', 'none')
//             .attr('vector-effect', 'non-scaling-stroke');
//         } else if (curve.type === 'Histogram') {
//           /* -------- HISTOGRAM -------- */
//           const area = d3
//             .area()
//             .defined((d) => d.y != null)
//             .x0(config.margin.left)
//             .x1((d) => {
//               return !isNaN(xScale(d.y)) ? xScale(d.y) : -100;
//             })
//             .y((d) => {
//               return !isNaN(yScale(d.x)) ? yScale(d.x) : -100;
//             })
//             .curve(d3.curveStepAfter);

//           g.append('path')
//             .attr('class', 'series histogram')
//             .datum(data)
//             .attr('d', area)
//             .attr('fill', curve.fill)
//             .attr('opacity', curve.opacity);
//         } else if (curve.type === 'MultiColoredLine') {
//           /* -------- MULTI COLOR LINE (FULL WIDTH ZONES) -------- */
//           const segments = splitDefinedSegments(data, (d) => d.y);
//           const area = d3
//             .area()
//             .x0(config.margin.left)
//             .x1(config.width - config.margin.right)
//             .y((d) => yScale(d.x));
//           for (let i = 0; i < data.length - 1; i++) {
//             if (data[i].y !== null && data[i + 1].y !== null) {
//               g.append('path')
//                 .datum([data[i], data[i + 1]])
//                 .attr('d', area)
//                 .attr('data-type', curve.type)
//                 .attr('class', 'series')
//                 .attr('fill', data[i].c)
//                 .attr('opacity', curve.opacity);
//             }
//           }
//           // g.selectAll(null)
//           //   .data(segments)
//           //   .enter()
//           //   .append('path')
//           //   .attr('class', 'series multicolor')
//           //   .attr('d', area)
//           //   .attr('fill', (d) => d[0].c)
//           //   .attr('opacity', curve.opacity);
//         } else if (curve.type === 'Scatter') {
//           /* -------- SCATTER -------- */
//           const symbolScale = d3
//             .scaleOrdinal()
//             .domain(['Circle', 'Point', 'Diamond', 'Triangle', 'Square'])
//             .range([
//               d3.symbolCircle,
//               d3.symbolCircle,
//               d3.symbolDiamond,
//               d3.symbolTriangle,
//               d3.symbolSquare,
//             ]);

//           const symbol = d3
//             .symbol()
//             .type(symbolScale(curve.shape))
//             .size(curve.shape === 'Point' ? 10 : 50);

//           g.append('g')
//             .attr('class', 'series scatter')
//             .selectAll('path')
//             .data(data.filter((d) => d.y != null))
//             .enter()
//             .append('path')
//             .attr('d', symbol)
//             .attr('transform', (d) => {
//               console.log(isNaN(d.y) + '-' + xScale(d.y) + ' - ' + yScale(d.x));
//               return `translate(${isNaN(d.y) ? -100 : xScale(d.y)},${yScale(
//                 d.x
//               )})`;
//             })
//             .attr('fill', curve.fill)
//             .attr('stroke', 'black')
//             .attr('stroke-width', 0.1);
//         }
//       });
//     },

//     /* =====================================================
//           TRACK SELECTION (BRUSH)
//       ===================================================== */

//     enableTrackSelection(config, brushLayer, yScale) {
//       if (!config.enableSelection) return;

//       const brush = d3
//         .brushY()
//         .extent([
//           [config.margin.left, config.margin.top],
//           [
//             config.width - config.margin.right,
//             config.height - config.margin.bottom,
//           ],
//         ])
//         .on('end', (e) => {
//           if (!e.selection) return;
//           const [min, max] = e.selection.map(yScale.invert);

//           ColorZoneEditorComponent?.addColorZone(
//             +min.toFixed(2),
//             +max.toFixed(2)
//           );

//           console.log('Selected depth:', min.toFixed(2), max.toFixed(2));

//           // Clear brush visually
//           brushG.call(brush.move, null);
//         });

//       const brushG = brushLayer.append('g').attr('class', 'brush').call(brush);
//     },

//     /* =====================================================
//           ZOOM + SCROLLBAR + TOOLBAR
//       ===================================================== */

//     enableZoom(
//       config,
//       seriesData,
//       container,
//       svg,
//       contentLayer,
//       xGridLayer,
//       yGridLayer,
//       yScale,
//       yAxisGroup,
//       xScale
//     ) {
//       if (!config.zoom.enable) return;

//       let yCurrent = yScale.copy();
//       let isSyncingScroll = false;
//       let scrollbar = null,
//         handle = null,
//         toolbar = null;

//       const zoom = d3
//         .zoom()
//         .scaleExtent([config.zoom.min, config.zoom.max])
//         .translateExtent([
//           [0, 0],
//           [config.width, config.height],
//         ])
//         .extent([
//           [0, 0],
//           [config.width, config.height],
//         ])
//         .filter((e) => e.type === 'wheel' || e.type === 'dblclick')
//         .on('zoom', zoomed);

//       svg.call(zoom);

//       function zoomed(event) {
//         yCurrent = event.transform.rescaleY(yScale);

//         api.drawYGrid(config, yGridLayer, yCurrent);
//         api.drawYLable(config, yAxisGroup, yCurrent);
//         api.drawSeriesData(config, seriesData, contentLayer, xScale, yCurrent);

//         initializeScrollbar(event.transform.k > 1);
//         syncScrollbarFromZoom();
//       }

//       /* ---------- Scrollbar ---------- */

//       function initializeScrollbar(enable) {
//         if (!enable) {
//           if (scrollbar) {
//             scrollbar.remove();
//             scrollbar = handle = null;
//           }
//           initializeToolbar(false);
//           return;
//         }

//         if (scrollbar) return;

//         scrollbar = container
//           .append('svg')
//           .attr('class', 'y-scrollbar')
//           .attr('width', 10)
//           .attr(
//             'height',
//             config.height - config.margin.top - config.margin.bottom
//           )
//           .style('margin-left', '2px')
//           .style('user-select', 'none');

//         handle = scrollbar
//           .append('rect')
//           .attr('x', 0)
//           .attr('width', 10)
//           .attr('fill', '#ccc')
//           .attr('rx', 2)
//           .attr('ry', 2);

//         const drag = d3.drag().on('drag', (event) => {
//           const dy = event.dy;
//           svg.call(zoom.translateBy, 0, dy);
//         });

//         handle.call(drag);

//         initializeToolbar(true);
//       }

//       function syncScrollbarFromZoom() {
//         if (!handle) return;

//         const full = yScale.domain();
//         const cur = yCurrent.domain();

//         const totalSpan = full[0] - full[1];
//         const visibleSpan = cur[0] - cur[1];
//         const offset = full[0] - cur[0];
//         const ratio = offset / (totalSpan - visibleSpan);

//         const trackH = config.height - config.margin.top - config.margin.bottom;
//         const handleH = Math.max(20, trackH * (visibleSpan / totalSpan));

//         isSyncingScroll = true;
//         handle.attr('height', handleH).attr('y', ratio * (trackH - handleH));
//         isSyncingScroll = false;
//       }

//       /* ---------- Toolbar ---------- */

//       function initializeToolbar(enable) {
//         if (!enable) {
//           if (toolbar) {
//             toolbar.remove();
//             toolbar = null;
//           }
//           return;
//         }

//         if (toolbar) return;

//         toolbar = container
//           .append('div')
//           .attr('class', 'chart-toolbar')
//           .style('display', 'flex')
//           .style('gap', '4px')
//           .style('height', '20px')
//           .style('position', 'relative')
//           .style('top', '5px')
//           .style('left', '-125px')
//           .style('margin-bottom', '4px');

//         toolbar
//           .append('button')
//           .text('+')
//           .on('click', () => {
//             svg.transition().call(zoom.scaleBy, 1.25);
//           });

//         toolbar
//           .append('button')
//           .text('−')
//           .on('click', () => {
//             const t = d3.zoomTransform(svg.node());
//             if (t.k <= 1.01) {
//               resetZoom();
//             } else {
//               svg.transition().call(zoom.scaleBy, 0.8);
//             }
//           });

//         toolbar.append('button').text('Reset').on('click', resetZoom);
//       }

//       /* ---------- Reset ---------- */

//       function resetZoom() {
//         svg.transition().call(zoom.transform, d3.zoomIdentity);
//       }
//     },
//   };

//   return api;
// })();

// const LogarithmicTrackComponent = {
//   setChartSeriesData: function (
//     chart,
//     _data,
//     yAxisInterval,
//     yAxisMinRange,
//     yAxisMaxRange,
//     xAxisInterval,
//     xAxisMin,
//     xAxisMax,
//     chartWidth,
//     isCurveEditor
//   ) {
//     if (chart != undefined && chart != null) {
//       let xScale = chart.xScale;
//       let yScale = chart.yScale;
//       let yAxisLable = chart.yAxisLable;
//       if (
//         yAxisInterval != null &&
//         yAxisMinRange != null &&
//         yAxisMaxRange != null
//       ) {
//         yScale.domain([yAxisMaxRange, yAxisMinRange]);
//       }
//       debugger;
//       let data = JSON.parse(_data);
//       let _series = [];
//       data.forEach((e) => {
//         if (e.IsVisible || isCurveEditor) {
//           if (e.Data != undefined && e.Data != [] && e.Data.length > 0) {
//             _series.push({
//               type: e.IsColorZone ? 'MultiColoredLine' : e.ChartTypeName,
//               shape: e.CurveStyleName,
//               dataSource: e.Data,
//               fill: e.IsColorZone ? 'transparent' : e.FillColor,
//               pointColorMapping: 'c',
//               opacity:
//                 e.ChartTypeName == 'Area'
//                   ? 0.7
//                   : e.CurveStyleName == 'HistogramEmpty'
//                   ? 0
//                   : e.CurveStyleName == 'Histogram'
//                   ? 0.7
//                   : e.Opacity,
//               ZOrder: e.ZOrder,
//             });
//           }
//         }
//       });
//       this.enableZoom(
//         chart.config,
//         _series,
//         chart.container,
//         chart.svg,
//         chart.contentLayer,
//         chart.xGridLayer,
//         chart.yGridLayer,
//         yScale,
//         yAxisLable,
//         xScale
//       );
//       this.drawSeriesData(
//         chart.config,
//         _series,
//         chart.contentLayer,
//         xScale,
//         yScale
//       );
//       debugger;
//     }
//   },
//   setChartProps: function (
//     chartId,
//     height,
//     width,
//     xAxisVisible,
//     xAxisInterval,
//     xAxisMinRange,
//     xAxisMaxRange,
//     yAxisVisible,
//     yAxisInterval,
//     yAxisMinRange,
//     yAxisMaxRange,
//     allowSelection,
//     allowZooming,
//     xAxisLabelPosition,
//     edgeLabelPlacement
//   ) {
//     const config = {
//       name: chartId,
//       width: parseInt(width),
//       height: parseInt(height),
//       border: true,
//       enableSelection: allowSelection,
//       margin: { top: 0, right: 0, bottom: 0, left: 0 },

//       xAxis: {
//         min: xAxisMinRange,
//         max: xAxisMaxRange,
//         interval: xAxisInterval,
//         scaleType: 'log', // "log" | "linear"
//         showTicks: xAxisVisible,
//         showLabels: xAxisVisible,
//         showGrid: true,
//         isOpposite: false,
//       },

//       yAxis: {
//         min: yAxisMinRange,
//         max: yAxisMaxRange,
//         interval: yAxisInterval,
//         isInvers: true,
//         show: yAxisVisible,
//       },

//       zoom: {
//         min: 1,
//         max: 50,
//         enable: allowZooming,
//       },
//       chartBorder: {
//         show: true,
//         color: '#8c8c8c',
//         width: 1,
//       },
//     };

//     if (config.yAxis.show) {
//       config.margin.left = config.margin.left + 50;
//     }
//     if (config.xAxis.showTicks || config.xAxis.showLabels) {
//       config.margin.top = config.margin.top + 20;
//     }

//     const container = d3.select('#' + config.name);
//     let svg = container
//       .append('svg')
//       .attr('width', config.width)
//       .attr('height', config.height);

//     if (config.chartBorder.show) {
//       svg
//         .insert('rect', ':first-child') // ensure it's behind everything
//         .attr('class', 'chart-border')
//         .attr('x', config.margin.left)
//         .attr('y', config.margin.top)
//         .attr('width', config.width - config.margin.left - config.margin.right)
//         .attr(
//           'height',
//           config.height - config.margin.top - config.margin.bottom
//         )
//         .attr('fill', 'none')
//         .attr('stroke', config.chartBorder.color)
//         .attr('stroke-width', config.chartBorder.width)
//         .attr('shape-rendering', 'crispEdges');
//     }

//     /* =====================================================
//         SCALES (X SWITCHABLE)
//       ===================================================== */

//     let xScale =
//       config.xAxis.scaleType === 'log'
//         ? d3
//             .scaleLog()
//             .domain([config.xAxis.min, config.xAxis.max])
//             .range([config.margin.left, config.width])
//         : d3
//             .scaleLinear()
//             .domain([config.xAxis.min, config.xAxis.max])
//             .range([config.margin.left, config.width]);

//     let yScale = config.yAxis.isInvers
//       ? d3
//           .scaleLinear()
//           .domain([config.yAxis.max, config.yAxis.min])
//           .range([config.height, config.margin.top])
//       : d3
//           .scaleLinear()
//           .domain([config.yAxis.min, config.yAxis.max])
//           .range([config.height, config.margin.top]);

//     let yCurrent = yScale.copy();

//     /* =====================================================
//         AXES
//       ===================================================== */

//     let xAxis = config.xAxis.isOpposite
//       ? d3.axisBottom(xScale)
//       : d3.axisTop(xScale);

//     if (!config.xAxis.showTicks) xAxis.tickSize(0);
//     if (!config.xAxis.showLabels) xAxis.tickFormat('');

//     if (config.xAxis.showTicks) {
//       let position = config.xAxis.isOpposite
//         ? config.height
//         : config.margin.top;
//       svg.append('g').attr('transform', `translate(0,${position})`).call(xAxis);
//     }
//     let yAxisLable = undefined;
//     if (config.yAxis.show) {
//       let yAxis = d3.axisLeft(yCurrent);
//       yAxis.tickSize(5);
//       yAxisLable = svg
//         .append('g')
//         .attr('class', 'axis')
//         .attr('stroke-width', 0.5)
//         .attr('transform', `translate(${config.margin.left},0)`)
//         .call(yAxis);
//     } else {
//     }

//     /* =====================================================
//       LAYERS
//     ===================================================== */
//     let xGridLayer = svg.append('g').attr('clip-path', 'url(#clip)');
//     let yGridLayer = svg.append('g').attr('clip-path', 'url(#clip)');
//     let contentLayer = svg.append('g').attr('clip-path', 'url(#clip)');

//     this.drawXGrid(config, xGridLayer, xScale);
//     this.drawYGrid(config, yGridLayer, yScale);
//     this.drawYLable(config, yAxisLable, yScale);
//     this.enableTrackSelection(config, svg, yScale);

//     return {
//       config,
//       container,
//       svg,
//       contentLayer,
//       xGridLayer,
//       yGridLayer,
//       xScale,
//       yScale,
//       yAxisLable,
//     };
//   },
//   getXGridTicks: (scaleType, min, max) => {
//     if (scaleType === 'log') {
//       let major = [];
//       let minor = [];

//       let start = Math.floor(Math.log10(min));
//       let end = Math.ceil(Math.log10(max));

//       for (let e = start; e <= end; e++) {
//         let decade = Math.pow(10, e);
//         if (decade >= min && decade <= max) major.push(decade);

//         // 7 minor divisions per decade
//         [2, 3, 4, 5, 6, 7, 8].forEach((m) => {
//           let v = m * decade;
//           if (v >= min && v <= max) minor.push(v);
//         });
//       }
//       return { major, minor };
//     }

//     // LINEAR
//     let ticks = d3.scaleLinear().domain([min, max]).ticks(10);

//     return { major: ticks, minor: [] };
//   },
//   drawXGrid: (config, xGridLayer, xScale) => {
//     if (!config.xAxis.showGrid) return;

//     let { major, minor } = LogarithmicTrackComponent.getXGridTicks(
//       config.xAxis.scaleType,
//       config.xAxis.min,
//       config.xAxis.max
//     );
//     // ---- MINOR ----
//     xGridLayer
//       .selectAll('.x-grid-minor')
//       .data(minor)
//       .enter()
//       .append('line')
//       .attr('class', 'x-grid-minor')
//       .attr('x1', (d) => xScale(d))
//       .attr('x2', (d) => xScale(d))
//       .attr('y1', config.margin.top)
//       .attr('y2', config.height)
//       .attr('stroke', '#e5e5e5')
//       .attr('stroke-width', 0.5)
//       .attr('shape-rendering', 'crispEdges');

//     // ---- MAJOR ----
//     xGridLayer
//       .selectAll('.x-grid-major')
//       .data(major)
//       .enter()
//       .append('line')
//       .attr('class', 'x-grid-major')
//       .attr('x1', (d) => xScale(d))
//       .attr('x2', (d) => xScale(d))
//       .attr('y1', config.margin.top)
//       .attr('y2', config.height)
//       .attr('stroke', '#b5b5b5')
//       .attr('stroke-width', 1)
//       .attr('shape-rendering', 'crispEdges');
//   },
//   drawYGrid: (config, gridLayer, scale) => {
//     debugger;
//     // let steps = 10;
//     // let [a, b] = scale.domain();
//     // let min = Math.min(a, b);
//     // let max = Math.max(a, b);
//     // let ticks = [];
//     // let majorStep = 90;
//     // let start = Math.floor(min / majorStep) * majorStep;
//     // for (let d = start; d <= max; d += majorStep) ticks.push(d);
//     let ticks = scale.ticks(config.yAxis.interval+10);
//     let grid = gridLayer.selectAll('.depth-grid').data(ticks, (d) => d);
//     grid
//       .enter()
//       .append('line')
//       .attr('class', 'depth-grid')
//       .merge(grid)
//       .attr('x1', config.margin.left)
//       .attr('x2', config.width)
//       .attr('y1', (d) => scale(d))
//       .attr('y2', (d) => scale(d));

//     grid.exit().remove();
//   },
//   drawYLable: (config, axisLable, scale) => {
//     debugger;
//     // let steps = 10;
//     // let ticks = [];
//     // let [a, b] = scale.domain();
//     // let min = Math.min(a, b);
//     // let max = Math.max(a, b);
//     // let majorStep = 90;
//     // let start = Math.floor(min / majorStep) * majorStep;
//     // for (let d = start; d <= max; d += majorStep) ticks.push(d);
//     let ticks = scale.ticks(config.yAxis.interval);
//     if (config.yAxis.isInvers) {
//       ticks = ticks.reverse();
//     }
//     if (axisLable) {
//       axisLable.call(d3.axisLeft(scale).tickValues(ticks));
//     }
//   },
//   enableTrackSelection: (config, svg, yScale) => {
//     /* =====================================================
//       Y-AXIS TRACK SELECTION (PROPER DEPTH)
//     ===================================================== */
//     if (config.enableSelection) {
//       let contentLayer = svg.append('g').attr('clip-path', 'url(#clip)');
//       let brush = d3
//         .brushY()
//         .extent([
//           [config.margin.left, config.margin.top],
//           [config.width, config.height],
//         ])
//         .on('end', (e) => {
//           if (!e.selection) return;

//           let [y1, y2] = e.selection.map(yScale.invert);
//           console.log('Selected depth range:', y1.toFixed(2), y2.toFixed(2));
//         });
//       contentLayer.append('g').attr('class', 'brush').call(brush);
//     }
//   },
//   enableZoom: (
//     config,
//     seriesData,
//     container,
//     svg,
//     contentLayer,
//     xGridLayer,
//     yGridLayer,
//     yScale,
//     yAxisLable,
//     xScale
//   ) => {
//     let yCurrent = yScale.copy();
//     if (config.zoom.enable) {
//       let scrollbar = null,
//         handle = null,
//         toolbar = null;

//       const yScrollbar = d3
//         .scaleLinear()
//         .domain(yScale.domain())
//         .range([0, config.height]);

//       const zoom = d3
//         .zoom()
//         .scaleExtent([config.zoom.min, config.zoom.max])
//         .filter((e) => e.type === 'wheel' || e.type === 'dblclick')
//         .translateExtent([
//           [0, 0],
//           [config.width, config.height],
//         ])
//         .extent([
//           [0, 0],
//           [config.width, config.height],
//         ])
//         .on('zoom', zoomed);

//       svg.call(zoom);

//       // Zoom handler
//       function zoomed(event) {
//         yCurrent = event.transform.rescaleY(yScale);
//         initializeScroll(event.transform.k > 1);
//         LogarithmicTrackComponent.drawXGrid(config, xGridLayer, xScale);
//         LogarithmicTrackComponent.drawYGrid(config, yGridLayer, yCurrent);
//         if (config.yAxis.show) {
//           LogarithmicTrackComponent.drawYLable(config, yAxisLable, yCurrent);
//         }
//         LogarithmicTrackComponent.drawSeriesData(
//           config,
//           seriesData,
//           contentLayer,
//           xScale,
//           yCurrent
//         );
//         if (handle != null) {
//           const [d0, d1] = yCurrent.domain();
//           handle
//             .attr('y', yScrollbar(d0))
//             .attr('height', yScrollbar(d1) - yScrollbar(d0));
//         }
//       }

//       function initializeScroll(enable) {
//         if (enable) {
//           if (scrollbar == null) {
//             scrollbar = container
//               .append('svg')
//               .attr('width', 16)
//               .attr('transform', `translate(0,${config.margin.top})`)
//               .attr('height', config.height - config.margin.top);

//             if (handle == null) {
//               handle = scrollbar
//                 .append('rect')
//                 .attr('x', 0)
//                 .attr('width', 16)
//                 .attr('fill', '#ccc')
//                 .attr('y', 0)
//                 .attr('height', config.height - config.margin.top);

//               let drag = d3.drag().on('drag', function (event) {
//                 let dy = event.dy;
//                 svg.call(zoom.translateBy, 0, dy);
//               });
//               handle.call(drag);
//             }
//           }
//         } else {
//           if (scrollbar != null) {
//             scrollbar.remove();
//             scrollbar = null;
//             handle.remove();
//             handle = null;
//           }
//         }
//         initializeToolbar(enable);
//       }
//       // Scrollbar drag = zoom
//       function initializeToolbar(enable) {
//         if (enable) {
//           if (toolbar == null) {
//             toolbar = container.append('div').attr('class', 'toolbar');
//             // Zoom In
//             toolbar
//               .append('button')
//               .attr('id', 'zoomIn')
//               .text('+')
//               .on('click', () => {
//                 svg.transition().call(zoom.scaleBy, 1.2);
//               });

//             // Zoom Out
//             toolbar
//               .append('button')
//               .attr('id', 'zoomOut')
//               .text('−')
//               .on('click', () => {
//                 svg.transition().call(zoom.scaleBy, 0.8);
//               });

//             // Reset
//             toolbar
//               .append('button')
//               .attr('id', 'reset')
//               .text('Reset')
//               .on('click', () => {
//                 svg.transition().call(zoom.transform, d3.zoomIdentity);
//               });
//           }
//         } else {
//           if (toolbar != null) {
//             toolbar.remove();
//             toolbar = null;
//           }
//         }
//       }
//     }
//   },
//   drawSeriesData: (config, _series, contentLayer, xScale, yScale) => {
//     contentLayer.selectAll('.series').remove();
//     _series.forEach((curve) => {
//       if (curve.type === 'Line') {
//         let line = d3
//           .line()
//           .defined((d) => d.y != null)
//           .x(config.margin.left)
//           .x((d) => xScale(d.y))
//           .y((d) => yScale(d.x));

//         for (let i = 0; i < curve.dataSource.length - 1; i++) {
//           if (
//             curve.dataSource[i].y != null &&
//             curve.dataSource[i + 1].y != null
//           ) {
//             contentLayer
//               .append('path')
//               .attr('class', 'series')
//               .datum([curve.dataSource[i], curve.dataSource[i + 1]])
//               .attr('d', line)
//               .attr('stroke', curve.fill)
//               .attr('stroke-width', curve.width)
//               .attr('fill', 'none');
//           }
//         }
//       } else if (curve.type === 'Area') {
//         let area = d3
//           .area()
//           .defined((d) => d.y != null)
//           .x0(config.margin.left)
//           .x1((d) => xScale(d.y))
//           .y((d) => yScale(d.x));

//         contentLayer
//           .append('path')
//           .attr('class', 'series')
//           .datum(curve.dataSource)
//           .attr('d', area)
//           .attr('fill', curve.fill)
//           .attr('opacity', curve.opacity);
//       } else if (curve.type === 'Histogram') {
//         let area = d3
//           .area()
//           .defined((d) => d.y != null)
//           .x0(config.margin.left)
//           .x1((d) => xScale(d.y))
//           .y((d) => yScale(d.x))
//           .curve(d3.curveStepAfter);

//         contentLayer
//           .append('path')
//           .attr('class', 'series')
//           .datum(curve.dataSource)
//           .attr('d', area)
//           .attr('fill', curve.fill)
//           .attr('opacity', curve.opacity);
//       } else if (curve.type === 'HistogramEmpty') {
//         const line = d3
//           .line()
//           .x((d) => xScale(d.y))
//           .y((d) => yScale(d.x))
//           .curve(d3.curveStepAfter);
//         contentLayer
//           .append('path')
//           .datum(curve.dataSource)
//           .attr('fill', 'none')
//           .attr('class', 'series')
//           .attr('stroke', curve.fill)
//           .attr('stroke-width', 1.5)
//           .attr('d', line);
//       } else if (curve.type == 'MultiColoredLine') {
//         let area = d3
//           .area()
//           .defined((d) => d.y !== null)
//           .x0(config.margin.left)
//           .x1((d) => config.width)
//           .y((d) => yScale(d.x));
//         for (let i = 0; i < curve.dataSource.length - 1; i++) {
//           if (
//             curve.dataSource[i].y !== null &&
//             curve.dataSource[i + 1].y !== null
//           ) {
//             contentLayer
//               .append('path')
//               .datum([curve.dataSource[i], curve.dataSource[i + 1]])
//               .attr('d', area)
//               .attr('class', 'series')
//               .attr('fill', curve.dataSource[i].c)
//               .attr('opacity', curve.opacity);
//           }
//         }
//       } else if (curve.type == 'Scatter') {
//         const symbolScale = d3
//           .scaleOrdinal()
//           .domain(['Circle', 'Point', 'Diamond', 'Triangle', 'Square'])
//           .range([
//             d3.symbolCircle,
//             d3.symbolCircle,
//             d3.symbolDiamond,
//             d3.symbolTriangle,
//             d3.symbolSquare,
//           ]);
//         const symbol = d3
//           .symbol()
//           .size((d) => (curve.shape === 'Point' ? 10 : 50));
//         const markerGroup = contentLayer.append('g').attr('class', 'markers');
//         markerGroup
//           .selectAll('path')
//           .data(curve.dataSource)
//           .enter()
//           .append('path')
//           .attr('class', 'series')
//           .attr('d', (d) => symbol.type(symbolScale(curve.shape))())
//           .attr('transform', (d) => `translate(${xScale(d.y)}, ${yScale(d.x)})`)
//           .attr('fill', curve.fill)
//           .attr('stroke', 'black')
//           .attr('stroke-width', 0.1);
//       }
//     });
//   },
// };
