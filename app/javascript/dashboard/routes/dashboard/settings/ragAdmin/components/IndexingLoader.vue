<script setup>
import { ref, onMounted, onUnmounted } from 'vue';

const words = [
  'Chunking',
  'Embedding',
  'Ingesting',
  'Analyzing',
  'Processing',
  'Indexing',
];
const currentWord = ref(words[0]);
let interval;
let index = 0;

onMounted(() => {
  interval = setInterval(() => {
    index = (index + 1) % words.length;
    currentWord.value = words[index];
  }, 2000);
});

onUnmounted(() => clearInterval(interval));
</script>

<template>
  <span
    class="inline-flex items-center gap-1.5 text-sm text-amber-600 dark:text-amber-400"
  >
    <span class="i-lucide-loader-2 animate-spin h-3.5 w-3.5" />
    <span class="transition-all duration-300">{{ currentWord }}...</span>
  </span>
</template>
