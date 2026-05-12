<script setup>
import { computed, useTemplateRef } from 'vue';
import { useElementBounding } from '@vueuse/core';
import { REPLY_EDITOR_MODES } from './constants';

const props = defineProps({
  mode: {
    type: String,
    default: REPLY_EDITOR_MODES.REPLY,
  },
  disabled: {
    type: Boolean,
    default: false,
  },
});

defineEmits(['selectMode']);

const wootEditorReplyMode = useTemplateRef('wootEditorReplyMode');
const wootEditorPrivateMode = useTemplateRef('wootEditorPrivateMode');
const wootEditorTaskMode = useTemplateRef('wootEditorTaskMode');
const wootEditorTranslateMode = useTemplateRef('wootEditorTranslateMode');

const replyBound = useElementBounding(wootEditorReplyMode);
const privateBound = useElementBounding(wootEditorPrivateMode);
const taskBound = useElementBounding(wootEditorTaskMode);
const translateBound = useElementBounding(wootEditorTranslateMode);

const isPrivate = computed(() => {
  return props.disabled || props.mode === REPLY_EDITOR_MODES.NOTE;
});

const isTask = computed(() => {
  return props.mode === REPLY_EDITOR_MODES.TASK;
});

const isTranslate = computed(() => {
  return props.mode === REPLY_EDITOR_MODES.TRANSLATE;
});

const activeBound = computed(() => {
  if (isTranslate.value) return translateBound;
  if (isTask.value) return taskBound;
  if (isPrivate.value) return privateBound;
  return replyBound;
});

const width = computed(() => `${activeBound.value.width.value}px`);

const translateValue = computed(() => {
  const delta = activeBound.value.left.value - replyBound.left.value;
  return `${delta}px`;
});
</script>

<template>
  <div
    class="flex items-center w-full md:w-auto h-8 p-1 transition-all border rounded-full bg-n-alpha-2 group relative duration-300 ease-in-out z-0"
    :class="{
      'cursor-not-allowed': disabled,
    }"
  >
    <div
      class="absolute shadow-sm rounded-full h-6 w-[var(--chip-width)] ease-in-out translate-x-[var(--translate-x)] rtl:translate-x-[var(--rtl-translate-x)] bg-n-solid-1"
      :class="{
        'transition-all duration-300': !disabled,
      }"
      :style="{
        '--chip-width': width,
        '--translate-x': translateValue,
        '--rtl-translate-x': `calc(-1 * var(--translate-x))`,
      }"
    />
    <button
      ref="wootEditorReplyMode"
      class="flex flex-1 md:flex-initial items-center justify-center gap-1 px-1 md:px-2 text-xs md:text-sm z-20 relative"
      :disabled="disabled"
      :class="{
        'cursor-not-allowed': disabled,
      }"
      @click="!disabled && $emit('selectMode', REPLY_EDITOR_MODES.REPLY)"
    >
      {{ $t('CONVERSATION.REPLYBOX.REPLY') }}
    </button>
    <button
      ref="wootEditorPrivateMode"
      class="flex flex-1 md:flex-initial items-center justify-center gap-1 px-1 md:px-2 text-xs md:text-sm z-20 relative"
      :disabled="disabled"
      :class="{
        'cursor-not-allowed': disabled,
      }"
      @click="!disabled && $emit('selectMode', REPLY_EDITOR_MODES.NOTE)"
    >
      {{ $t('CONVERSATION.REPLYBOX.PRIVATE_NOTE') }}
    </button>
    <button
      ref="wootEditorTaskMode"
      class="flex flex-1 md:flex-initial items-center justify-center gap-1 px-1 md:px-2 text-xs md:text-sm z-20 relative"
      :disabled="disabled"
      :class="{
        'cursor-not-allowed': disabled,
      }"
      @click="!disabled && $emit('selectMode', REPLY_EDITOR_MODES.TASK)"
    >
      {{ $t('CONVERSATION.REPLYBOX.TASK') }}
    </button>
    <button
      ref="wootEditorTranslateMode"
      class="flex flex-1 md:flex-initial items-center justify-center gap-1 px-1 md:px-2 text-xs md:text-sm z-20 relative"
      :disabled="disabled"
      :class="{
        'cursor-not-allowed': disabled,
      }"
      @click="!disabled && $emit('selectMode', REPLY_EDITOR_MODES.TRANSLATE)"
    >
      {{ $t('CONVERSATION.REPLYBOX.TRANSLATOR.TAB') }}
    </button>
  </div>
</template>
