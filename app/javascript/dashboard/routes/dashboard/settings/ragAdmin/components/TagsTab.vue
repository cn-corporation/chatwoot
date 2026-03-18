<script setup>
import { ref, onMounted } from 'vue';
import chatwootExtraAPI from '../../../../../api/chatwootExtra';
import Button from 'dashboard/components-next/button/Button.vue';

const tags = ref([]);
const loading = ref(true);
const showCreateForm = ref(false);
const editingTagId = ref(null);
const newTag = ref({ name: '', description: '' });
const editTag = ref({ name: '', description: '' });

const fetchTags = async () => {
  try {
    tags.value = await chatwootExtraAPI.getRagTags();
  } finally {
    loading.value = false;
  }
};

const handleCreate = async () => {
  if (!newTag.value.name.trim()) return;
  await chatwootExtraAPI.createRagTag({
    name: newTag.value.name.trim(),
    description: newTag.value.description.trim(),
  });
  newTag.value = { name: '', description: '' };
  showCreateForm.value = false;
  await fetchTags();
};

const startEdit = (tag) => {
  editingTagId.value = tag.id;
  editTag.value = { name: tag.name, description: tag.description || '' };
};

const cancelEdit = () => {
  editingTagId.value = null;
  editTag.value = { name: '', description: '' };
};

const handleUpdate = async (id) => {
  if (!editTag.value.name.trim()) return;
  await chatwootExtraAPI.updateRagTag(id, {
    name: editTag.value.name.trim(),
    description: editTag.value.description.trim(),
  });
  editingTagId.value = null;
  await fetchTags();
};

const handleDelete = async (tag) => {
  const confirmed = window.confirm(
    `Delete tag "${tag.name}"? It is used in ${tag.usageCount || 0} sub-sources.`
  );
  if (!confirmed) return;
  await chatwootExtraAPI.deleteRagTag(tag.id);
  await fetchTags();
};

onMounted(() => fetchTags());
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-4">
      <h2 class="text-base font-medium text-n-slate-12">Tags</h2>
      <Button
        v-if="!showCreateForm"
        icon="i-lucide-plus"
        label="New Tag"
        @click="showCreateForm = true"
      />
    </div>
    <div
      v-if="showCreateForm"
      class="flex items-end gap-3 mb-4 p-4 rounded-lg border border-slate-200 dark:border-slate-700"
    >
      <div class="flex-1">
        <label class="block text-xs font-medium text-n-slate-11 mb-1">Name</label>
        <input
          v-model="newTag.name"
          type="text"
          placeholder="Tag name"
          class="w-full px-3 py-2 text-sm border rounded-lg border-n-weak bg-n-solid-2 text-n-slate-12 placeholder:text-n-slate-9 focus:outline-none focus:ring-1 focus:ring-n-brand"
          @keyup.enter="handleCreate"
        />
      </div>
      <div class="flex-1">
        <label class="block text-xs font-medium text-n-slate-11 mb-1">Description</label>
        <input
          v-model="newTag.description"
          type="text"
          placeholder="Optional description"
          class="w-full px-3 py-2 text-sm border rounded-lg border-n-weak bg-n-solid-2 text-n-slate-12 placeholder:text-n-slate-9 focus:outline-none focus:ring-1 focus:ring-n-brand"
          @keyup.enter="handleCreate"
        />
      </div>
      <div class="flex gap-2">
        <Button label="Create" @click="handleCreate" />
        <Button
          label="Cancel"
          slate
          faded
          @click="showCreateForm = false; newTag = { name: '', description: '' }"
        />
      </div>
    </div>
    <div v-if="loading" class="flex justify-center py-8">
      <span class="i-lucide-loader-2 animate-spin h-6 w-6 text-slate-400" />
    </div>
    <p
      v-else-if="!tags.length"
      class="flex flex-col items-center justify-center text-base text-n-slate-11 py-8"
    >
      No tags created yet.
    </p>
    <table
      v-else
      class="min-w-full overflow-x-auto divide-y divide-n-weak"
    >
      <thead>
        <th
          v-for="header in ['Name', 'Description', 'Usage Count', 'Actions']"
          :key="header"
          class="py-4 ltr:pr-4 rtl:pl-4 text-left font-semibold text-n-slate-11 last:text-right"
        >
          {{ header }}
        </th>
      </thead>
      <tbody class="divide-y divide-n-weak text-n-slate-11">
        <tr v-for="tag in tags" :key="tag.id">
          <td class="py-4 ltr:pr-4 rtl:pl-4">
            <template v-if="editingTagId === tag.id">
              <input
                v-model="editTag.name"
                type="text"
                class="w-full px-2 py-1 text-sm border rounded-lg border-n-weak bg-n-solid-2 text-n-slate-12 focus:outline-none focus:ring-1 focus:ring-n-brand"
                @keyup.enter="handleUpdate(tag.id)"
                @keyup.escape="cancelEdit"
              />
            </template>
            <template v-else>
              <span class="font-medium text-n-slate-12">{{ tag.name }}</span>
            </template>
          </td>
          <td class="py-4 ltr:pr-4 rtl:pl-4">
            <template v-if="editingTagId === tag.id">
              <input
                v-model="editTag.description"
                type="text"
                class="w-full px-2 py-1 text-sm border rounded-lg border-n-weak bg-n-solid-2 text-n-slate-12 focus:outline-none focus:ring-1 focus:ring-n-brand"
                @keyup.enter="handleUpdate(tag.id)"
                @keyup.escape="cancelEdit"
              />
            </template>
            <template v-else>
              {{ tag.description || '-' }}
            </template>
          </td>
          <td class="py-4 ltr:pr-4 rtl:pl-4">
            {{ tag.usageCount || 0 }}
          </td>
          <td class="py-4 flex justify-end gap-1">
            <template v-if="editingTagId === tag.id">
              <Button
                v-tooltip.top="'Save'"
                icon="i-lucide-check"
                xs
                faded
                blue
                @click="handleUpdate(tag.id)"
              />
              <Button
                v-tooltip.top="'Cancel'"
                icon="i-lucide-x"
                xs
                faded
                slate
                @click="cancelEdit"
              />
            </template>
            <template v-else>
              <Button
                v-tooltip.top="'Edit'"
                icon="i-lucide-pencil"
                xs
                faded
                slate
                @click="startEdit(tag)"
              />
              <Button
                v-tooltip.top="'Delete'"
                icon="i-lucide-trash-2"
                xs
                faded
                ruby
                @click="handleDelete(tag)"
              />
            </template>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
