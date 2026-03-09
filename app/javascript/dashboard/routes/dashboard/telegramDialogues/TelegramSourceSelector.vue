<script setup>
defineProps({
  sources: { type: Array, default: () => [] },
  activeSourceId: { type: String, default: null },
});

const emit = defineEmits(['select']);
</script>

<template>
  <div class="p-3 border-b border-n-weak">
    <select
      :value="activeSourceId"
      class="w-full rounded-lg border border-n-weak bg-n-solid-3 px-3 py-1.5 text-sm outline-none"
      @change="emit('select', $event.target.value)"
    >
      <option v-for="source in sources" :key="source.id" :value="source.id">
        {{ source.name }}
      </option>
    </select>
  </div>
</template>
