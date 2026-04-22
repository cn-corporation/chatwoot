<script setup>
import { computed } from 'vue';
import { useStore } from 'vuex';

const store = useStore();

const archivedChats = computed(
  () => store.getters['telegramDialogues/getArchivedChats']
);

const unreadFor = chatDbId =>
  store.getters['telegramDialogues/getUnreadCountForChat'](chatDbId);

const goBack = () => {
  store.dispatch('telegramDialogues/toggleArchiveView');
};

const unarchive = chat => {
  store.dispatch('telegramDialogues/unarchiveChat', chat.chatDbId);
};
</script>

<template>
  <div class="flex-1 overflow-y-auto">
    <button
      class="flex items-center gap-2 w-full px-3 py-2 text-left border-b border-n-weak hover:bg-n-alpha-1 transition-colors"
      @click="goBack"
    >
      <span class="i-lucide-arrow-left size-4 text-n-slate-11" />
      <span class="i-lucide-archive size-4 text-n-slate-11" />
      <span class="text-sm font-medium text-n-slate-12"> Archive </span>
    </button>
    <div class="flex flex-col gap-0.5 p-2">
      <div
        v-for="chat in archivedChats"
        :key="chat.id"
        class="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg hover:bg-n-alpha-1 transition-colors group"
      >
        <span
          :class="
            chat.chatType === 'personal' ? 'i-lucide-user' : 'i-lucide-users'
          "
          class="size-5 flex-shrink-0 text-n-slate-11"
        />
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-1.5">
            <span class="font-medium text-sm truncate text-n-slate-12">
              {{ chat.topicName || chat.chatName }}
            </span>
            <span
              v-if="unreadFor(chat.chatDbId) > 0"
              class="text-[11px] font-semibold px-1.5 py-0.5 rounded-full bg-n-ruby-9 text-white min-w-[20px] text-center flex-shrink-0"
            >
              {{ unreadFor(chat.chatDbId) > 99 ? '99+' : unreadFor(chat.chatDbId) }}
            </span>
          </div>
          <span
            v-if="chat.topicName"
            class="text-xs text-n-slate-10 truncate block"
          >
            {{ chat.chatName }}
          </span>
        </div>
        <button
          class="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-n-alpha-2"
          title="Unarchive"
          @click="unarchive(chat)"
        >
          <span class="i-lucide-archive-restore size-4 text-n-slate-11" />
        </button>
      </div>
    </div>
    <div
      v-if="archivedChats.length === 0"
      class="flex items-center justify-center py-8 text-sm text-n-slate-10"
    >
      No archived chats
    </div>
  </div>
</template>
