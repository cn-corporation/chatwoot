import { frontendURL } from 'dashboard/helper/URLHelper';

import SettingsContent from '../Wrapper.vue';
import SettingsWrapper from '../SettingsWrapper.vue';
import AdsIndex from './AdsIndex.vue';
import AdsNew from './AdsNew.vue';
import AdsEdit from './AdsEdit.vue';

export default {
  routes: [
    {
      path: frontendURL('accounts/:accountId/settings/ads'),
      component: SettingsWrapper,
      children: [
        {
          path: '',
          name: 'ads_wrapper',
          component: AdsIndex,
          meta: {
            permissions: ['administrator'],
          },
        },
      ],
    },
    {
      path: frontendURL('accounts/:accountId/settings/ads'),
      component: SettingsContent,
      props: () => {
        return {
          headerTitle: 'ADS.HEADER',
          icon: 'megaphone',
          showBackButton: true,
        };
      },
      children: [
        {
          path: 'new',
          name: 'ads_new',
          component: AdsNew,
          meta: {
            permissions: ['administrator'],
          },
        },
        {
          path: ':adId/edit',
          name: 'ads_edit',
          component: AdsEdit,
          meta: {
            permissions: ['administrator'],
          },
        },
      ],
    },
  ],
};
