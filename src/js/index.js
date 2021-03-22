import 'd3-transition';

import * as d3 from 'd3-selection';

import { axisBottom, axisRight } from 'd3-axis';
import { curveCardinal, line as d3Line } from 'd3-shape';
import { extent, max } from 'd3-array';

import AtlasMetadataClient from '@reuters-graphics/graphics-atlas-client';
import { Delaunay } from 'd3-delaunay';
import { appendSelect } from 'd3-appendselect';
import flatten from 'lodash/flatten';
import merge from 'lodash/merge';
import { path } from 'd3-path';
import { scaleLinear } from 'd3-scale';

const client = new AtlasMetadataClient();

d3.selection.prototype.appendSelect = appendSelect;

/**
 * Write your chart as a class with a single draw method that draws
 * your chart! This component inherits from a base class you can
 * see and customize in the baseClasses folder.
 */
class VaccinePaceChart {
  selection(selector) {
    if (!selector) return this._selection;
    this._selection = d3.select(selector);
    return this;
  }

  data(newData) {
    if (!newData) return this._data || this.defaultData;
    this._data = newData;
    return this;
  }

  props(newProps) {
    if (!newProps) return this._props || this.defaultProps;
    this._props = merge(this._props || this.defaultProps, newProps);
    return this;
  }

  /**
   * Default data for your chart. Generally, it's NOT a good idea to import
   * a big dataset and assign it here b/c it'll make your component quite
   * large in terms of file size. At minimum, though, you should assign an
   * empty Array or Object, depending on what your chart expects.
   */
  defaultData = {};

  /**
   * Default props are the built-in styles your chart comes with
   * that you want to allow a user to customize. Remember, you can
   * pass in complex data here, like default d3 axes or accessor
   * functions that can get properties from your data.
   */
  defaultProps = {
    aspectHeight: [
      { breakpoint: 600, ratio: 0.5 },
      { breakpoint: 500, ratio: 0.75 },
      { breakpoint: 0, ratio: 1 },
    ],
    margin: {
      top: 30,
      right: 120,
      bottom: 45,
      left: 10,
    },
    mobileMargin: {
      top: 30,
      right: 10,
      bottom: 35,
      left: 10,
    },
    mobileBreakpoint: 600,
    fill: 'grey',
    highlight: '#74c476',
    axis: {
      minorTicks: [10, null],
    },
    keyOffsets: {
      x: 0,
      y: 0,
    },
  };

  /**
   * Write all your code to draw your chart in this function!
   * Remember to use appendSelect!
   */
  draw() {
    const rawData = this.data(); // Data passed to your chart
    const props = this.props(); // Props passed to your chart

    const data = Object.keys(rawData)
      .map((isoAlpha2) => client.getCountry(isoAlpha2))
      .filter(
        (c) => c.dataProfile.population && c.dataProfile.population.d > 1000000
      )
      .map((country) => {
        const avgs = rawData[country.isoAlpha2].slice().reverse();
        const max = Math.max(...avgs);
        const { length } = avgs;

        return { country, avgs, max, length, last: avgs[0] };
      })
      .filter((d) => d.max > 100);

    const allPoints = flatten(
      data.map((d) => {
        const { country, avgs } = d;
        return avgs.map((avg, i) => ({ country, avg, i }));
      })
    );

    const container = this.selection().node();
    const { width: containerWidth } = container.getBoundingClientRect(); // Respect the width of your container!

    const isMobile = containerWidth <= props.mobileBreakpoint;

    const margin = isMobile ? props.mobileMargin : props.margin;

    const aspectHeight = props.aspectHeight.find(
      (a) => containerWidth > a.breakpoint
    );

    const width = containerWidth - margin.left - margin.right;
    const height =
      containerWidth * aspectHeight.ratio - margin.top - margin.bottom;

    const maxDays = max(data, (d) => d.length);

    const xScale = scaleLinear().domain([0, maxDays]).range([0, width]).nice();

    const yScale = scaleLinear()
      .domain([0, max(data, (d) => d.max)])
      .range([height, 0])
      .nice();

    const alphaScale = scaleLinear()
      .domain([0, max(data, (d) => d.last)])
      .range([0, 0.6]);

    const delaunay = Delaunay.from(
      allPoints,
      (d) => xScale(xScale.domain()[1] - d.i),
      (d) => yScale(d.avg)
    );

    const plot = this.selection()
      .appendSelect('svg') // 👈 Use appendSelect instead of append for non-data-bound elements!
      .attr('width', width + margin.left + margin.right)
      .attr('height', height + margin.top + margin.bottom)
      .appendSelect('g.plot')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    const defs = this.selection().select('svg').appendSelect('defs');
    const tip = this.selection().appendSelect('div.tip');

    // plot
    //   .appendSelect('g.axis.x.minor-ticks')
    //   .attr('transform', `translate(0,${height + 5})`)
    //   .call(
    //     axisBottom(xScale)
    //       .tickFormat((d) => '')
    //       .ticks(
    //         isMobile ?
    //             props.axis.minorTicks[0] || 10 :
    //           props.axis.minorTicks[1] || maxDays
    //       )
    //   );

    const tickValues = isMobile ?
        [0, xScale.domain()[1]] :
        [
          0,
          Math.round((xScale.domain()[1] - xScale.domain()[1] * (2 / 3)) / 10) *
            10, // Nearest number 2/3 between max and min divisible 10
          Math.round((xScale.domain()[1] - xScale.domain()[1] * (1 / 3)) / 10) *
            10, // Nearest number 1/3 between max and min divisible 10
          xScale.domain()[1],
        ];

    plot
      .appendSelect('g.axis.x.major-ticks-and-labels')
      .attr('transform', `translate(0,${height + 5})`)
      .call(
        axisBottom(xScale)
          .tickSize(15)
          .tickFormat((d) => {
            switch (d) {
              case xScale.domain()[1]:
                return 'Last reported';
              case xScale.domain()[0]:
                return `${xScale.domain()[1]} days earlier`;
              default:
                return `${xScale.domain()[1] - d}`;
            }
          })
          .tickValues(tickValues)
      );

    const line = d3Line()
      .x((d, i) => xScale(xScale.domain()[1] - i))
      .y((d) => yScale(d))
      .curve(curveCardinal);

    const highlightDef = defs
      .appendSelect('linearGradient.highlight')
      .attr('id', 'gradient-highlight');

    highlightDef
      .appendSelect('stop.start')
      .attr('offset', '0%')
      .attr('stop-color', props.highlight)
      .attr('stop-opacity', 0.1);

    highlightDef
      .appendSelect('stop.end')
      .attr('offset', '100%')
      .attr('stop-color', props.highlight)
      .attr('stop-opacity', 1);

    const gradients = defs
      .selectAll('linearGradient.country')
      .data(data)
      .join('linearGradient')
      .attr('class', 'country')
      .attr('id', (d) => `gradient-${d.country.isoAlpha2}`);

    gradients
      .appendSelect('stop.start')
      .attr('offset', '0%')
      .attr('stop-color', (d) => `rgba(255,255,255,${alphaScale(d.last)})`)
      .attr('stop-opacity', isMobile ? 0.45 : 0.35);

    gradients
      .appendSelect('stop.end')
      .attr('offset', '100%')
      .attr('stop-color', (d) => `rgba(255,255,255,${alphaScale(d.last)})`)
      .attr('stop-opacity', 1);

    const key = plot.appendSelect('g.chart-key');

    key
      .appendSelect('line')
      .attr('stroke', props.highlight)
      .style('stroke-width', 2)
      .attr('x1', 0 + props.keyOffsets.x)
      .attr('x2', 10 + props.keyOffsets.x)
      .attr('y1', 10 + props.keyOffsets.y)
      .attr('y2', 10 + props.keyOffsets.y);

    key
      .appendSelect('text')
      .attr('fill', props.highlight)
      .attr('x', 15 + props.keyOffsets.x)
      .attr('y', 14 + props.keyOffsets.y)
      .text('7-day rolling avg.');

    const lines = plot
      .appendSelect('g.lines')
      .selectAll('path.line')
      .data(data)
      .join('path')
      .attr('class', (d) => `line country-${d.country.isoAlpha2}`)
      // .style('stroke', d => `rgba(255,255,255,${alphaScale(d.max)})`)
      .attr('stroke', (d) => `url(#gradient-${d.country.isoAlpha2})`)
      .style('stroke-width', 1)
      .style('fill', 'transparent')
      .attr('d', (d) => line(d.avgs));

    const highlightLineFromPoint = (pointer) => {
      const index = delaunay.find(...pointer);
      const { country } = allPoints[index];

      lines
        .style('stroke-width', 1)
        .attr('stroke', (d) => `url(#gradient-${d.country.isoAlpha2})`);

      plot
        .select(`path.country-${country.isoAlpha2}`)
        .style('stroke-width', 2)
        .attr('stroke', 'url(#gradient-highlight)');

      const datum = data.find((d) => d.country.isoAlpha2 === country.isoAlpha2);

      if (isMobile) {
        tip
          .style('text-align', 'right')
          .style('top', `${margin.top}px`)
          .style('right', '5px')
          .style('left', null);
      } else {
        tip
          .style('text-align', 'left')
          .style('top', `${yScale(datum.last) + margin.top - 12}px`)
          .style('right', null)
          .style('left', `${width + margin.left}px`);
      }

      tip.appendSelect('h6').style('color', props.highlight).text(country.name);

      tip
        .appendSelect('p')
        .text(Math.floor(datum.last).toLocaleString('en'))
        .appendSelect('span')
        .text(' doses/100K');
    };

    plot
      .appendSelect('rect')
      .attr('x', 0)
      .attr('y', 0)
      .attr('height', height)
      .attr('width', width)
      .style('fill', 'transparent')
      .style('cursor', 'crosshair')
      .on('touchstart', (event) => {
        if (event.cancelable) event.preventDefault();
      })
      .on('mousemove touchmove', (event) => {
        if (event.cancelable) event.preventDefault();
        const pointer = d3.pointers(event)[0];
        highlightLineFromPoint(pointer);
      })
      .on('touchend', (event) => {
        if (event.cancelable) event.preventDefault();
        // lines.attr('stroke', (d) => `url(#gradient-${d.country.isoAlpha2})`);
      })
      .on('mouseleave', () => {
        if (event.cancelable) event.preventDefault();
        // highlightLineFromPoint([width, 0]);
      });

    highlightLineFromPoint([width, 0]); // Highlights the highest current country by picking a position in top right

    return this; // Generally, always return the chart class from draw!
  }
}

export default VaccinePaceChart;
