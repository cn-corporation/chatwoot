<script>
import { BUS_EVENTS } from 'shared/constants/busEvents';
import { emitter } from 'shared/helpers/mitt';

export default {
  data() {
    return {
      showBannerMessage: false,
      bannerMessage: '',
      bannerType: 'error',
      bannerTimeout: null,
    };
  },
  mounted() {
    emitter.on(BUS_EVENTS.SHOW_ALERT, this.handleShowAlert);
  },
  beforeUnmount() {
    emitter.off(BUS_EVENTS.SHOW_ALERT, this.handleShowAlert);
    if (this.bannerTimeout) {
      clearTimeout(this.bannerTimeout);
      this.bannerTimeout = null;
    }
  },
  methods: {
    handleShowAlert({ message, type = 'error' }) {
      this.bannerMessage = message;
      this.bannerType = type;
      this.showBannerMessage = true;

      if (this.bannerTimeout) {
        clearTimeout(this.bannerTimeout);
      }

      this.bannerTimeout = setTimeout(() => {
        this.showBannerMessage = false;
        this.bannerTimeout = null;
      }, 3000);
    },
  },
};
</script>

<!-- eslint-disable-next-line vue/no-root-v-if -->
<template>
  <div v-if="showBannerMessage" :class="`banner ${bannerType}`">
    <span>
      {{ bannerMessage }}
    </span>
  </div>
</template>

<style scoped lang="scss">
.banner {
  @apply text-white text-sm font-semibold p-3 text-center;

  &.success {
    @apply bg-n-teal-9;
  }

  &.error {
    @apply bg-n-ruby-9;
  }
}
</style>
