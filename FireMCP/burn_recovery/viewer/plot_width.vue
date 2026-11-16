<template><div style="width:100%;height:0;min-width:0" aria-hidden="true"></div></template>
<script>
module.exports = {
  mounted() {
    this.observer = new ResizeObserver(entries => {
      const measured = Math.floor(entries[0].contentRect.width);
      if (measured > 0 && measured !== this.width) this.width = measured;
    });
    this.observer.observe(this.$el);
  },
  beforeDestroy() { if (this.observer) this.observer.disconnect(); },
  beforeUnmount() { if (this.observer) this.observer.disconnect(); }
};
</script>
