import { ref, computed } from 'vue';
import chatwootExtraAPI from 'dashboard/api/chatwootExtra';

export function useAISuggestions() {
  const aiSuggestion = ref(null);
  const isLoadingSuggestion = ref(false);
  const suggestionError = ref(null);

  const hasSuggestion = computed(() => {
    return aiSuggestion.value && aiSuggestion.value.content;
  });

  const suggestionContent = computed(() => {
    return aiSuggestion.value?.content || '';
  });

  const fetchAISuggestion = async conversationId => {
    if (!conversationId) {
      aiSuggestion.value = null;
      return null;
    }

    isLoadingSuggestion.value = true;
    suggestionError.value = null;

    try {
      const suggestion = await chatwootExtraAPI.getAISuggestion(conversationId);
      aiSuggestion.value = suggestion;
      suggestionError.value = null;
      return suggestion;
    } catch (error) {
      // Extract error message from response
      const errorData = error.response?.data;
      suggestionError.value = {
        message:
          errorData?.error || error.message || 'Failed to load AI suggestion',
        success: errorData?.success || false,
      };
      aiSuggestion.value = null;
      return null;
    } finally {
      isLoadingSuggestion.value = false;
    }
  };

  const clearSuggestion = () => {
    aiSuggestion.value = null;
    suggestionError.value = null;
  };

  return {
    aiSuggestion,
    isLoadingSuggestion,
    suggestionError,
    hasSuggestion,
    suggestionContent,
    fetchAISuggestion,
    clearSuggestion,
  };
}
