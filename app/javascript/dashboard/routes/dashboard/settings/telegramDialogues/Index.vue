<script setup>
import { ref, computed, onMounted } from 'vue';
import { useStore } from 'vuex';
import { useMapGetter } from 'dashboard/composables/store';
import SettingsLayout from '../SettingsLayout.vue';
import Button from 'dashboard/components-next/button/Button.vue';
import Avatar from 'next/avatar/Avatar.vue';
import chatwootExtraAPI from '../../../../api/chatwootExtra';

const store = useStore();
const agents = useMapGetter('agents/getAgents');

const operators = ref([]);
const loading = ref(true);
const adding = ref(false);
const removingId = ref(null);
const selectedAgentId = ref('');

const nonOperatorAgents = computed(() =>
  agents.value.filter(
    a =>
      a.role !== 'administrator' &&
      !operators.value.some(op => op.chatwootUserId === a.id)
  )
);

const handleAdd = async () => {
  if (!selectedAgentId.value || adding.value) return;
  const agent = agents.value.find(a => a.id === Number(selectedAgentId.value));
  if (!agent) return;
  adding.value = true;
  try {
    const created = await chatwootExtraAPI.addTelegramDialoguesOperator({
      chatwootUserId: agent.id,
      name: agent.name,
    });
    operators.value = [...operators.value, created];
    selectedAgentId.value = '';
    store.dispatch('telegramDialoguesAccess/fetchOperators');
  } finally {
    adding.value = false;
  }
};

const handleRemove = async op => {
  if (removingId.value) return;
  const confirmed = window.confirm(
    `Remove ${op.name || op.chatwootUserId} from Telegram Dialogues access?`
  );
  if (!confirmed) return;
  removingId.value = op.id;
  try {
    await chatwootExtraAPI.removeTelegramDialoguesOperator(op.chatwootUserId);
    operators.value = operators.value.filter(o => o.id !== op.id);
    store.dispatch('telegramDialoguesAccess/fetchOperators');
  } finally {
    removingId.value = null;
  }
};

onMounted(async () => {
  await store.dispatch('agents/get');
  try {
    operators.value = await chatwootExtraAPI.getTelegramDialoguesOperators();
  } finally {
    loading.value = false;
  }
});
</script>

<template>
  <SettingsLayout
    :is-loading="loading"
    loading-message="Loading operators..."
    :no-records-found="!loading && !operators.length"
    no-records-message="No operators added yet. Admins always have access."
  >
    <template #header>
      <div class="flex items-center justify-between">
        <h2 class="text-base font-medium text-n-slate-12">
          Telegram Dialogues Access
        </h2>
        <div class="flex items-center gap-2">
          <select
            v-model="selectedAgentId"
            :disabled="adding"
            class="!mb-0 h-10 min-w-[14rem] px-3 pr-8 text-sm font-medium rounded-xl border-0 hover:cursor-pointer bg-n-solid-3 text-n-slate-12 focus:outline-none focus:ring-1 focus:ring-n-brand disabled:opacity-50"
          >
            <option value="" disabled>Select agent...</option>
            <option
              v-for="agent in nonOperatorAgents"
              :key="agent.id"
              :value="agent.id"
            >
              {{ agent.name }}
            </option>
          </select>
          <Button
            label="Add Operator"
            icon="i-lucide-plus"
            :disabled="!selectedAgentId"
            :is-loading="adding"
            @click="handleAdd"
          />
        </div>
      </div>
    </template>
    <template #body>
      <table class="min-w-full divide-y divide-n-weak">
        <thead>
          <tr>
            <th
              v-for="header in ['Name', 'User ID', 'Added At', 'Actions']"
              :key="header"
              class="py-4 ltr:pr-4 rtl:pl-4 text-left font-semibold text-n-slate-11 last:text-right"
            >
              {{ header }}
            </th>
          </tr>
        </thead>
        <tbody class="divide-y divide-n-weak text-n-slate-11">
          <tr v-for="op in operators" :key="op.id">
            <td class="py-4 ltr:pr-4 rtl:pl-4">
              <div class="flex items-center gap-2">
                <Avatar
                  :name="op.name || String(op.chatwootUserId)"
                  :size="24"
                />
                <span class="font-medium text-n-slate-12">{{
                  op.name || '—'
                }}</span>
              </div>
            </td>
            <td class="py-4 ltr:pr-4 rtl:pl-4">{{ op.chatwootUserId }}</td>
            <td class="py-4 ltr:pr-4 rtl:pl-4">
              {{ new Date(op.createdAt).toLocaleDateString() }}
            </td>
            <td class="py-4 text-right">
              <Button
                v-tooltip.top="'Remove'"
                icon="i-lucide-trash-2"
                xs
                faded
                ruby
                :is-loading="removingId === op.id"
                :disabled="!!removingId"
                @click="handleRemove(op)"
              />
            </td>
          </tr>
        </tbody>
      </table>
    </template>
  </SettingsLayout>
</template>
