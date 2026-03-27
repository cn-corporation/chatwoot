<script setup>
import { ref, computed } from 'vue';
import Button from 'dashboard/components-next/button/Button.vue';
import IndexingLoader from './IndexingLoader.vue';
import chatwootExtraAPI from '../../../../../api/chatwootExtra';

const props = defineProps({
  source: {
    type: Object,
    required: true,
  },
  allTags: {
    type: Array,
    default: () => [],
  },
  onUpdate: {
    type: Function,
    required: true,
  },
  onDelete: {
    type: Function,
    required: true,
  },
  onStatusRefresh: {
    type: Function,
    required: true,
  },
});

const expanded = ref(false);
const selectedTags = ref({});
const actionInProgress = ref(null);

const isActionBusy = computed(() => !!actionInProgress.value);
const isProcessing = computed(() => props.source.status === 'processing');
const isIndexed = computed(() => props.source.status === 'indexed');
const isPending = computed(() => props.source.status === 'pending');
const isError = computed(() => props.source.status === 'error');

const totalChunks = computed(() =>
  (props.source.subSources || []).reduce(
    (sum, s) => sum + (s.chunkCount || 0),
    0
  )
);

const subSources = computed(() => props.source.subSources || []);

const statusBadge = computed(() => {
  const map = {
    pending: {
      bg: 'bg-slate-100 dark:bg-slate-800',
      text: 'text-slate-600 dark:text-slate-400',
      dot: 'bg-slate-400',
      label: 'Pending',
    },
    processing: {
      bg: 'bg-amber-50 dark:bg-amber-950',
      text: 'text-amber-700 dark:text-amber-400',
      dot: 'bg-amber-500',
      label: '',
    },
    indexed: {
      bg: 'bg-emerald-50 dark:bg-emerald-950',
      text: 'text-emerald-700 dark:text-emerald-400',
      dot: 'bg-emerald-500',
      label: 'Indexed',
    },
    error: {
      bg: 'bg-red-50 dark:bg-red-950',
      text: 'text-red-700 dark:text-red-400',
      dot: 'bg-red-500',
      label: 'Error',
    },
  };
  return map[props.source.status] || map.pending;
});

const availableTagsForSubSource = subSource => {
  const assignedIds = new Set((subSource.tags || []).map(t => t.id));
  return props.allTags.filter(t => !assignedIds.has(t.id));
};

const setLocal = updates => {
  props.onUpdate({ ...props.source, ...updates });
};

const withAction = async (name, fn, successUpdates) => {
  if (actionInProgress.value) return;
  actionInProgress.value = name;
  try {
    await fn();
    setLocal(successUpdates);
  } catch {
    try {
      await props.onStatusRefresh();
    } catch {
      /* ignore */
    }
  }
  actionInProgress.value = null;
};

const handleIndex = () =>
  withAction('index', () => chatwootExtraAPI.indexRagSource(props.source.id), {
    status: 'processing',
  });

const handleReindex = () =>
  withAction(
    'reindex',
    () => chatwootExtraAPI.reindexRagSource(props.source.id),
    { status: 'processing' }
  );

const handleDeindex = () =>
  withAction(
    'deindex',
    () => chatwootExtraAPI.deindexRagSource(props.source.id),
    { status: 'pending', indexedAt: null, subSources: [] }
  );

const handleDelete = async () => {
  if (actionInProgress.value) return;
  const confirmed = window.confirm(
    `Delete "${props.source.filename}"?\nThis will remove all indexed chunks and the source file.`
  );
  if (!confirmed) return;
  actionInProgress.value = 'delete';
  try {
    await chatwootExtraAPI.deleteRagSource(props.source.id);
    props.onDelete(props.source.id);
  } catch {
    try {
      await props.onStatusRefresh();
    } catch {
      /* ignore */
    }
  }
  actionInProgress.value = null;
};

const patchSubSourceTags = (subSourceName, patchFn) => {
  props.onUpdate({
    ...props.source,
    subSources: (props.source.subSources || []).map(s =>
      s.name === subSourceName ? { ...s, tags: patchFn(s.tags || []) } : s
    ),
  });
};

const handleAddTag = async subSource => {
  const tagId = selectedTags.value[subSource.name];
  if (!tagId || actionInProgress.value) return;
  const tag = props.allTags.find(t => t.id === tagId);
  selectedTags.value[subSource.name] = '';
  patchSubSourceTags(subSource.name, tags => [
    ...tags,
    { id: tagId, name: tag?.name },
  ]);
  actionInProgress.value = 'tag';
  try {
    await chatwootExtraAPI.addRagSubSourceTag(
      props.source.id,
      subSource.name,
      tagId
    );
  } catch {
    await props.onStatusRefresh();
  } finally {
    actionInProgress.value = null;
  }
};

const handleRemoveTag = async (subSource, tagId) => {
  if (actionInProgress.value) return;
  patchSubSourceTags(subSource.name, tags => tags.filter(t => t.id !== tagId));
  actionInProgress.value = 'tag';
  try {
    await chatwootExtraAPI.removeRagSubSourceTag(
      props.source.id,
      subSource.name,
      tagId
    );
  } catch {
    await props.onStatusRefresh();
  } finally {
    actionInProgress.value = null;
  }
};
</script>

<template>
  <div
    class="rounded-xl border border-slate-200 dark:border-slate-700 mb-3 overflow-hidden transition-shadow"
    :class="{ 'ring-1 ring-woot-200 dark:ring-woot-800': expanded }"
  >
    <div
      class="flex items-center gap-4 px-5 py-3.5 cursor-pointer select-none hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors"
      @click="expanded = !expanded"
    >
      <span
        class="i-lucide-chevron-right h-4 w-4 text-slate-400 transition-transform duration-200 flex-shrink-0"
        :class="{ 'rotate-90': expanded }"
      />

      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2.5">
          <span
            class="i-lucide-file-text h-4 w-4 text-slate-400 flex-shrink-0"
          />
          <span class="font-medium text-sm text-n-slate-12 truncate">
            {{ source.filename }}
          </span>
        </div>
      </div>

      <div class="flex items-center gap-3 flex-shrink-0">
        <span
          class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
          :class="[statusBadge.bg, statusBadge.text]"
        >
          <IndexingLoader v-if="isProcessing" />
          <template v-else>
            <span class="h-1.5 w-1.5 rounded-full" :class="statusBadge.dot" />
            {{ statusBadge.label }}
          </template>
        </span>

        <span
          v-if="totalChunks"
          class="text-xs text-slate-500 dark:text-slate-400 tabular-nums"
        >
          {{ totalChunks }} chunks
        </span>

        <span
          v-if="source.indexedAt"
          class="text-xs text-slate-500 dark:text-slate-400"
        >
          {{ new Date(source.indexedAt).toLocaleDateString() }}
        </span>
      </div>
    </div>

    <div v-if="isError && source.errorMessage" class="px-5 pb-3 -mt-1">
      <div
        class="flex items-start gap-2 px-3 py-2 rounded-lg bg-red-50 dark:bg-red-950/50"
      >
        <span
          class="i-lucide-alert-circle h-3.5 w-3.5 text-red-500 flex-shrink-0 mt-0.5"
        />
        <span class="text-xs text-red-700 dark:text-red-400 break-words">{{
          source.errorMessage
        }}</span>
      </div>
    </div>

    <div
      class="flex items-center gap-2 px-5 pb-3.5 border-b border-slate-100 dark:border-slate-800"
      @click.stop
    >
      <Button
        v-if="isPending || isError || actionInProgress === 'index'"
        icon="i-lucide-play"
        label="Index"
        xs
        faded
        blue
        :is-loading="actionInProgress === 'index'"
        :disabled="isActionBusy"
        @click="handleIndex"
      />
      <Button
        v-if="isIndexed || actionInProgress === 'reindex'"
        icon="i-lucide-refresh-cw"
        label="Re-index"
        xs
        faded
        blue
        :is-loading="actionInProgress === 'reindex'"
        :disabled="isActionBusy"
        @click="handleReindex"
      />
      <Button
        v-if="isIndexed || actionInProgress === 'deindex'"
        icon="i-lucide-circle-stop"
        label="De-index"
        xs
        faded
        amber
        :is-loading="actionInProgress === 'deindex'"
        :disabled="isActionBusy"
        @click="handleDeindex"
      />
      <div class="flex-1" />
      <Button
        v-if="!isProcessing || actionInProgress === 'delete'"
        icon="i-lucide-trash-2"
        label="Delete"
        xs
        faded
        ruby
        :is-loading="actionInProgress === 'delete'"
        :disabled="isActionBusy"
        @click="handleDelete"
      />
    </div>

    <div
      v-if="expanded && subSources.length"
      class="bg-slate-50/50 dark:bg-slate-800/30"
    >
      <div class="px-5 py-3">
        <div
          class="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3"
        >
          Sub-sources ({{ subSources.length }})
        </div>
        <div class="space-y-2.5">
          <div
            v-for="sub in subSources"
            :key="sub.id"
            class="rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-3"
          >
            <div class="flex items-center justify-between gap-3 mb-2">
              <div class="flex items-center gap-2 min-w-0">
                <span
                  class="i-lucide-layers h-3.5 w-3.5 text-slate-400 flex-shrink-0"
                />
                <span class="text-sm font-medium text-n-slate-12 truncate">{{
                  sub.name
                }}</span>
              </div>
              <span
                class="text-xs text-slate-500 dark:text-slate-400 tabular-nums flex-shrink-0"
              >
                {{ sub.chunkCount }} chunks
              </span>
            </div>

            <div class="flex items-center flex-wrap gap-1.5">
              <span
                v-for="tag in sub.tags"
                :key="tag.id"
                class="inline-flex items-center gap-1 pl-2 pr-1 py-0.5 rounded-md text-xs font-medium bg-woot-50 dark:bg-woot-950 text-woot-700 dark:text-woot-300 border border-woot-200 dark:border-woot-800"
              >
                {{ tag.name }}
                <button
                  class="p-0.5 rounded hover:bg-woot-100 dark:hover:bg-woot-900 transition-colors disabled:opacity-30"
                  :disabled="isActionBusy"
                  @click="handleRemoveTag(sub, tag.id)"
                >
                  <span class="i-lucide-x h-3 w-3" />
                </button>
              </span>

              <select
                v-if="availableTagsForSubSource(sub).length"
                v-model="selectedTags[sub.name]"
                class="text-xs border border-dashed border-slate-300 dark:border-slate-600 rounded-md px-2 py-1 bg-transparent text-slate-500 dark:text-slate-400 disabled:opacity-30 cursor-pointer hover:border-woot-400 transition-colors"
                :disabled="isActionBusy"
                @change="handleAddTag(sub)"
              >
                <option value="">+ Add tag</option>
                <option
                  v-for="tag in availableTagsForSubSource(sub)"
                  :key="tag.id"
                  :value="tag.id"
                >
                  {{ tag.name }}
                </option>
              </select>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div
      v-else-if="expanded"
      class="bg-slate-50/50 dark:bg-slate-800/30 px-5 py-6 text-center"
    >
      <span
        class="i-lucide-inbox h-8 w-8 text-slate-300 dark:text-slate-600 mx-auto mb-2 block"
      />
      <span class="text-sm text-slate-500 dark:text-slate-400">
        {{
          isPending
            ? 'Index this source to see sub-sources'
            : 'No sub-sources found'
        }}
      </span>
    </div>
  </div>
</template>
