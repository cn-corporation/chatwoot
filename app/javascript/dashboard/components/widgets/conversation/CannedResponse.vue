<script>
import { mapGetters } from 'vuex';
import MentionBox from '../mentions/MentionBox.vue';

export default {
  components: { MentionBox },
  props: {
    searchKey: {
      type: String,
      default: '',
    },
  },
  emits: ['replace'],
  computed: {
    ...mapGetters({
      cannedMessages: 'getCannedResponses',
    }),
    personalCannedMessages() {
      return this.$store.getters[
        'personalCannedResponse/getPersonalCannedResponses'
      ];
    },
    filteredPersonalCannedMessages() {
      if (!this.searchKey) {
        return this.personalCannedMessages;
      }
      const search = this.searchKey.toLowerCase();
      return this.personalCannedMessages.filter(msg =>
        msg.command.toLowerCase().includes(search)
      );
    },
    items() {
      const personalItems = this.filteredPersonalCannedMessages.map(msg => ({
        label: msg.command,
        key: `personal-${msg.id}`,
        description: msg.text,
        isPersonal: true,
      }));

      const regularItems = this.cannedMessages.map(cannedMessage => ({
        label: cannedMessage.short_code,
        key: cannedMessage.short_code,
        description: cannedMessage.content,
        isPersonal: false,
      }));

      return [...personalItems, ...regularItems];
    },
  },
  watch: {
    searchKey() {
      this.fetchCannedResponses();
    },
  },
  mounted() {
    this.fetchCannedResponses();
    this.fetchPersonalCannedResponses();
  },
  methods: {
    fetchCannedResponses() {
      this.$store.dispatch('getCannedResponse', { searchKey: this.searchKey });
    },
    fetchPersonalCannedResponses() {
      this.$store.dispatch(
        'personalCannedResponse/getPersonalCannedResponses',
        { force: false }
      );
    },
    handleMentionClick(item = {}) {
      this.$emit('replace', item.description);
    },
  },
};
</script>

<!-- eslint-disable-next-line vue/no-root-v-if -->
<template>
  <MentionBox
    v-if="items.length"
    :items="items"
    @mention-select="handleMentionClick"
  >
    <template #default="{ item, selected }">
      <p
        class="max-w-full min-w-0 mb-0 overflow-hidden text-sm font-medium text-n-slate-11 group-hover:text-n-slate-12 text-ellipsis whitespace-nowrap"
        :class="{ 'text-n-slate-12': selected }"
      >
        {{ item.description }}
      </p>
      <div class="flex items-center gap-2 max-w-full min-w-0">
        <p
          class="mb-0 overflow-hidden text-xs text-n-slate-11 group-hover:text-n-slate-12 text-ellipsis whitespace-nowrap"
          :class="{ 'text-n-slate-12': selected }"
        >
          /{{ item.label }}
        </p>
        <span
          v-if="item.isPersonal"
          class="inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium rounded bg-n-teal-3 text-n-teal-11 flex-shrink-0"
        >
          {{ $t('PERSONAL_CANNED_MGMT.BADGE') }}
        </span>
      </div>
    </template>
  </MentionBox>
</template>
