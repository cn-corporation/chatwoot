import { frontendURL } from '../../../../helper/URLHelper';
import {
  ROLES,
  CONVERSATION_PERMISSIONS,
} from 'dashboard/constants/permissions.js';
import SettingsWrapper from '../SettingsWrapper.vue';
import PersonalCannedHome from './Index.vue';

export default {
  routes: [
    {
      path: frontendURL(
        'accounts/:accountId/settings/personal-canned-response'
      ),
      component: SettingsWrapper,
      children: [
        {
          path: '',
          redirect: to => {
            return { name: 'personal_canned_list', params: to.params };
          },
        },
        {
          path: 'list',
          name: 'personal_canned_list',
          meta: {
            permissions: [...ROLES, ...CONVERSATION_PERMISSIONS],
          },
          component: PersonalCannedHome,
        },
      ],
    },
  ],
};
