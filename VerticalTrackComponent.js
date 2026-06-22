const VerticalTrackComponent = (() => {
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

  function getXGridTicks(scaleType, min, max, interval) {
    if (scaleType === 'log') {
      const major = [];
      const start = Math.floor(Math.log10(min));
      const end = Math.ceil(Math.log10(max));
      for (let e = start; e <= end; e++) {
        const decade = Math.pow(10, e);
        if (decade >= min && decade <= max) major.push(decade);
      }
      return { major };
    }
    return {
      major: d3.range(min, max, (max - min) / interval),
      //d3.scaleLinear().domain([min, max]).ticks(interval || 10)
    };
  }

  /* =====================================================
      FIXED Y GRID GENERATOR
  ===================================================== */

  function getFixedYPixelGrid(cfg) {
    return {
      major: d3.range(
        cfg.yAxis.min,
        cfg.yAxis.max,
        (cfg.yAxis.max - cfg.yAxis.min) / cfg.yAxis.interval
      ),
    };
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
      allowSelection,
      allowZooming,
      backgroundImage,
      xAxisLabelPosition,
      isRangeFilled
    ) {
      const config = {
        name: chartId,
        width: parseInt(width),
        height: parseInt(height),
        enableSelection: allowSelection,
        margin: { top: 0, right: 0, bottom: 0, left: 0 },
        backgroundImage: backgroundImage,
        isRangeFilled: isRangeFilled,
        xAxis: {
          min: 0,
          max: 100,
          interval: 5,
          scaleType: 'linear', // 'log' | 'linear'
          perSeriesScale: true,
          perSeriesAxes: false,
          showTicks: xAxisVisible,
          showLabels: xAxisVisible,
          showGrid: true,
          isOpposite: true,
        },

        yAxis: {
          min: 0,
          max: 1000,
          interval: 10,
          isInverse: true,
          show: xAxisLabelPosition !== 0,
          enableMultiple: true,
          majorGridPx: 10 + 10,
        },

        zoom: {
          min: 1,
          max: 50,
          enable: allowZooming,
        },

        chartBorder: {
          show: true,
          color: '#787878',
          width: 0.5,
        },
      };

      if (config.yAxis.show) config.margin.left += 50;
      if (config.xAxis.showTicks || config.xAxis.showLabels)
        config.margin.top += config.xAxis.isOpposite ? 0 : 20;

      const randomId = '-' + randomNumber();
      const container = d3.select('#' + config.name);
      container.selectAll('*').remove();

      const svg = container
        .append('svg')
        .attr('width', config.width)
        .attr('height', config.height)
        .attr('viewBox', `0 0 ${config.width} ${config.height}`);
      if (config.yAxis.show || config.xAxis.showTicks) {
        svg.style('overflow', 'visible');
      }
      if (config.backgroundImage != null) {
        svg
          .style('background-image', 'url(' + config.backgroundImage + ')')
          .style('background-repeat', 'round');
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

      const xScale =
        config.xAxis.scaleType === 'log' ? d3.scaleLog() : d3.scaleLinear();

      xScale
        .domain([config.xAxis.min, config.xAxis.max])
        .range([config.margin.left, config.width - config.margin.right]);

      const yScale = d3
        .scaleLinear()
        .domain(
          config.yAxis.isInverse
            ? [config.yAxis.max, config.yAxis.min]
            : [config.yAxis.min, config.yAxis.max]
        )
        .range([config.height - config.margin.bottom - 1, config.margin.top]);

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
      const seriesAxisLayer = svg
        .append('g')
        .attr('class', 'x-axis-series')
        .attr('text-anchor', 'bottom');

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
        seriesAxisLayer,
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
      yAxisMin,
      yAxisMax,
      isCurveEditor,
      stripLines
    ) {
      if (!chart) return;

      const data = JSON.parse(_data);
      const cfg = chart.config;
      const xScale = chart.xScale;
      const yScale = chart.yScale;

      /* ----------- Y DOMAIN ----------- */

      if (
        xAxisInterval != null &&
        xAxisMinRange != null &&
        xAxisMaxRange != null
      ) {
        yScale.domain([xAxisMaxRange, xAxisMinRange]);
        cfg.yAxis.min = xAxisMinRange;
        cfg.yAxis.max = xAxisMaxRange;
        cfg.yAxis.interval = xAxisInterval; //(xAxisMaxRange - xAxisMinRange) / xAxisInterval;
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
      data.forEach((e, i) => {
        if (e.IsVisible || isCurveEditor) {
          if (e.Data && e.Data.length) {
            series.push({
              id: i,
              name: e.SeriesName || `Curve ${i + 1}`,
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
              interval: e.YAxisInterval,
              minimum: isCurveEditor ? yAxisMin : e.YAxisMinRange,
              maximum: isCurveEditor ? yAxisMax : e.YAxisMaxRange,
              width: e.Width || 1.5,
              ZOrder: e.ZOrder || 0,
              isInversed:
                e.SeriesName == 'TVDss'
                  ? Math.abs(e.YAxisMinRange) > Math.abs(e.YAxisMaxRange)
                  : e.SeriesName == 'Density' || e.SeriesName == 'Porosity'
                  ? Math.abs(e.YAxisMinRange) > Math.abs(e.YAxisMaxRange)
                  : false,
              isColorZone: e.IsColorZone,
              visible: e.YLabelVisible,
            });
          }
        }
      });

      if (cfg.isRangeFilled) {
        let data1 = data[0],
          data2 = data[1],
          _data = [];
        for (
          let i = 0;
          i < Math.min(data1.Data.length, data2.Data.length);
          i++
        ) {
          let _y = (data1.Data[i].y - 2.45) * 2;
          let _y2 = (data2.Data[i].y - 0.15) / 0.3;
          if (_y > _y2) {
            _data.push({
              x: data2.Data[i].x,
              h: _y,
              l: _y2,
            });
          } else {
            _data.push({
              x: data2.Data[i].x,
              h: null,
              l: null,
            });
          }
        }
        series.push({
          id: 2,
          name: `FilledCurve`,
          type: 'RangeFilled',
          data: _data,
          fill: 'yellow',
          opacity: 0.5,
          interval: data1.YAxisInterval,
          minimum: -1,
          maximum: 1,
          width: data1.Width || 1.5,
          isInversed: false,
          visible: true,
        });
      }
      if (stripLines != null && stripLines.length > 0) {
        let _curve = data[0];
        stripLines.forEach((a) => {
          debugger;
          let _stripLinesData = [];
          if (_curve.Data.length > 0) {
            _curve.Data.forEach((c) => {
              _stripLinesData.push({
                x: c.x,
                y: a.start,
              });
            });
          }
          series.push({
            id: series[series.length - 1].id + 1,
            name: `StripLines` + 1,
            type: 'Line',
            data: _stripLinesData,
            fill: a.color,
            opacity: 0.5,
            interval: _curve.YAxisInterval,
            minimum: _curve.YAxisMinRange,
            maximum: _curve.YAxisMaxRange,
            width: 2.5,
            isInversed: false,
            visible: true,
          });
        });
      }

      /* ----------- PER SERIES X SCALE (NEW) ----------- */

      const plotLeft = cfg.margin.left;
      const plotRight = cfg.width - cfg.margin.right;

      series.forEach((curve) => {
        if (curve.isColorZone) return;
        //const values = curve.data.map((d) => d.y).filter((v) => !isNaN(v));
        let min = curve.minimum; //d3.min(values);
        let max = curve.maximum; //d3.max(values);

        if (cfg.xAxis.scaleType === 'log') {
          min = Math.max(min, 1e-6);
        }
        let _domain = curve.isInversed ? [max, min] : [min, max];
        let _range = [plotLeft, plotRight];
        curve._xScale =
          cfg.xAxis.scaleType === 'log'
            ? d3.scaleLog().domain(_domain).range(_range)
            : d3.scaleLinear().domain(_domain).range(_range);
      });

      api.enableZoom(
        cfg,
        series,
        chart.container,
        chart.svg,
        chart.contentLayer,
        chart.xGridLayer,
        chart.yGridLayer,
        yScale,
        chart.yAxisGroup,
        xScale,
        chart.seriesAxisLayer
      );

      api.drawXGrid(cfg, chart.xGridLayer, xScale, yAxisInterval);
      api.drawFixedYGrid(cfg, chart.yGridLayer, yScale);
      api.drawYLable(cfg, chart.yAxisGroup, yScale);
      if (cfg.xAxis.showTicks) {
        api.drawSeriesAxes(cfg, series, chart.seriesAxisLayer, yAxisInterval);
      }
      api.drawSeriesData(cfg, series, chart.contentLayer, xScale, yScale);

      if (cfg.zoom.enable) {
        d3.selectAll('.chart-toolbar #btn-reset-zoom')?.dispatch('click');
      }
    },

    /* =====================================================
            GRID DRAWING
        ===================================================== */

    drawXGrid(config, layer, xScale, interval) {
      if (!config.xAxis.showGrid) return;
      layer.selectAll('.x-grid').remove();
      const { major } = getXGridTicks(
        config.xAxis.scaleType,
        config.xAxis.min,
        config.xAxis.max,
        interval || config.xAxis.interval
      );
      const all = [...major.map((v) => ({ v, cls: 'major', w: 0.5 }))];
      const lines = layer.selectAll('.x-grid').data(all, (d) => d.v + d.cls);
      lines
        .enter()
        .append('line')
        .attr('class', (d) => `x-grid ${d.cls}`)
        .merge(lines)
        .attr('x1', (d) => xScale(d.v))
        .attr('x2', (d) => xScale(d.v))
        .attr('y1', config.margin.top - 1)
        .attr('y2', config.height - config.margin.bottom)
        .attr('stroke', '#787878')
        .attr('stroke-width', (d) => d.w)
        .attr('vector-effect', 'non-scaling-stroke')
        .attr('shape-rendering', 'crispEdges');

      lines.exit().remove();
    },

    /* =====================================================
            FIXED Y GRID
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
            SERIES AXES (NEW)
        ===================================================== */

    drawSeriesAxes(config, series, layer, interval) {
      layer.selectAll('*').remove();
      const axisHeight = 18;
      series.forEach((curve, i) => {
        if (curve.isColorZone) return;
        if (!config.xAxis.perSeriesAxes && i != 0) return;
        debugger;
        let _tickValues = getXGridTicks(
          config.xAxis.scaleType,
          curve.minimum,
          curve.maximum,
          curve.interval || interval
        ).major;
        const g = layer.attr(
          'transform',
          `translate(-0.5,${
            config.xAxis.isOpposite
              ? config.height + i * axisHeight
              : config.margin.top + i * axisHeight
          })`
        );
        let axis = config.xAxis.isOpposite
          ? d3.axisBottom(curve._xScale)
          : d3.axisTop(curve._xScale);
        axis.tickValues(_tickValues);
        g.call(axis);
        g.selectAll('path').attr('stroke-width', 0);
        g.selectAll('line').attr('stroke', '#787878').attr('stroke-width', 0.5);
        g.selectAll('text')
          .attr('fill', '#000000')
          .attr('y', '0.7em')
          .attr('x', '0.7em')
          .attr('dy', '0.8em')
          .attr('transform', 'rotate(45)');
      });
    },

    /* =====================================================
            SERIES DRAWING
        ===================================================== */

    drawSeriesData(config, series, layer, sharedXScale, yScale) {
      layer.selectAll('.series-root').remove();
      const g = layer.append('g').attr('class', 'series-root');

      series.forEach((curve) => {
        const data = curve.data;
        const xScale = config.xAxis.perSeriesScale
          ? curve._xScale
          : sharedXScale;

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
            .attr('opacity', curve.opacity ?? 1)
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
            .attr('opacity', curve.opacity);
        } else if (curve.type === 'RangeFilled') {
          /* -------- RangeFilled -------- */
          let area = d3
            .area()
            .defined((d) => d.l != null && d.h != null)
            .y((d) => yScale(d.x)) // y is the vertical position (based on x in data)
            .x0((d) => xScale(d.l)) // x0 is the lower bound for the horizontal range
            .x1((d) => xScale(d.h));

          g.append('path')
            .attr('class', 'series range filled')
            .datum(data)
            .attr('d', area)
            .attr('fill', curve.fill)
            .attr('opacity', curve.opacity);
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
      sharedXScale,
      seriesAxisLayer
    ) {
      if (!config.zoom.enable) return;

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

        api.drawXGrid(config, xGridLayer, sharedXScale);
        api.drawFixedYGrid(config, yGridLayer, yCurrent);
        api.drawYLable(config, yAxisGroup, yCurrent);
        api.drawSeriesData(
          config,
          seriesData,
          contentLayer,
          sharedXScale,
          yCurrent
        );
        if (config.xAxis.showTicks) {
          api.drawSeriesAxes(config, seriesData, seriesAxisLayer);
        }
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
          .style('background', '#ddd');

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

        handle.attr('height', handleH).attr('y', ratio * (trackH - handleH));
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

let _chart = VerticalTrackComponent.setChartProps(
  'vertical-Chart',
  '600px',
  '250px',
  true,
  true,
  true,
  null,
  0,
  true
);

VerticalTrackComponent.setChartSeriesData(
  _chart,
  _densityData,
  20,
  1449,
  1519.905,
  10,
  1.95,
  2.95,
  false,
  false
);
