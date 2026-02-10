import { frontendURL } from '../../../../helper/URLHelper';
import SettingsWrapper from '../SettingsWrapper.vue';
import KnowledgeBaseIndex from './Index.vue';

export default {
  routes: [
    {
      path: frontendURL('accounts/:accountId/settings/knowledge-base'),
      component: SettingsWrapper,
      children: [
        {
          path: '',
          name: 'knowledge_base_wrapper',
          component: KnowledgeBaseIndex,
          meta: {
            permissions: ['administrator'],
          },
          beforeEnter: (to, from, next) => {
            if (window.location.hostname !== 'localhost') {
              next({ name: 'general_settings_index', params: to.params });
            } else {
              next();
            }
          },
        },
      ],
    },
  ],
};
