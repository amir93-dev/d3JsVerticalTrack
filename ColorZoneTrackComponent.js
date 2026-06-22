const ColorZoneTrackComponent = (() => {
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

  /* =====================================================
      CORE API
  ===================================================== */

  const api = {
    /* =====================================================
          CHART INIT
      ===================================================== */

    setChartProps(chartId, height, width) {
      const config = {
        name: chartId,
        width: parseInt(width),
        height: parseInt(height),
        margin: { top: 0, right: 0, bottom: 0, left: 0 },
        yAxis: {
          min: 1,
          max: 100,
          isInverse: true,
        },

        chartBorder: {
          show: true,
          color: '#8c8c8c',
          width: 1,
        },
      };

      const container = d3.select('#' + config.name);
      container.selectAll('*').remove();

      const svg = container
        .append('svg')
        .attr('width', config.width)
        .attr('height', config.height)
        .style('overflow', 'visible');

      if (config.chartBorder.show) {
        svg
          .append('rect')
          .attr('class', 'chart-border')
          .attr('x', config.margin.left)
          .attr('y', config.margin.top)
          .attr(
            'width',
            config.width - config.margin.left - config.margin.right
          )
          .attr(
            'height',
            config.height - config.margin.top - config.margin.bottom
          )
          .attr('fill', 'none')
          .attr('stroke', config.chartBorder.color)
          .attr('stroke-width', config.chartBorder.width)
          .attr('shape-rendering', 'crispEdges');
      }

      createClip(svg, 'clip-' + config.name, config);

      /* ---------------- SCALES ---------------- */

      let xScale = d3.scaleLinear();

      xScale.range([config.margin.left, config.width - config.margin.right]);

      let yScale = d3
        .scaleLinear()
        .domain(
          config.yAxis.isInverse
            ? [config.yAxis.max, config.yAxis.min]
            : [config.yAxis.min, config.yAxis.max]
        )
        .range([config.height - config.margin.bottom, config.margin.top]);

      /* ---------------- LAYERS ---------------- */
      const contentLayer = svg
        .append('g')
        .attr('clip-path', `url(#clip-${config.name})`);

      return {
        config,
        container,
        svg,
        contentLayer,
        xScale,
        yScale,
      };
    },

    /* =====================================================
          SERIES SET
      ===================================================== */

    setChartSeriesData(chart, _data, xAxisMin, xAxisMax) {
      if (!chart) return;

      const data = JSON.parse(_data);
      const cfg = chart.config;
      const xScale = chart.xScale;
      const yScale = chart.yScale;

      /* ----------- AXIS DOMAIN UPDATE ----------- */

      if (xAxisMin != null && xAxisMax != null) {
        yScale.domain([xAxisMax, xAxisMin]);
        cfg.yAxis.min = xAxisMin;
        cfg.yAxis.max = xAxisMax;
      } else {
        const allX = data.flatMap((d) => d.Data.map((p) => p.x));
        const ymin = d3.min(allX);
        const ymax = d3.max(allX);
        yScale.domain([ymax, ymin]);
        cfg.yAxis.min = ymin;
        cfg.yAxis.max = ymax;
      }
      chart.yCurrent = yScale.copy();

      /* ----------- SERIES NORMALIZATION ----------- */

      const series = [];
      data.forEach((e) => {
        series.push({
          data: e.Data,
        });
      });
      api.drawSeriesData(cfg, series, chart.contentLayer, yScale);
    },

    /* =====================================================
          SERIES DRAWING (OPTIMIZED)
      ===================================================== */

    drawSeriesData(config, series, layer, yScale) {
      layer.selectAll('.series').remove();
      layer.selectAll('.series-root').remove();
      const g = layer.append('g').attr('class', 'series-root');
      series.forEach((curve) => {
        const data = curve.data;
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
        // const area = d3
        //   .area()
        //   .x0(config.margin.left)
        //   .x1(config.width - config.margin.right)
        //   .y((d) => yScale(d.x));
        // for (let i = 0; i < data.length - 1; i++) {
        //   if (data[i].y !== null && data[i + 1].y !== null) {
        //     g.append('path')
        //       .datum([data[i], data[i + 1]])
        //       .attr('d', area)
        //       .attr('class', 'series')
        //       .attr('fill', data[i].c)
        //       .attr('opacity', curve.opacity);
        //   }
        // }
      });
    },
  };

  return api;
})();

let _chart = ColorZoneTrackComponent.setChartProps(
  'colozone-Chart',
  '600px',
  '30px'
);
ColorZoneTrackComponent.setChartSeriesData(
  _chart,
  _colorZoneData,
  10000,
  15766
);
