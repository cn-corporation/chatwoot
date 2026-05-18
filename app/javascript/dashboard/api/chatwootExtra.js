/* global axios */

const CHATWOOT_EXTRA_API_URL = (
  window.chatwootConfig?.chatwootExtraApiUrl || 'http://localhost:3001'
).replace(/\/$/, ''); // Remove trailing slash if present
const CHATWOOT_EXTRA_API_KEY = window.chatwootConfig?.chatwootExtraApiKey || '';

class ChatwootExtraAPI {
  constructor() {
    this.baseURL = CHATWOOT_EXTRA_API_URL;
    this.headers = {
      'Content-Type': 'application/json',
      'X-API-Key': CHATWOOT_EXTRA_API_KEY,
    };
  }

  async createMacro({ chatwootUserId, chatwootMacrosId, sourceChannelIds }) {
    const response = await axios.post(
      `${this.baseURL}/api/macros`,
      {
        chatwootUserId,
        chatwootMacrosId,
        sourceChannelIds,
      },
      { headers: this.headers }
    );
    // Backend returns { success: true, data: {...} }
    return response.data;
  }

  async getMacro(id) {
    try {
      const response = await axios.get(`${this.baseURL}/api/macros/${id}`, {
        headers: this.headers,
      });
      return response.data;
    } catch (error) {
      return null;
    }
  }

  async getMacrosByUser(chatwootUserId) {
    try {
      const response = await axios.get(
        `${this.baseURL}/api/macros/user/${chatwootUserId}`,
        { headers: this.headers }
      );
      // Backend returns { success: true, data: [...] }
      return response.data?.data || [];
    } catch (error) {
      return [];
    }
  }

  async getAllMacros() {
    try {
      const response = await axios.get(`${this.baseURL}/api/macros`, {
        headers: this.headers,
      });
      // Backend returns { success: true, data: [...] }
      return response.data?.data || [];
    } catch (error) {
      return [];
    }
  }

  async getMacrosByUserAndChannel(chatwootUserId, chatwootChannelId) {
    try {
      const response = await axios.get(
        `${this.baseURL}/api/macros/user/${chatwootUserId}/channel/${chatwootChannelId}`,
        { headers: this.headers }
      );
      return response.data;
    } catch (error) {
      return null;
    }
  }

  async updateMacroSources({
    chatwootUserId,
    chatwootMacrosId,
    sourceChannelIds,
  }) {
    const response = await axios.patch(
      `${this.baseURL}/api/macros/sources`,
      {
        chatwootUserId,
        chatwootMacrosId,
        sourceChannelIds,
      },
      { headers: this.headers }
    );
    // Backend returns { success: true, data: {...} }
    return response.data;
  }

  async deleteMacro(id) {
    const response = await axios.delete(`${this.baseURL}/api/macros/${id}`, {
      headers: this.headers,
    });
    return response.data;
  }

  async createAutomation({ chatwootAutomationId, sourceChannelIds }) {
    const response = await axios.post(
      `${this.baseURL}/api/automations`,
      {
        chatwootAutomationId,
        sourceChannelIds,
      },
      { headers: this.headers }
    );
    return response.data;
  }

  async getAutomation(chatwootAutomationId) {
    try {
      const response = await axios.get(
        `${this.baseURL}/api/automations/${chatwootAutomationId}`,
        { headers: this.headers }
      );
      return response.data;
    } catch (error) {
      return null;
    }
  }

  async getAllAutomations() {
    try {
      const response = await axios.get(`${this.baseURL}/api/automations`, {
        headers: this.headers,
      });
      return response.data?.data || [];
    } catch (error) {
      return [];
    }
  }

  async updateAutomationSources({ chatwootAutomationId, sourceChannelIds }) {
    const response = await axios.patch(
      `${this.baseURL}/api/automations/sources`,
      {
        chatwootAutomationId,
        sourceChannelIds,
      },
      { headers: this.headers }
    );
    return response.data;
  }

  async deleteAutomation(chatwootAutomationId) {
    const response = await axios.delete(
      `${this.baseURL}/api/automations/${chatwootAutomationId}`,
      { headers: this.headers }
    );
    return response.data;
  }

  async getSourceChannel(chatwootChannelId) {
    const response = await axios.get(
      `${this.baseURL}/api/source-channels/${chatwootChannelId}`,
      { headers: this.headers }
    );
    return response.data;
  }

  async updateSourceChannel(chatwootChannelId, data) {
    const response = await axios.patch(
      `${this.baseURL}/api/source-channels/${chatwootChannelId}`,
      data,
      { headers: this.headers }
    );
    return response.data;
  }

  async getAISuggestion(conversationId) {
    const response = await axios.get(
      `${this.baseURL}/api/ai-suggestions/${conversationId}`,
      { headers: this.headers }
    );
    return response.data?.data || null;
  }

  // Operator Presence API
  async getPresenceState(conversationId) {
    const response = await axios.get(
      `${this.baseURL}/api/operator-presence/conversations/${conversationId}`,
      { headers: this.headers }
    );
    return response.data;
  }

  async joinConversation(conversationId, operatorId) {
    const response = await axios.post(
      `${this.baseURL}/api/operator-presence/conversations/${conversationId}/join`,
      { operatorId },
      { headers: this.headers }
    );
    return response.data;
  }

  async leaveConversation(conversationId, operatorId) {
    const response = await axios.delete(
      `${this.baseURL}/api/operator-presence/conversations/${conversationId}/leave`,
      {
        data: { operatorId },
        headers: this.headers,
      }
    );
    return response.data;
  }

  async sendHeartbeat(conversationId, operatorId) {
    const response = await axios.post(
      `${this.baseURL}/api/operator-presence/conversations/${conversationId}/heartbeat`,
      { operatorId },
      { headers: this.headers }
    );
    return response.data;
  }

  getOperatorPresenceStreamURL(conversationId, operatorId) {
    const apiKey = encodeURIComponent(CHATWOOT_EXTRA_API_KEY);
    return `${this.baseURL}/api/operator-presence/conversations/${conversationId}/stream?operatorId=${operatorId}&apiKey=${apiKey}`;
  }

  // Operator Notifications API
  async getOperatorNotifications(operatorId) {
    const response = await axios.get(
      `${this.baseURL}/api/operator-notifications/operator/${operatorId}`,
      { headers: this.headers }
    );
    return response.data;
  }

  getOperatorNotificationStreamURL(operatorId) {
    const apiKey = encodeURIComponent(CHATWOOT_EXTRA_API_KEY);
    return `${this.baseURL}/api/operator-notifications/stream/${operatorId}?apiKey=${apiKey}`;
  }

  async markConversationAsRead(conversationId, operatorId) {
    const response = await axios.post(
      `${this.baseURL}/api/operator-notifications/mark-read`,
      {
        conversationId: String(conversationId),
        operatorId: String(operatorId),
      },
      { headers: this.headers }
    );
    return response.data;
  }

  // Ads API
  async createAd(data) {
    const response = await axios.post(`${this.baseURL}/api/ads`, data, {
      headers: this.headers,
    });
    return response.data;
  }

  async getAllAds() {
    try {
      const response = await axios.get(`${this.baseURL}/api/ads`, {
        headers: this.headers,
      });
      return response.data?.data || [];
    } catch (error) {
      return [];
    }
  }

  async getAd(id) {
    try {
      const response = await axios.get(`${this.baseURL}/api/ads/${id}`, {
        headers: this.headers,
      });
      return response.data?.data || null;
    } catch (error) {
      return null;
    }
  }

  async updateAd(id, data) {
    const response = await axios.patch(`${this.baseURL}/api/ads/${id}`, data, {
      headers: this.headers,
    });
    return response.data;
  }

  async deleteAd(id) {
    const response = await axios.delete(`${this.baseURL}/api/ads/${id}`, {
      headers: this.headers,
    });
    return response.data;
  }

  async uploadPlayerListCsv(file) {
    const formData = new FormData();
    formData.append('file', file);

    const response = await axios.post(
      `${this.baseURL}/api/ads/player-list-csv`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
          'X-API-Key': CHATWOOT_EXTRA_API_KEY,
        },
      }
    );
    return response.data;
  }

  // Media API
  async uploadMedia(file) {
    const formData = new FormData();
    formData.append('file', file);

    const response = await axios.post(`${this.baseURL}/api/media`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
        'X-API-Key': CHATWOOT_EXTRA_API_KEY,
      },
    });
    return response.data;
  }

  async getMedia(id) {
    try {
      const response = await axios.get(`${this.baseURL}/api/media/${id}`, {
        headers: this.headers,
      });
      return response.data?.data || null;
    } catch (error) {
      return null;
    }
  }

  async deleteMedia(id) {
    const response = await axios.delete(`${this.baseURL}/api/media/${id}`, {
      headers: this.headers,
    });
    return response.data;
  }

  async createPersonalCannedResponse({ chatwootUserId, command, text }) {
    const response = await axios.post(
      `${this.baseURL}/api/canned-responses`,
      { chatwootUserId, command, text },
      { headers: this.headers }
    );
    return response.data;
  }

  async getPersonalCannedResponses(chatwootUserId) {
    try {
      const response = await axios.get(
        `${this.baseURL}/api/canned-responses/user/${chatwootUserId}`,
        { headers: this.headers }
      );
      return response.data?.data || [];
    } catch (error) {
      return [];
    }
  }

  async getAllPersonalCannedResponses() {
    try {
      const response = await axios.get(
        `${this.baseURL}/api/canned-responses/all`,
        { headers: this.headers }
      );
      return response.data?.data || [];
    } catch (error) {
      return [];
    }
  }

  async updatePersonalCannedResponse(id, { command, text }) {
    const response = await axios.patch(
      `${this.baseURL}/api/canned-responses/${id}`,
      { command, text },
      { headers: this.headers }
    );
    return response.data;
  }

  async deletePersonalCannedResponse(id) {
    const response = await axios.delete(
      `${this.baseURL}/api/canned-responses/${id}`,
      { headers: this.headers }
    );
    return response.data;
  }

  // Ads Send Operations API
  async startAdSend(adId, bearerTokenHash, chatwootApiUrl) {
    const response = await axios.post(
      `${this.baseURL}/api/ads-send-operations/start`,
      { adId, bearerTokenHash, chatwootApiUrl },
      { headers: this.headers }
    );
    return response.data;
  }

  async testAdSend(adId, telegramId) {
    const response = await axios.post(
      `${this.baseURL}/api/ads-send-operations/test`,
      { adId, telegramId },
      { headers: this.headers }
    );
    return response.data;
  }

  async stopAdSend(sendOpId) {
    const response = await axios.post(
      `${this.baseURL}/api/ads-send-operations/${sendOpId}/stop`,
      {},
      { headers: this.headers }
    );
    return response.data;
  }

  async getAdSendStatus(sendOpId) {
    const response = await axios.get(
      `${this.baseURL}/api/ads-send-operations/${sendOpId}/status`,
      { headers: this.headers }
    );
    return response.data;
  }

  async getAdSendOperations(adId) {
    const response = await axios.get(
      `${this.baseURL}/api/ads-send-operations/ad/${adId}`,
      { headers: this.headers }
    );
    return response.data;
  }

  async getLatestSendOperations() {
    const response = await axios.get(
      `${this.baseURL}/api/ads-send-operations/latest`,
      { headers: this.headers }
    );
    return response.data;
  }

  // Ads Scheduled Send API
  async createScheduledSend(payload) {
    const response = await axios.post(
      `${this.baseURL}/api/ads-scheduled-send`,
      payload,
      { headers: this.headers }
    );
    return response.data;
  }

  async getActiveScheduledSends() {
    const response = await axios.get(
      `${this.baseURL}/api/ads-scheduled-send/active`,
      { headers: this.headers }
    );
    return response.data;
  }

  async getScheduledSendsForAd(adId) {
    const response = await axios.get(
      `${this.baseURL}/api/ads-scheduled-send/ad/${adId}`,
      { headers: this.headers }
    );
    return response.data;
  }

  async rescheduleScheduledSend(id, { scheduledAt, scheduledTz }) {
    const response = await axios.patch(
      `${this.baseURL}/api/ads-scheduled-send/${id}`,
      { scheduledAt, scheduledTz },
      { headers: this.headers }
    );
    return response.data;
  }

  async cancelScheduledSend(id) {
    const response = await axios.delete(
      `${this.baseURL}/api/ads-scheduled-send/${id}`,
      { headers: this.headers }
    );
    return response.data;
  }

  // Ads Log API
  async deleteSentAds(adId) {
    const response = await axios.delete(
      `${this.baseURL}/api/ads-log/sent-ads`,
      {
        data: { adId },
        headers: this.headers,
      }
    );
    return response.data;
  }

  async getAdLogsByUser(tgid, chatwootChannelId = null) {
    const params = { tgid };
    if (chatwootChannelId) {
      params.chatwootChannelId = chatwootChannelId;
    }
    const response = await axios.get(`${this.baseURL}/api/ads-log/by-user`, {
      params,
      headers: this.headers,
    });
    return response.data;
  }

  async getAdErrorLogs(adId) {
    const response = await axios.get(`${this.baseURL}/api/ads-log/errors`, {
      params: { adId },
      headers: this.headers,
    });
    return response.data;
  }

  // Tasks API
  async createTask(data) {
    const response = await axios.post(`${this.baseURL}/api/tasks`, data, {
      headers: this.headers,
    });
    return response.data;
  }

  async updateTask(taskId, data) {
    const response = await axios.patch(
      `${this.baseURL}/api/tasks/${taskId}`,
      data,
      { headers: this.headers }
    );
    return response.data;
  }

  async getTask(taskId) {
    try {
      const response = await axios.get(`${this.baseURL}/api/tasks/${taskId}`, {
        headers: this.headers,
      });
      return response.data;
    } catch (error) {
      return null;
    }
  }

  async getTasks(conversationId) {
    try {
      const response = await axios.get(`${this.baseURL}/api/tasks`, {
        params: { conversationId },
        headers: this.headers,
      });
      return response.data?.data || [];
    } catch (error) {
      return [];
    }
  }

  async getTasksReport(filters = {}) {
    try {
      const response = await axios.get(`${this.baseURL}/api/tasks/report`, {
        params: filters,
        headers: this.headers,
      });
      return response.data?.data || [];
    } catch (error) {
      return [];
    }
  }

  async getTasksReportPaginated({ filters = {}, limit = 100, offset = 0 }) {
    try {
      const response = await axios.get(`${this.baseURL}/api/tasks/report`, {
        params: { ...filters, limit, offset },
        headers: this.headers,
      });
      return response.data?.data || [];
    } catch (error) {
      return [];
    }
  }

  async getKBFiles(limit) {
    const params = {};
    if (limit) params.limit = limit;
    const response = await axios.get(`${this.baseURL}/api/knowledge-base`, {
      params,
      headers: this.headers,
    });
    return response.data;
  }

  async uploadKBFile(file) {
    const formData = new FormData();
    formData.append('file', file);
    const response = await axios.post(
      `${this.baseURL}/api/knowledge-base/upload`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
          'X-API-Key': CHATWOOT_EXTRA_API_KEY,
        },
      }
    );
    return response.data;
  }

  async getKBFile(fileId) {
    const response = await axios.get(
      `${this.baseURL}/api/knowledge-base/${fileId}`,
      { headers: this.headers }
    );
    return response.data;
  }

  async deleteKBFile(fileId) {
    const response = await axios.delete(
      `${this.baseURL}/api/knowledge-base/${fileId}`,
      { headers: this.headers }
    );
    return response.data;
  }

  async getConversationTopic(conversationId) {
    try {
      const response = await axios.get(
        `${this.baseURL}/api/conversation-topics/${conversationId}`,
        { headers: this.headers }
      );
      return response.data;
    } catch (error) {
      return null;
    }
  }

  getConversationTopicStreamURL(operatorId) {
    const apiKey = encodeURIComponent(CHATWOOT_EXTRA_API_KEY);
    return `${this.baseURL}/api/conversation-topics/stream/${operatorId}?apiKey=${apiKey}`;
  }

  async searchMessages({
    query,
    userId,
    participatedByUserId,
    resolvedByUserId,
    dateFrom,
    dateTo,
    accountId,
    limit = 20,
    offset = 0,
  }) {
    const params = { query, accountId, limit, offset };
    if (userId) params.userId = userId;
    if (participatedByUserId)
      params.participatedByUserId = participatedByUserId;
    if (resolvedByUserId) params.resolvedByUserId = resolvedByUserId;
    if (dateFrom) params.dateFrom = dateFrom;
    if (dateTo) params.dateTo = dateTo;

    const response = await axios.get(`${this.baseURL}/api/message-search`, {
      params,
      headers: this.headers,
    });
    return response.data;
  }

  async translateText({ text, targetLang }) {
    const response = await axios.post(
      `${this.baseURL}/api/translate`,
      { text, targetLang },
      { headers: this.headers }
    );
    return response.data;
  }

  async getTelegramDialoguesOperators() {
    const response = await axios.get(
      `${this.baseURL}/api/telegram-dialogues/operators`,
      { headers: this.headers }
    );
    return response.data;
  }

  async addTelegramDialoguesOperator({ chatwootUserId, name }) {
    const response = await axios.post(
      `${this.baseURL}/api/telegram-dialogues/operators`,
      { chatwootUserId, name },
      { headers: this.headers }
    );
    return response.data;
  }

  async removeTelegramDialoguesOperator(chatwootUserId) {
    const response = await axios.delete(
      `${this.baseURL}/api/telegram-dialogues/operators/${chatwootUserId}`,
      { headers: this.headers }
    );
    return response.data;
  }

  async getTelegramSources() {
    const response = await axios.get(
      `${this.baseURL}/api/telegram-dialogues/sources`,
      { headers: this.headers }
    );
    return response.data;
  }

  async getTelegramChats(sourceId, { limit = 50, offset = 0 } = {}) {
    const response = await axios.get(
      `${this.baseURL}/api/telegram-dialogues/sources/${sourceId}/chats`,
      { params: { limit, offset }, headers: this.headers }
    );
    return response.data;
  }

  async getTelegramMessages(sourceId, chatId, { limit = 50, offset = 0 } = {}) {
    const response = await axios.get(
      `${this.baseURL}/api/telegram-dialogues/sources/${sourceId}/chats/${chatId}/messages`,
      { params: { limit, offset }, headers: this.headers }
    );
    return response.data;
  }

  async markTelegramChatRead(sourceId, chatId) {
    await axios.post(
      `${this.baseURL}/api/telegram-dialogues/sources/${sourceId}/chats/${chatId}/read`,
      {},
      { headers: this.headers }
    );
  }

  async sendTelegramMedia(
    sourceId,
    { chatId, file, caption, replyToMsgId, topicId }
  ) {
    const formData = new FormData();
    formData.append('chatId', String(chatId));
    formData.append('file', file);
    if (caption) formData.append('caption', caption);
    if (replyToMsgId) formData.append('replyToMsgId', String(replyToMsgId));
    if (topicId) formData.append('topicId', String(topicId));

    const response = await axios.post(
      `${this.baseURL}/api/telegram-dialogues/sources/${sourceId}/send-media`,
      formData,
      {
        headers: {
          'X-API-Key': CHATWOOT_EXTRA_API_KEY,
        },
      }
    );
    return response.data;
  }

  async sendTelegramMessage(sourceId, { chatId, text, replyToMsgId, topicId }) {
    const response = await axios.post(
      `${this.baseURL}/api/telegram-dialogues/sources/${sourceId}/messages`,
      { chatId, text, replyToMsgId, topicId },
      { headers: this.headers }
    );
    return response.data;
  }

  async fetchTelegramMedia(sourceId, mediaPath) {
    const response = await axios.get(
      `${this.baseURL}/api/telegram-dialogues/sources/${sourceId}/media/${mediaPath}`,
      { headers: this.headers, responseType: 'blob' }
    );
    return response.data;
  }

  async getArchivedTelegramChats(sourceId) {
    const response = await axios.get(
      `${this.baseURL}/api/telegram-dialogues/sources/${sourceId}/archived-chats`,
      { headers: this.headers }
    );
    return response.data;
  }

  async archiveTelegramChat(sourceId, chatDbId, chatData) {
    const response = await axios.post(
      `${this.baseURL}/api/telegram-dialogues/sources/${sourceId}/chats/${chatDbId}/archive`,
      chatData,
      { headers: this.headers }
    );
    return response.data;
  }

  async unarchiveTelegramChat(sourceId, chatDbId) {
    const response = await axios.delete(
      `${this.baseURL}/api/telegram-dialogues/sources/${sourceId}/chats/${chatDbId}/archive`,
      { headers: this.headers }
    );
    return response.data;
  }

  getTelegramSSEUrl(sourceId) {
    const apiKey = encodeURIComponent(CHATWOOT_EXTRA_API_KEY);
    return `${this.baseURL}/api/telegram-dialogues/sources/${sourceId}/sse?apiKey=${apiKey}`;
  }

  async getRagOverview() {
    const response = await axios.get(`${this.baseURL}/api/rag-admin/overview`, {
      headers: this.headers,
    });
    return response.data;
  }

  async getRagTags() {
    const response = await axios.get(`${this.baseURL}/api/rag-admin/tags`, {
      headers: this.headers,
    });
    return response.data.data;
  }

  async createRagTag(data) {
    const response = await axios.post(
      `${this.baseURL}/api/rag-admin/tags`,
      data,
      { headers: this.headers }
    );
    return response.data;
  }

  async updateRagTag(id, data) {
    const response = await axios.put(
      `${this.baseURL}/api/rag-admin/tags/${id}`,
      data,
      { headers: this.headers }
    );
    return response.data;
  }

  async deleteRagTag(id) {
    const response = await axios.delete(
      `${this.baseURL}/api/rag-admin/tags/${id}`,
      { headers: this.headers }
    );
    return response.data;
  }

  async getRagSources() {
    const response = await axios.get(`${this.baseURL}/api/rag-admin/sources`, {
      headers: this.headers,
    });
    return response.data.data;
  }

  async uploadRagSource(file) {
    const formData = new FormData();
    formData.append('file', file);
    const response = await axios.post(
      `${this.baseURL}/api/rag-admin/sources`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
          'X-API-Key': CHATWOOT_EXTRA_API_KEY,
        },
      }
    );
    return response.data;
  }

  async deleteRagSource(id) {
    const response = await axios.delete(
      `${this.baseURL}/api/rag-admin/sources/${id}`,
      { headers: this.headers }
    );
    return response.data;
  }

  async indexRagSource(id) {
    const response = await axios.post(
      `${this.baseURL}/api/rag-admin/sources/${id}/index`,
      {},
      { headers: this.headers }
    );
    return response.data;
  }

  async deindexRagSource(id) {
    const response = await axios.post(
      `${this.baseURL}/api/rag-admin/sources/${id}/deindex`,
      {},
      { headers: this.headers }
    );
    return response.data;
  }

  async reindexRagSource(id) {
    const response = await axios.post(
      `${this.baseURL}/api/rag-admin/sources/${id}/reindex`,
      {},
      { headers: this.headers }
    );
    return response.data;
  }

  async getRagSubSources(sourceId) {
    const response = await axios.get(
      `${this.baseURL}/api/rag-admin/sources/${sourceId}/sub-sources`,
      { headers: this.headers }
    );
    return response.data.data;
  }

  async addRagSubSourceTag(sourceId, subSourceName, tagId) {
    const response = await axios.post(
      `${this.baseURL}/api/rag-admin/sources/${sourceId}/sub-sources/${encodeURIComponent(subSourceName)}/tags`,
      { tagId },
      { headers: this.headers }
    );
    return response.data;
  }

  async removeRagSubSourceTag(sourceId, subSourceName, tagId) {
    const response = await axios.delete(
      `${this.baseURL}/api/rag-admin/sources/${sourceId}/sub-sources/${encodeURIComponent(subSourceName)}/tags/${tagId}`,
      { headers: this.headers }
    );
    return response.data;
  }

  async sendOperatorStatusHeartbeat(operatorId, operatorName) {
    const response = await axios.post(
      `${this.baseURL}/api/operator-status/heartbeat`,
      { operatorId, operatorName },
      { headers: this.headers }
    );
    return response.data;
  }

  async getOnlineOperators() {
    const response = await axios.get(
      `${this.baseURL}/api/operator-status/online`,
      { headers: this.headers }
    );
    return response.data;
  }

  async getOperatorStatusReport(params = {}) {
    const response = await axios.get(
      `${this.baseURL}/api/operator-status/report`,
      { params, headers: this.headers }
    );
    return response.data;
  }

  async getOperatorsList() {
    const response = await axios.get(
      `${this.baseURL}/api/operator-status/operators`,
      { headers: this.headers }
    );
    return response.data;
  }

  async kickOperator(chatwootUserId) {
    const response = await axios.post(
      `${this.baseURL}/api/operator-status/kick`,
      { chatwootUserId },
      { headers: this.headers }
    );
    return response.data;
  }

  getOperatorStatusStreamURL() {
    const apiKey = encodeURIComponent(CHATWOOT_EXTRA_API_KEY);
    return `${this.baseURL}/api/operator-status/stream?apiKey=${apiKey}`;
  }

  // Operator Breaks API
  async startOperatorBreak({ chatwootUserId, operatorName, breakType }) {
    const response = await axios.post(
      `${this.baseURL}/api/operator-breaks/start`,
      { chatwootUserId, operatorName, breakType },
      { headers: this.headers }
    );
    return response.data;
  }

  async endOperatorBreak(chatwootUserId) {
    const response = await axios.post(
      `${this.baseURL}/api/operator-breaks/end`,
      { chatwootUserId },
      { headers: this.headers }
    );
    return response.data;
  }

  async getMyActiveOperatorBreak(chatwootUserId) {
    try {
      const response = await axios.get(
        `${this.baseURL}/api/operator-breaks/me`,
        {
          params: { chatwootUserId },
          headers: this.headers,
        }
      );
      return response.data?.data || null;
    } catch (error) {
      return null;
    }
  }

  async getCurrentOperatorBreaks() {
    const response = await axios.get(
      `${this.baseURL}/api/operator-breaks/current`,
      {
        headers: this.headers,
      }
    );
    return response.data?.data || [];
  }

  async getOperatorBreaksReport(params = {}) {
    const response = await axios.get(
      `${this.baseURL}/api/operator-breaks/report`,
      {
        params,
        headers: this.headers,
      }
    );
    return response.data;
  }

  async createConversationExport({
    accountId,
    dateFrom,
    dateTo,
    bearerTokenHash,
    chatwootApiUrl,
    createdByUserId,
  }) {
    const response = await axios.post(
      `${this.baseURL}/api/conversation-exports/start`,
      {
        accountId,
        dateFrom,
        dateTo,
        bearerTokenHash,
        chatwootApiUrl,
        createdByUserId,
      },
      { headers: this.headers }
    );
    return response.data;
  }

  async getConversationExports(accountId) {
    const response = await axios.get(
      `${this.baseURL}/api/conversation-exports`,
      { params: { accountId }, headers: this.headers }
    );
    return response.data;
  }

  async getConversationExportStatus(id) {
    const response = await axios.get(
      `${this.baseURL}/api/conversation-exports/${id}/status`,
      { headers: this.headers }
    );
    return response.data;
  }

  async stopConversationExport(id) {
    const response = await axios.post(
      `${this.baseURL}/api/conversation-exports/${id}/stop`,
      {},
      { headers: this.headers }
    );
    return response.data;
  }

  async downloadConversationExport(id) {
    const response = await axios.get(
      `${this.baseURL}/api/conversation-exports/${id}/download`,
      { headers: this.headers, responseType: 'blob' }
    );
    return response.data;
  }

  async createConversationExportAnalysis({
    exportId,
    userPrompt,
    createdByUserId,
  }) {
    const response = await axios.post(
      `${this.baseURL}/api/conversation-exports/${exportId}/analyses`,
      { userPrompt, createdByUserId },
      { headers: this.headers }
    );
    return response.data;
  }

  async getConversationExportAnalyses(exportId) {
    const response = await axios.get(
      `${this.baseURL}/api/conversation-exports/${exportId}/analyses`,
      { headers: this.headers }
    );
    return response.data;
  }

  async getConversationExportAnalysis(id) {
    const response = await axios.get(
      `${this.baseURL}/api/conversation-exports/analyses/${id}`,
      { headers: this.headers }
    );
    return response.data;
  }
}

export default new ChatwootExtraAPI();
