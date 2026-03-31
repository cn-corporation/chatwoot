import { frontendURL } from '../../../../helper/URLHelper';

const SettingsWrapper = () => import('../../settings/SettingsWrapper.vue');
const RagAdminIndex = () => import('./Index.vue');

export default {
  routes: [
    {
      path: frontendURL('accounts/:accountId/settings/rag-admin'),
      component: SettingsWrapper,
      props: {
        headerTitle: 'RAG Admin',
        icon: 'i-lucide-brain',
      },
      children: [
        {
          path: '',
          name: 'rag_admin_index',
          component: RagAdminIndex,
          meta: {
            permissions: ['administrator'],
          },
        },
      ],
    },
  ],
};
