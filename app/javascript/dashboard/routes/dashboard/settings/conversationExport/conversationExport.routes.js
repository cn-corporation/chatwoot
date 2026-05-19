import { frontendURL } from 'dashboard/helper/URLHelper';
import SettingsWrapper from '../SettingsWrapper.vue';
import ConversationExportIndex from './Index.vue';

export default {
  routes: [
    {
      path: frontendURL('accounts/:accountId/settings/conversation-export'),
      component: SettingsWrapper,
      children: [
        {
          path: '',
          name: 'conversation_export_wrapper',
          component: ConversationExportIndex,
          meta: {
            permissions: ['administrator'],
          },
        },
      ],
    },
  ],
};
