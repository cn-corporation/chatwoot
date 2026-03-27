<script setup>
import { ref, onMounted } from 'vue';
import chatwootExtraAPI from '../../../../../api/chatwootExtra';
import Button from 'dashboard/components-next/button/Button.vue';
import SettingsLayout from '../../SettingsLayout.vue';

const tags = ref([]);
const loading = ref(true);
const submitting = ref(false);
const showCreateForm = ref(false);
const editingTagId = ref(null);
const newTag = ref({ name: '', description: '' });
const editTag = ref({ name: '', description: '' });

const handleCreate = async () => {
  if (!newTag.value.name.trim() || submitting.value) return;
  submitting.value = true;
  try {
    const result = await chatwootExtraAPI.createRagTag({
      name: newTag.value.name.trim(),
      description: newTag.value.description.trim(),
    });
    tags.value = [...tags.value, result.data];
    newTag.value = { name: '', description: '' };
    showCreateForm.value = false;
  } finally {
    submitting.value = false;
  }
};

const startEdit = tag => {
  editingTagId.value = tag.id;
  editTag.value = { name: tag.name, description: tag.description || '' };
};

const cancelEdit = () => {
  editingTagId.value = null;
};

const handleUpdate = async id => {
  if (!editTag.value.name.trim() || submitting.value) return;
  submitting.value = true;
  try {
    const result = await chatwootExtraAPI.updateRagTag(id, {
      name: editTag.value.name.trim(),
      description: editTag.value.description.trim(),
    });
    const idx = tags.value.findIndex(t => t.id === id);
    if (idx !== -1) tags.value[idx] = result.data;
    editingTagId.value = null;
  } finally {
    submitting.value = false;
  }
};

const handleDelete = async tag => {
  if (submitting.value) return;
  const confirmed = window.confirm(
    `Delete tag "${tag.name}"? It is used in ${tag.usageCount || 0} sub-sources.`
  );
  if (!confirmed) return;
  submitting.value = true;
  try {
    await chatwootExtraAPI.deleteRagTag(tag.id);
    tags.value = tags.value.filter(t => t.id !== tag.id);
  } finally {
    submitting.value = false;
  }
};

onMounted(async () => {
  try {
    tags.value = await chatwootExtraAPI.getRagTags();
  } finally {
    loading.value = false;
  }
});
</script>

<template>
  <SettingsLayout
    :is-loading="loading"
    loading-message="Loading tags..."
    :no-records-found="!loading && !tags.length && !showCreateForm"
    no-records-message="No tags created yet."
  >
    <template #header>
      <div class="flex items-center justify-between">
        <h2 class="text-base font-medium text-n-slate-12">Tags</h2>
        <Button
          v-if="!showCreateForm"
          icon="i-lucide-plus"
          label="New Tag"
          :disabled="submitting"
          @click="showCreateForm = true"
        />
      </div>
    </template>
    <template #preBody>
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
            :disabled="submitting"
            class="w-full px-3 py-2 text-sm border rounded-lg border-n-weak bg-n-solid-2 text-n-slate-12 placeholder:text-n-slate-9 focus:outline-none focus:ring-1 focus:ring-n-brand disabled:opacity-50"
            @keyup.enter="handleCreate"
          />
        </div>
        <div class="flex-1">
          <label class="block text-xs font-medium text-n-slate-11 mb-1">Description</label>
          <input
            v-model="newTag.description"
            type="text"
            placeholder="Optional description"
            :disabled="submitting"
            class="w-full px-3 py-2 text-sm border rounded-lg border-n-weak bg-n-solid-2 text-n-slate-12 placeholder:text-n-slate-9 focus:outline-none focus:ring-1 focus:ring-n-brand disabled:opacity-50"
            @keyup.enter="handleCreate"
          />
        </div>
        <div class="flex gap-2">
          <Button
            label="Create"
            :is-loading="submitting"
            @click="handleCreate"
          />
          <Button
            label="Cancel"
            slate
            faded
            :disabled="submitting"
            @click="
              showCreateForm = false;
              newTag = { name: '', description: '' };
            "
          />
        </div>
      </div>
    </template>
    <template #body>
      <table class="min-w-full divide-y divide-n-weak">
        <thead>
          <tr>
            <th
              v-for="header in [
                'Name',
                'Description',
                'Usage Count',
                'Actions',
              ]"
              :key="header"
              class="py-4 ltr:pr-4 rtl:pl-4 text-left font-semibold text-n-slate-11 last:text-right"
            >
              {{ header }}
            </th>
          </tr>
        </thead>
        <tbody class="divide-y divide-n-weak text-n-slate-11">
          <tr v-for="tag in tags" :key="tag.id">
            <td class="py-4 ltr:pr-4 rtl:pl-4">
              <template v-if="editingTagId === tag.id">
                <input
                  v-model="editTag.name"
                  type="text"
                  :disabled="submitting"
                  class="w-full px-2 py-1 text-sm border rounded-lg border-n-weak bg-n-solid-2 text-n-slate-12 focus:outline-none focus:ring-1 focus:ring-n-brand disabled:opacity-50"
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
                  :disabled="submitting"
                  class="w-full px-2 py-1 text-sm border rounded-lg border-n-weak bg-n-solid-2 text-n-slate-12 focus:outline-none focus:ring-1 focus:ring-n-brand disabled:opacity-50"
                  @keyup.enter="handleUpdate(tag.id)"
                  @keyup.escape="cancelEdit"
                />
              </template>
              <template v-else>
                {{ tag.description || '-' }}
              </template>
            </td>
            <td class="py-4 ltr:pr-4 rtl:pl-4">{{ tag.usageCount || 0 }}</td>
            <td class="py-4 text-right">
              <div class="flex justify-end gap-1">
                <template v-if="editingTagId === tag.id">
                  <Button
                    v-tooltip.top="'Save'"
                    icon="i-lucide-check"
                    xs
                    faded
                    blue
                    :is-loading="submitting"
                    :disabled="submitting"
                    @click="handleUpdate(tag.id)"
                  />
                  <Button
                    v-tooltip.top="'Cancel'"
                    icon="i-lucide-x"
                    xs
                    faded
                    slate
                    :disabled="submitting"
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
                    :disabled="submitting"
                    @click="startEdit(tag)"
                  />
                  <Button
                    v-tooltip.top="'Delete'"
                    icon="i-lucide-trash-2"
                    xs
                    faded
                    ruby
                    :disabled="submitting"
                    @click="handleDelete(tag)"
                  />
                </template>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </template>
  </SettingsLayout>
</template>
