<script>
  import Nav from './Nav.svelte';
  import ChartContainer from './ChartContainer.svelte';
  import Chart from '../Chart.svelte';

  let width = 'wider';
  let setWidth = (w) => {
    width = w;
  };
</script>

<Nav />
<article class="container-fluid">
  <ChartContainer {width} {setWidth}>
    <Chart responsive={width} />
  </ChartContainer>
</article>

<style>
  article {
    padding-bottom: 80px;
  }
</style>
