<!-- eslint-disable no-continue -->
<script>
import { ref, provide } from 'vue';
// composable
import { useConfig } from 'dashboard/composables/useConfig';
import { useKeyboardEvents } from 'dashboard/composables/useKeyboardEvents';
import { useAI } from 'dashboard/composables/useAI';
// TEMPORARILY DISABLED: AI suggestions
// import { useAISuggestions } from 'dashboard/composables/useAISuggestions';
import { useSnakeCase } from 'dashboard/composables/useTransformKeys';
import { useSourceChannelColors } from 'dashboard/composables/useSourceChannelColors';

// components
import ReplyBox from './ReplyBox.vue';
import MessageList from 'next/message/MessageList.vue';
import ConversationLabelSuggestion from './conversation/LabelSuggestion.vue';
// TEMPORARILY DISABLED: AI suggestions
// import AISuggestionBanner from './AISuggestionBanner.vue';
import Banner from 'dashboard/components/ui/Banner.vue';
import Spinner from 'dashboard/components-next/spinner/Spinner.vue';

// stores and apis
import { mapGetters } from 'vuex';

// mixins
import inboxMixin, { INBOX_FEATURES } from 'shared/mixins/inboxMixin';

// utils
import { emitter } from 'shared/helpers/mitt';
import { getTypingUsersText } from '../../../helper/commons';
import { calculateScrollTop } from './helpers/scrollTopCalculationHelper';
import { LocalStorage } from 'shared/helpers/localStorage';
import {
  filterDuplicateSourceMessages,
  getReadMessages,
  getUnreadMessages,
} from 'dashboard/helper/conversationHelper';

// constants
import { BUS_EVENTS } from 'shared/constants/busEvents';
import { REPLY_POLICY } from 'shared/constants/links';
import wootConstants from 'dashboard/constants/globals';
import { LOCAL_STORAGE_KEYS } from 'dashboard/constants/localStorage';
import { INBOX_TYPES } from 'dashboard/helper/inbox';

export default {
  components: {
    MessageList,
    ReplyBox,
    Banner,
    ConversationLabelSuggestion,
    // TEMPORARILY DISABLED: AI suggestions
    // AISuggestionBanner,
    Spinner,
  },
  mixins: [inboxMixin],
  setup() {
    const isPopOutReplyBox = ref(false);
    const conversationPanelRef = ref(null);
    const { isEnterprise } = useConfig();

    const keyboardEvents = {
      Escape: {
        action: () => {
          isPopOutReplyBox.value = false;
        },
      },
    };

    useKeyboardEvents(keyboardEvents);

    const {
      isAIIntegrationEnabled,
      isLabelSuggestionFeatureEnabled,
      fetchIntegrationsIfRequired,
      fetchLabelSuggestions,
    } = useAI();

    // TEMPORARILY DISABLED: AI suggestions
    // const {
    //   aiSuggestion,
    //   isLoadingSuggestion,
    //   suggestionError,
    //   hasSuggestion,
    //   fetchAISuggestion,
    //   clearSuggestion,
    // } = useAISuggestions();

    const { getSourceBgColor, getInboxBackgroundStyle } =
      useSourceChannelColors();

    provide('contextMenuElementTarget', conversationPanelRef);

    return {
      isEnterprise,
      isPopOutReplyBox,
      isAIIntegrationEnabled,
      isLabelSuggestionFeatureEnabled,
      fetchIntegrationsIfRequired,
      fetchLabelSuggestions,
      // TEMPORARILY DISABLED: AI suggestions
      // aiSuggestion,
      // isLoadingSuggestion,
      // suggestionError,
      // hasSuggestion,
      // fetchAISuggestion,
      // clearSuggestion,
      conversationPanelRef,
      getSourceBgColor,
      getInboxBackgroundStyle,
    };
  },
  data() {
    return {
      isLoadingPrevious: true,
      heightBeforeLoad: null,
      conversationPanel: null,
      hasUserScrolled: false,
      isProgrammaticScroll: false,
      messageSentSinceOpened: false,
      labelSuggestions: [],
      newMessagesWhileScrolledUp: 0,
      lastTrackedConversationId: null,
      lastMessageId: null,
      linkedConversationPagination: {
        active: false,
        currentIndex: 0,
        conversationId: null,
        allMessagesLoaded: false,
        separatorShown: false,
      },
      initialLoadComplete: false,
      pendingLinkedCheck: false,
    };
  },

  computed: {
    ...mapGetters({
      currentChat: 'getSelectedChat',
      currentUserId: 'getCurrentUserID',
      listLoadingStatus: 'getAllMessagesLoaded',
      currentAccountId: 'getCurrentAccountId',
      conversationFilters: 'getChatListFilters',
      appliedFilters: 'getAppliedConversationFiltersV2',
    }),
    isAllOperatorsTab() {
      // Check if viewing from all-operators tab (read-only mode for admins)
      return this.conversationFilters?.assigneeType === 'all-operators';
    },
    hasAppliedFilters() {
      return this.appliedFilters && this.appliedFilters.length > 0;
    },
    isReadOnlyMode() {
      // Read-only when viewing all-operators tab only
      // ReplyBox will handle disabling itself for resolved conversations
      return this.isAllOperatorsTab;
    },
    isOpen() {
      return this.currentChat?.status === wootConstants.STATUS_TYPE.OPEN;
    },
    shouldShowLabelSuggestions() {
      return (
        this.isOpen &&
        this.isEnterprise &&
        this.isAIIntegrationEnabled &&
        !this.messageSentSinceOpened
      );
    },
    inboxId() {
      return this.currentChat.inbox_id;
    },
    inbox() {
      return this.$store.getters['inboxes/getInbox'](this.inboxId);
    },
    messagesPanelBgStyle() {
      if (!this.inboxId) return {};
      return this.getInboxBackgroundStyle(this.inboxId);
    },
    typingUsersList() {
      const userList = this.$store.getters[
        'conversationTypingStatus/getUserList'
      ](this.currentChat.id);
      return userList;
    },
    isAnyoneTyping() {
      const userList = this.typingUsersList;
      return userList.length !== 0;
    },
    typingUserNames() {
      const userList = this.typingUsersList;
      if (this.isAnyoneTyping) {
        const [i18nKey, params] = getTypingUsersText(userList);
        return this.$t(i18nKey, params);
      }

      return '';
    },
    linkedChannels() {
      return this.$store.getters['linkedSourceChannels/getLinkedChannels'](
        this.currentChat?.id
      );
    },
    linkedMessages() {
      return this.$store.getters['linkedSourceChannels/getLinkedMessages'](
        this.currentChat?.id
      );
    },
    getMessages() {
      const messages = this.currentChat.messages || [];
      let filteredMessages = messages;
      if (this.isAWhatsAppChannel) {
        filteredMessages = filterDuplicateSourceMessages(messages);
      }
      if (this.linkedMessages.length > 0) {
        return [...this.linkedMessages, ...filteredMessages];
      }
      return filteredMessages;
    },
    readMessages() {
      return getReadMessages(
        this.getMessages,
        this.currentChat.agent_last_seen_at
      );
    },
    unReadMessages() {
      return getUnreadMessages(
        this.getMessages,
        this.currentChat.agent_last_seen_at
      );
    },
    shouldShowSpinner() {
      return (
        (this.currentChat && this.currentChat.dataFetched === undefined) ||
        (!this.listLoadingStatus && this.isLoadingPrevious)
      );
    },
    // Check there is a instagram inbox exists with the same instagram_id
    hasDuplicateInstagramInbox() {
      const instagramId = this.inbox.instagram_id;
      const { additional_attributes: additionalAttributes = {} } = this.inbox;
      const instagramInbox =
        this.$store.getters['inboxes/getInstagramInboxByInstagramId'](
          instagramId
        );

      return (
        this.inbox.channel_type === INBOX_TYPES.FB &&
        additionalAttributes.type === 'instagram_direct_message' &&
        instagramInbox
      );
    },

    replyWindowBannerMessage() {
      if (this.isAWhatsAppChannel) {
        return this.$t('CONVERSATION.TWILIO_WHATSAPP_CAN_REPLY');
      }
      if (this.isAPIInbox) {
        const { additional_attributes: additionalAttributes = {} } = this.inbox;
        if (additionalAttributes) {
          const {
            agent_reply_time_window_message: agentReplyTimeWindowMessage,
            agent_reply_time_window: agentReplyTimeWindow,
          } = additionalAttributes;
          return (
            agentReplyTimeWindowMessage ||
            this.$t('CONVERSATION.API_HOURS_WINDOW', {
              hours: agentReplyTimeWindow,
            })
          );
        }
        return '';
      }
      return this.$t('CONVERSATION.CANNOT_REPLY');
    },
    replyWindowLink() {
      if (this.isAFacebookInbox || this.isAnInstagramChannel) {
        return REPLY_POLICY.FACEBOOK;
      }
      if (this.isAWhatsAppCloudChannel) {
        return REPLY_POLICY.WHATSAPP_CLOUD;
      }
      if (!this.isAPIInbox) {
        return REPLY_POLICY.TWILIO_WHATSAPP;
      }
      return '';
    },
    replyWindowLinkText() {
      if (
        this.isAWhatsAppChannel ||
        this.isAFacebookInbox ||
        this.isAnInstagramChannel
      ) {
        return this.$t('CONVERSATION.24_HOURS_WINDOW');
      }
      if (!this.isAPIInbox) {
        return this.$t('CONVERSATION.TWILIO_WHATSAPP_24_HOURS_WINDOW');
      }
      return '';
    },
    unreadMessageCount() {
      return this.currentChat.unread_count || 0;
    },
    unreadMessageLabel() {
      const count =
        this.unreadMessageCount > 9 ? '9+' : this.unreadMessageCount;
      const label =
        this.unreadMessageCount > 1
          ? 'CONVERSATION.UNREAD_MESSAGES'
          : 'CONVERSATION.UNREAD_MESSAGE';
      return `${count} ${this.$t(label)}`;
    },
    inboxSupportsReplyTo() {
      const incoming = this.inboxHasFeature(INBOX_FEATURES.REPLY_TO);
      const outgoing =
        this.inboxHasFeature(INBOX_FEATURES.REPLY_TO_OUTGOING) &&
        !this.is360DialogWhatsAppChannel;

      return { incoming, outgoing };
    },
    shouldShowNewMessagesIndicator() {
      return this.hasUserScrolled && this.newMessagesWhileScrolledUp > 0;
    },
  },

  watch: {
    currentChat(newChat, oldChat) {
      if (newChat.id === oldChat.id) {
        return;
      }
      // TEMPORARILY DISABLED: AI suggestions
      // this.clearSuggestion(); // Clear previous suggestion when switching conversations
      this.fetchAllAttachmentsFromCurrentChat();
      this.fetchSuggestions();
      // TEMPORARILY DISABLED: AI suggestions
      // this.fetchAISuggestionForConversation();
      this.messageSentSinceOpened = false;
      this.newMessagesWhileScrolledUp = 0;
      this.lastTrackedConversationId = newChat.id;
      const messages = this.getMessages;
      this.lastMessageId =
        messages.length > 0 ? messages[messages.length - 1].id : null;
      this.resetLinkedConversationPagination();
      this.fetchLinkedSourceChannels();
      this.initialLoadComplete = false;
      this.pendingLinkedCheck = false;
      setTimeout(() => {
        this.initialLoadComplete = true;
        this.checkAndTriggerLinkedLoading();
      }, 300);
      // Always scroll to bottom when switching conversations
      this.$nextTick(() => {
        if (this.conversationPanel) {
          this.scrollToBottom();
        }
      });
    },
    'getMessages.length'() {
      const currentConversationId = this.currentChat?.id;
      if (currentConversationId !== this.lastTrackedConversationId) {
        return;
      }

      const messages = this.getMessages;
      if (messages.length === 0) {
        return;
      }

      const lastMessage = messages[messages.length - 1];
      const currentLastMessageId = lastMessage?.id;

      // Only count if there's a new message at the end AND user is scrolled up
      if (
        this.lastMessageId &&
        currentLastMessageId &&
        currentLastMessageId > this.lastMessageId &&
        this.hasUserScrolled
      ) {
        let newMessageCount = 0;
        for (let i = messages.length - 1; i >= 0; i -= 1) {
          if (messages[i].id > this.lastMessageId) {
            if (
              messages[i].private &&
              (messages[i].additional_attributes?.original_message_id ||
                messages[i].content_attributes?.original_message_id)
            ) {
              continue;
            }
            newMessageCount += 1;
          } else {
            break;
          }
        }
        this.newMessagesWhileScrolledUp += newMessageCount;
      }

      this.lastMessageId = currentLastMessageId;
    },
    inboxId: {
      immediate: true,
      handler(inboxId) {
        if (inboxId) {
          this.getSourceBgColor(inboxId);
        }
      },
    },
    listLoadingStatus(allLoaded) {
      if (allLoaded) {
        this.$nextTick(() => this.checkAndTriggerLinkedLoading());
      }
    },
    linkedChannels(channels) {
      if (channels.length > 0) {
        this.$nextTick(() => this.checkAndTriggerLinkedLoading());
      }
    },
  },

  created() {
    this.handleMessageSent = () => {
      this.messageSentSinceOpened = true;
    };

    emitter.on(BUS_EVENTS.SCROLL_TO_MESSAGE, this.onScrollToMessage);
    // when a new message comes in, we refetch the label suggestions
    emitter.on(BUS_EVENTS.FETCH_LABEL_SUGGESTIONS, this.fetchSuggestions);
    // when a message is sent we set the flag to true this hides the label suggestions,
    // until the chat is changed and the flag is reset in the watch for currentChat
    emitter.on(BUS_EVENTS.MESSAGE_SENT, this.handleMessageSent);
  },

  mounted() {
    this.addScrollListener();
    this.fetchAllAttachmentsFromCurrentChat();
    this.fetchSuggestions();
    // TEMPORARILY DISABLED: AI suggestions
    // this.fetchAISuggestionForConversation();
    this.lastTrackedConversationId = this.currentChat?.id;
    const messages = this.getMessages;
    this.lastMessageId =
      messages.length > 0 ? messages[messages.length - 1].id : null;
    this.fetchLinkedSourceChannels();
    setTimeout(() => {
      this.initialLoadComplete = true;
      this.checkAndTriggerLinkedLoading();
    }, 300);
  },

  unmounted() {
    this.removeBusListeners();
    this.removeScrollListener();
  },

  methods: {
    async fetchSuggestions() {
      // start empty, this ensures that the label suggestions are not shown
      this.labelSuggestions = [];

      if (this.isLabelSuggestionDismissed()) {
        return;
      }

      if (!this.isEnterprise) {
        return;
      }

      // method available in mixin, need to ensure that integrations are present
      await this.fetchIntegrationsIfRequired();

      if (!this.isLabelSuggestionFeatureEnabled) {
        return;
      }

      this.labelSuggestions = await this.fetchLabelSuggestions({
        conversationId: this.currentChat.id,
      });

      // once the labels are fetched, we need to scroll to bottom
      // but we need to wait for the DOM to be updated
      // so we use the nextTick method
      this.$nextTick(() => {
        // this param is added to route, telling the UI to navigate to the message
        // it is triggered by the SCROLL_TO_MESSAGE method
        // see setActiveChat on ConversationView.vue for more info
        const { messageId } = this.$route.query;

        // only trigger the scroll to bottom if the user has not scrolled
        // and there's no active messageId that is selected in view
        if (!messageId && !this.hasUserScrolled) {
          this.scrollToBottom();
        }
      });
    },
    // TEMPORARILY DISABLED: AI suggestions
    // async fetchAISuggestionForConversation() {
    //   if (!this.currentChat?.id) {
    //     return;
    //   }

    //   // Only auto-fetch if last message is incoming
    //   const messages = this.getMessages;
    //   if (messages.length === 0) {
    //     return;
    //   }

    //   const lastMessage = messages[messages.length - 1];
    //   const MESSAGE_TYPE_INCOMING = 0;
    //   const isLastMessageIncoming =
    //     lastMessage.message_type === MESSAGE_TYPE_INCOMING;

    //   if (!isLastMessageIncoming) {
    //     return;
    //   }

    //   try {
    //     await this.fetchAISuggestion(this.currentChat.id);
    //   } catch (error) {
    //     // Silently handle errors - suggestion is optional
    //   }
    // },
    // handleUseSuggestion(suggestionContent) {
    //   // Emit an event to fill the reply box with the suggestion
    //   emitter.emit(BUS_EVENTS.INSERT_INTO_NORMAL_EDITOR, suggestionContent);
    //   this.clearSuggestion();
    // },
    // handleDismissSuggestion() {
    //   this.clearSuggestion();
    // },
    // handleReloadSuggestion() {
    //   // Force reload the suggestion from server (bypass auto-load checks)
    //   if (!this.currentChat?.id) {
    //     return;
    //   }
    //   this.fetchAISuggestion(this.currentChat.id).catch();
    // },
    isLabelSuggestionDismissed() {
      return LocalStorage.getFlag(
        LOCAL_STORAGE_KEYS.DISMISSED_LABEL_SUGGESTIONS,
        this.currentAccountId,
        this.currentChat.id
      );
    },
    fetchAllAttachmentsFromCurrentChat() {
      this.$store.dispatch('fetchAllAttachments', this.currentChat.id);
    },
    removeBusListeners() {
      emitter.off(BUS_EVENTS.SCROLL_TO_MESSAGE, this.onScrollToMessage);
      emitter.off(BUS_EVENTS.FETCH_LABEL_SUGGESTIONS, this.fetchSuggestions);
      emitter.off(BUS_EVENTS.MESSAGE_SENT, this.handleMessageSent);
    },
    onScrollToMessage({ messageId = '' } = {}) {
      this.$nextTick(() => {
        const messageElement = document.getElementById('message' + messageId);
        if (messageElement) {
          this.isProgrammaticScroll = true;
          messageElement.scrollIntoView({ behavior: 'smooth' });
          this.fetchPreviousMessages();
        } else if (!this.hasUserScrolled) {
          this.scrollToBottom();
        }
      });
      this.makeMessagesRead();
    },
    addScrollListener() {
      this.conversationPanel = this.$el.querySelector('.conversation-panel');
      this.setScrollParams();
      this.conversationPanel.addEventListener('scroll', this.handleScroll);
      this.$nextTick(() => this.scrollToBottom());
      this.isLoadingPrevious = false;
    },
    removeScrollListener() {
      if (this.conversationPanel) {
        this.conversationPanel.removeEventListener('scroll', this.handleScroll);
        this.conversationPanel = null;
      }
    },
    scrollToBottom() {
      if (!this.conversationPanel) return;

      this.isProgrammaticScroll = true;
      let relevantMessages = [];

      let labelSuggestions =
        this.conversationPanel.querySelector('.label-suggestion');

      // if there are unread messages, scroll to the first unread message
      if (this.unreadMessageCount > 0) {
        // capturing only the unread messages
        relevantMessages =
          this.conversationPanel.querySelectorAll('.message--unread');
      } else if (labelSuggestions) {
        // when scrolling to the bottom, the label suggestions is below the last message
        // so we scroll there if there are no unread messages
        // Unread messages always take the highest priority
        relevantMessages = [labelSuggestions];
      } else {
        // if there are no unread messages or label suggestion, scroll to the last message
        // capturing last message from the messages list
        relevantMessages = Array.from(
          this.conversationPanel.querySelectorAll('.message--read')
        ).slice(-1);
      }

      this.conversationPanel.scrollTop = calculateScrollTop(
        this.conversationPanel.scrollHeight,
        this.$el.scrollHeight,
        relevantMessages
      );
    },
    setScrollParams() {
      this.heightBeforeLoad = this.conversationPanel.scrollHeight;
      this.scrollTopBeforeLoad = this.conversationPanel.scrollTop;
    },

    async fetchPreviousMessages(scrollTop = 0) {
      this.setScrollParams();
      const shouldLoadMoreMessages =
        this.currentChat.dataFetched === true && !this.isLoadingPrevious;

      const isNearTop = scrollTop < 150;

      if (isNearTop && !this.isLoadingPrevious && shouldLoadMoreMessages) {
        if (this.linkedConversationPagination.active) {
          await this.fetchLinkedMessages();
          return;
        }

        if (this.listLoadingStatus) {
          this.checkAndTriggerLinkedLoading();
          return;
        }

        this.isLoadingPrevious = true;
        try {
          await this.$store.dispatch('fetchPreviousMessages', {
            conversationId: this.currentChat.id,
            before: this.currentChat.messages[0].id,
          });
          const heightDifference =
            this.conversationPanel.scrollHeight - this.heightBeforeLoad;
          this.conversationPanel.scrollTop =
            this.scrollTopBeforeLoad + heightDifference;
          this.setScrollParams();
        } catch (error) {
          // Ignore Error
        } finally {
          this.isLoadingPrevious = false;
          this.$nextTick(() => this.checkAndTriggerLinkedLoading());
        }
      }
    },
    checkAndTriggerLinkedLoading() {
      if (!this.conversationPanel) return;
      if (this.isLoadingPrevious) return;
      if (this.linkedConversationPagination.allMessagesLoaded) return;

      if (!this.initialLoadComplete) {
        if (!this.pendingLinkedCheck) {
          this.pendingLinkedCheck = true;
          setTimeout(() => {
            this.pendingLinkedCheck = false;
            this.checkAndTriggerLinkedLoading();
          }, 350);
        }
        return;
      }

      const hasNoScrollbar =
        this.conversationPanel.scrollHeight <=
        this.conversationPanel.clientHeight;
      const isNearTop = this.conversationPanel.scrollTop < 150;
      const shouldLoad = hasNoScrollbar || isNearTop;

      if (!shouldLoad) return;

      if (!this.listLoadingStatus) {
        this.triggerCurrentConversationLoad();
        return;
      }

      if (this.linkedChannels.length === 0) return;

      if (!this.linkedConversationPagination.active) {
        this.linkedConversationPagination = {
          active: true,
          currentIndex: 0,
          conversationId: this.linkedChannels[0].conversation_id,
          allMessagesLoaded: false,
          separatorShown: false,
        };
      }

      this.fetchLinkedMessages();
    },
    async triggerCurrentConversationLoad() {
      if (this.isLoadingPrevious || this.listLoadingStatus) return;
      if (!this.currentChat?.messages?.length) return;

      this.isLoadingPrevious = true;
      try {
        await this.$store.dispatch('fetchPreviousMessages', {
          conversationId: this.currentChat.id,
          before: this.currentChat.messages[0].id,
        });
      } catch (error) {
        // Ignore
      } finally {
        this.isLoadingPrevious = false;
        this.$nextTick(() => this.checkAndTriggerLinkedLoading());
      }
    },

    handleScroll(e) {
      if (this.isProgrammaticScroll) {
        // Reset the flag
        this.isProgrammaticScroll = false;
        this.hasUserScrolled = false;
        this.newMessagesWhileScrolledUp = 0;
      } else {
        const { scrollTop, scrollHeight, clientHeight } = e.target;
        const isNearBottom = scrollHeight - scrollTop - clientHeight < 50;
        this.hasUserScrolled = !isNearBottom;
        if (isNearBottom) {
          this.newMessagesWhileScrolledUp = 0;
        }
      }
      emitter.emit(BUS_EVENTS.ON_MESSAGE_LIST_SCROLL);
      this.fetchPreviousMessages(e.target.scrollTop);
    },

    makeMessagesRead() {
      this.$store.dispatch('markMessagesRead', { id: this.currentChat.id });
    },
    async handleMessageRetry(message) {
      if (!message) return;
      const payload = useSnakeCase(message);
      await this.$store.dispatch('sendMessageWithData', payload);
    },
    onNewMessagesIndicatorClick() {
      this.newMessagesWhileScrolledUp = 0;
      this.scrollToBottom();
    },
    async fetchLinkedSourceChannels() {
      if (!this.currentChat?.id) return;
      await this.$store.dispatch(
        'linkedSourceChannels/fetchLinkedSourceChannels',
        { conversationId: this.currentChat.id }
      );
    },
    resetLinkedConversationPagination() {
      this.linkedConversationPagination = {
        active: false,
        currentIndex: 0,
        conversationId: null,
        allMessagesLoaded: false,
        separatorShown: false,
      };
      if (this.currentChat?.id) {
        this.$store.dispatch('linkedSourceChannels/clearLinkedMessages', {
          conversationId: this.currentChat.id,
        });
      }
    },
    getEarliestLinkedMessageId() {
      const linkedMessages = this.linkedMessages;
      if (linkedMessages.length === 0) return null;
      const realMessages = linkedMessages.filter(
        msg => !msg.isLinkedConversationSeparator
      );
      if (realMessages.length === 0) return null;
      return realMessages[0].id;
    },
    async fetchLinkedMessages() {
      if (this.linkedConversationPagination.allMessagesLoaded) return;

      this.isLoadingPrevious = true;
      try {
        if (!this.linkedConversationPagination.separatorShown) {
          const currentLinked =
            this.linkedChannels[this.linkedConversationPagination.currentIndex];
          this.insertLinkedConversationSeparator(currentLinked.contact_name);
          this.linkedConversationPagination.separatorShown = true;
        }

        const messages = await this.$store.dispatch(
          'linkedSourceChannels/fetchLinkedConversationMessages',
          {
            conversationId: this.currentChat.id,
            linkedConversationId:
              this.linkedConversationPagination.conversationId,
            before: this.getEarliestLinkedMessageId(),
          }
        );

        if (messages.length === 0) {
          const nextIndex = this.linkedConversationPagination.currentIndex + 1;
          if (nextIndex < this.linkedChannels.length) {
            this.linkedConversationPagination = {
              active: true,
              currentIndex: nextIndex,
              conversationId: this.linkedChannels[nextIndex].conversation_id,
              allMessagesLoaded: false,
              separatorShown: false,
            };
          } else {
            this.linkedConversationPagination.allMessagesLoaded = true;
            this.linkedConversationPagination.active = false;
          }
        }

        const heightDifference =
          this.conversationPanel.scrollHeight - this.heightBeforeLoad;
        this.conversationPanel.scrollTop =
          this.scrollTopBeforeLoad + heightDifference;
        this.setScrollParams();
      } catch (error) {
        // Ignore error
      } finally {
        this.isLoadingPrevious = false;
        this.$nextTick(() => {
          this.checkAndTriggerLinkedLoading();
        });
      }
    },
    insertLinkedConversationSeparator(contactName) {
      const separatorMessage = {
        id: `separator-${Date.now()}`,
        message_type: 'separator',
        content: contactName,
        isLinkedConversationSeparator: true,
        created_at: 0,
      };
      const existingMessages = this.linkedMessages;
      this.$store.commit('linkedSourceChannels/SET_LINKED_MESSAGES', {
        conversationId: this.currentChat.id,
        messages: [separatorMessage, ...existingMessages],
      });
    },
  },
};
</script>

<template>
  <div
    class="flex flex-col justify-between flex-grow h-full min-w-0 m-0 relative"
  >
    <Banner
      v-if="!currentChat.can_reply"
      color-scheme="alert"
      class="mx-2 mt-2 overflow-hidden rounded-lg"
      :banner-message="replyWindowBannerMessage"
      :href-link="replyWindowLink"
      :href-link-text="replyWindowLinkText"
    />
    <Banner
      v-else-if="hasDuplicateInstagramInbox"
      color-scheme="alert"
      class="mx-2 mt-2 overflow-hidden rounded-lg"
      :banner-message="$t('CONVERSATION.OLD_INSTAGRAM_INBOX_REPLY_BANNER')"
    />
    <MessageList
      ref="conversationPanelRef"
      class="conversation-panel flex-shrink flex-grow basis-px flex flex-col overflow-y-auto relative h-full m-0 pb-4"
      :style="messagesPanelBgStyle"
      :current-user-id="currentUserId"
      :first-unread-id="unReadMessages[0]?.id"
      :is-an-email-channel="isAnEmailChannel"
      :inbox-supports-reply-to="inboxSupportsReplyTo"
      :messages="getMessages"
      @retry="handleMessageRetry"
    >
      <template #beforeAll>
        <transition name="slide-up">
          <!-- eslint-disable-next-line vue/require-toggle-inside-transition -->
          <li
            class="min-h-[4rem] flex flex-shrink-0 flex-grow-0 items-center flex-auto justify-center max-w-full mt-0 mr-0 mb-1 ml-0 relative first:mt-auto last:mb-0"
          >
            <Spinner v-if="shouldShowSpinner" class="text-n-brand" />
          </li>
        </transition>
      </template>
      <template #unreadBadge>
        <li
          v-show="unreadMessageCount != 0"
          class="list-none flex justify-center items-center"
        >
          <span
            class="shadow-lg rounded-full bg-n-brand text-white text-xs font-medium my-2.5 mx-auto px-2.5 py-1.5"
          >
            {{ unreadMessageLabel }}
          </span>
        </li>
      </template>
      <template #after>
        <ConversationLabelSuggestion
          v-if="shouldShowLabelSuggestions"
          :suggested-labels="labelSuggestions"
          :chat-labels="currentChat.labels"
          :conversation-id="currentChat.id"
        />
      </template>
    </MessageList>
    <!-- New messages indicator -->
    <transition name="slide-up">
      <button
        v-if="shouldShowNewMessagesIndicator"
        type="button"
        class="absolute bottom-72 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2 px-4 py-2.5 bg-n-brand hover:bg-n-brand-hover text-white text-sm font-medium rounded-full shadow-lg transition-all cursor-pointer"
        @click="onNewMessagesIndicatorClick"
      >
        <svg
          class="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M19 14l-7 7m0 0l-7-7m7 7V3"
          />
        </svg>
        <span>
          {{
            newMessagesWhileScrolledUp === 1
              ? $t('CONVERSATION.NEW_MESSAGE')
              : $t('CONVERSATION.NEW_MESSAGES', {
                  count: newMessagesWhileScrolledUp,
                })
          }}
        </span>
        <span
          class="flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 bg-white text-n-brand text-xs font-bold rounded-full"
        >
          {{ newMessagesWhileScrolledUp }}
        </span>
      </button>
    </transition>
    <div
      class="flex relative flex-col"
      :class="{
        'modal-mask': isPopOutReplyBox,
        'bg-n-background': !isPopOutReplyBox,
      }"
    >
      <div
        v-if="isAnyoneTyping"
        class="absolute flex items-center w-full h-0 -top-7"
      >
        <div
          class="flex py-2 pr-4 pl-5 shadow-md rounded-full bg-white dark:bg-n-solid-3 text-n-slate-11 text-xs font-semibold my-2.5 mx-auto"
        >
          {{ typingUserNames }}
          <img
            class="w-6 ltr:ml-2 rtl:mr-2"
            src="assets/images/typing.gif"
            alt="Someone is typing"
          />
        </div>
      </div>
      <!-- TEMPORARILY DISABLED: AI suggestions -->
      <!-- <div v-if="!isReadOnlyMode" class="px-4">
        <AISuggestionBanner
          :suggestion="aiSuggestion"
          :is-loading="isLoadingSuggestion"
          :error="suggestionError"
          @useSuggestion="handleUseSuggestion"
          @dismiss="handleDismissSuggestion"
          @reload="handleReloadSuggestion"
        />
      </div> -->
      <ReplyBox
        v-if="!isReadOnlyMode"
        :pop-out-reply-box="isPopOutReplyBox"
        @update:pop-out-reply-box="isPopOutReplyBox = $event"
      />
    </div>
  </div>
</template>

<style scoped lang="scss">
.modal-mask {
  @apply fixed;

  &::v-deep {
    .ProseMirror-woot-style {
      @apply max-h-[25rem];
    }

    .reply-box {
      @apply border border-n-weak max-w-[75rem] w-[70%];

      &.is-private {
        @apply dark:border-n-amber-3/30 border-n-amber-12/5;
      }
    }

    .reply-box .reply-box__top {
      @apply relative min-h-[27.5rem];
    }

    .reply-box__top .input {
      @apply min-h-[27.5rem];
    }

    .emoji-dialog {
      @apply absolute ltr:left-auto rtl:right-auto bottom-1;
    }
  }
}
</style>
