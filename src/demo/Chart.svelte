<!-- ⭐ Write an interactive DEMO of your chart in this component.
Follow the notes below! -->
<script>
  export let responsive; // eslint-disable-line
  import { afterUpdate } from 'svelte';
  import Docs from './App/Docs.svelte';
  import Explorer from './App/Explorer.svelte';
  import VaccinePaceChart from '../js/index';

  let chart = new VaccinePaceChart();
  let chartContainer;

  // 🎚️ Create variables for any data or props you want users to be able
  // to update in the demo. (And write buttons to update them below!)
  let chartData;

  let circleFill = 'steelblue';
  // ...

  // 🎈 Tie your custom props back together into one chartProps object.
  $: chartProps = { fill: circleFill };

  afterUpdate(async() => {
    if (!chartData) {
      const res = await fetch('https://graphics.thomsonreuters.com/data/2020/coronavirus/owid-covid-vaccinations/rolling-averages-by-country.json');
      chartData = await res.json();
    }
    // 💪 Create a new chart instance of your module.
    chart = new VaccinePaceChart();
    // ⚡ And let's use your chart!
    chart
      .selection(chartContainer)
      .data(chartData) // Pass your chartData
      .props(chartProps) // Pass your chartProps
      .draw(); // 🚀 DRAW IT!
  });
</script>

<!-- 🖌️ Style your demo page here -->
<style lang="scss">
  .chart-options {
    button {
      padding: 5px 15px;
    }
  }
</style>

<div id="vaccine-pace-chart-container" bind:this={chartContainer} />

<div class="chart-options">
  <!-- ✏️ Create buttons that update your data/props variables when they're clicked! -->
</div>

<!-- ⚙️ These components will automatically create interactive documentation for you chart! -->
<Docs />
<Explorer title='Data' data={chart.data()} />
<Explorer title='Props' data={chart.props()} />
