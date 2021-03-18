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
    aspectHeight: 0.5,
    margin: {
      top: 30,
      right: 150,
      bottom: 35,
      left: 0,
    },
    fill: 'grey',
  };

  /**
   * Write all your code to draw your chart in this function!
   * Remember to use appendSelect!
   */
  draw() {
    const rawData = this.data(); // Data passed to your chart
    const props = this.props(); // Props passed to your chart

    const data = Object.keys(rawData)
      .map(isoAlpha2 => client.getCountry(isoAlpha2))
      .filter(c => c.dataProfile.population && c.dataProfile.population.d > 1000000)
      .map((country) => {
        const avgs = rawData[country.isoAlpha2].slice().reverse();
        const max = Math.max(...avgs);
        const { length } = avgs;

        return { country, avgs, max, length, last: avgs[0] };
      })
      .filter(d => d.max > 100);

    const allPoints = flatten(data.map(d => {
      const { country, avgs } = d;
      return avgs.map((avg, i) => ({ country, avg, i }));
    }));

    const { margin } = props;

    const container = this.selection().node();
    const { width: containerWidth } = container.getBoundingClientRect(); // Respect the width of your container!

    const width = containerWidth - margin.left - margin.right;
    const height = (containerWidth * props.aspectHeight) - margin.top - margin.bottom;

    const xScale = scaleLinear()
      .domain([0, max(data, d => d.length)])
      .range([0, width])
      .nice();

    // const xScaleReverse = scaleLinear()
    //   .domain([max(data, d => d.length), 0])
    //   .range([0, width])
    //   .nice();

    const yScale = scaleLinear()
      .domain([0, max(data, d => d.max)])
      .range([height, 0])
      .nice();

    const alphaScale = scaleLinear()
      .domain([0, max(data, d => d.last)])
      .range([0, 0.6]);

    const delaunay = Delaunay.from(allPoints, d => xScale(xScale.domain()[1] - d.i), d => yScale(d.avg));

    const plot = this.selection()
      .appendSelect('svg') // 👈 Use appendSelect instead of append for non-data-bound elements!
      .attr('width', width + margin.left + margin.right)
      .attr('height', height + margin.top + margin.bottom)
      .appendSelect('g.plot')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    const defs = this.selection()
      .select('svg')
      .appendSelect('defs');

    // plot
    //   .appendSelect('g.axis.x')
    //   .attr('transform', `translate(0,${height})`)
    //   .call(axisBottom(xScaleReverse));

    // plot
    //   .appendSelect('g.axis.y')
    //   .attr('transform', `translate(${width + 10}, 0)`)
    //   .call(axisRight(yScale).ticks(4));

    const line = d3Line()
      .x((d, i) => xScale(xScale.domain()[1] - i))
      .y(d => yScale(d))
      .curve(curveCardinal);

    const highlightDef = defs.appendSelect('linearGradient.highlight')
      .attr('id', 'gradient-highlight');

    highlightDef
      .appendSelect('stop.start')
      .attr('offset', '0%')
      .attr('stop-color', '#74c476')
      .attr('stop-opacity', 0.1);

    highlightDef
      .appendSelect('stop.end')
      .attr('offset', '100%')
      .attr('stop-color', '#74c476')
      .attr('stop-opacity', 1);

    const gradients = defs.selectAll('linearGradient.country')
      .data(data)
      .join('linearGradient')
      .attr('class', 'country')
      .attr('id', d => `gradient-${d.country.isoAlpha2}`);

    gradients
      .appendSelect('stop.start')
      .attr('offset', '0%')
      .attr('stop-color', d => `rgba(255,255,255,${alphaScale(d.last)})`)
      .attr('stop-opacity', 0.2);

    gradients
      .appendSelect('stop.end')
      .attr('offset', '100%')
      .attr('stop-color', d => `rgba(255,255,255,${alphaScale(d.last)})`)
      .attr('stop-opacity', 1);

    const lines = plot.selectAll('path.line')
      .data(data)
      .join('path')
      .attr('class', d => `line country-${d.country.isoAlpha2}`)
      // .style('stroke', d => `rgba(255,255,255,${alphaScale(d.max)})`)
      .attr('stroke', d => `url(#gradient-${d.country.isoAlpha2})`)
      .style('stroke-width', 1)
      .style('fill', 'transparent')
      .attr('d', d => line(d.avgs));

    plot.appendSelect('rect')
      .attr('x', 0)
      .attr('y', 0)
      .attr('height', height)
      .attr('width', width)
      .style('fill', 'transparent')
      .style('cursor', 'crosshair')
      .on('mousemove', event => {
        const pointer = d3.pointer(event);
        const index = delaunay.find(...pointer);
        const { country } = allPoints[index];

        lines
          .style('stroke-width', 1)
          .attr('stroke', d => `url(#gradient-${d.country.isoAlpha2})`);

        plot.select(`path.country-${country.isoAlpha2}`)
          .style('stroke-width', 2)
          .attr('stroke', 'url(#gradient-highlight)');

        const datum = data.find(d => d.country.isoAlpha2 === country.isoAlpha2);

        plot.appendSelect('text')
          .attr('x', width + 5)
          .attr('y', yScale(datum.last) + 5)
          .style('fill', '#74c476')
          .text(country.name);
      })
      .on('mouseleave', () => {
        lines.attr('stroke', d => `url(#gradient-${d.country.isoAlpha2})`);
      });

    return this; // Generally, always return the chart class from draw!
  }
}

export default VaccinePaceChart;
