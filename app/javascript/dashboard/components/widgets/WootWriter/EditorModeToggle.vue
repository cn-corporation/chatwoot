<script setup>
import { computed, useTemplateRef } from 'vue';
import { useElementSize } from '@vueuse/core';
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

const replyModeSize = useElementSize(wootEditorReplyMode);
const privateModeSize = useElementSize(wootEditorPrivateMode);
const taskModeSize = useElementSize(wootEditorTaskMode);
const translateModeSize = useElementSize(wootEditorTranslateMode);

/**
 * Computed boolean indicating if the editor is in private note mode
 * When disabled, always show NOTE mode regardless of actual mode prop
 * @type {ComputedRef<boolean>}
 */
const isPrivate = computed(() => {
  return props.disabled || props.mode === REPLY_EDITOR_MODES.NOTE;
});

/**
 * Computed boolean indicating if the editor is in task mode
 * @type {ComputedRef<boolean>}
 */
const isTask = computed(() => {
  return props.mode === REPLY_EDITOR_MODES.TASK;
});

/**
 * Computed boolean indicating if the editor is in translate mode
 * @type {ComputedRef<boolean>}
 */
const isTranslate = computed(() => {
  return props.mode === REPLY_EDITOR_MODES.TRANSLATE;
});

/**
 * Computes the width of the sliding background chip in pixels
 * Includes 16px of padding in the calculation
 * @type {ComputedRef<string>}
 */
const width = computed(() => {
  let widthToUse;
  if (isTranslate.value) {
    widthToUse = translateModeSize.width.value;
  } else if (isTask.value) {
    widthToUse = taskModeSize.width.value;
  } else if (isPrivate.value) {
    widthToUse = privateModeSize.width.value;
  } else {
    widthToUse = replyModeSize.width.value;
  }

  const widthWithPadding = widthToUse + 16;
  return `${widthWithPadding}px`;
});

/**
 * Computes the X translation value for the sliding background chip
 * Translates by the width of previous modes + padding
 * @type {ComputedRef<string>}
 */
const translateValue = computed(() => {
  let xTranslate = 0;
  if (isTranslate.value) {
    xTranslate =
      replyModeSize.width.value +
      privateModeSize.width.value +
      taskModeSize.width.value +
      48;
  } else if (isTask.value) {
    xTranslate = replyModeSize.width.value + privateModeSize.width.value + 32;
  } else if (isPrivate.value) {
    xTranslate = replyModeSize.width.value + 16;
  }

  return `${xTranslate}px`;
});
</script>

<template>
  <div
    class="flex items-center w-auto h-8 p-1 transition-all border rounded-full bg-n-alpha-2 group relative duration-300 ease-in-out z-0"
    :class="{
      'cursor-not-allowed': disabled,
    }"
  >
    <button
      ref="wootEditorReplyMode"
      class="flex items-center gap-1 px-2 z-20 relative"
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
      class="flex items-center gap-1 px-2 z-20 relative"
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
      class="flex items-center gap-1 px-2 z-20 relative"
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
      class="flex items-center gap-1 px-2 z-20 relative"
      :disabled="disabled"
      :class="{
        'cursor-not-allowed': disabled,
      }"
      @click="!disabled && $emit('selectMode', REPLY_EDITOR_MODES.TRANSLATE)"
    >
      {{ $t('CONVERSATION.REPLYBOX.TRANSLATOR.TAB') }}
    </button>
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
  </div>
</template>
