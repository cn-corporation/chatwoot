import { frontendURL } from '../../../../helper/URLHelper';

const SettingsWrapper = () => import('../SettingsWrapper.vue');
const TelegramDialoguesAccessIndex = () => import('./Index.vue');

export default {
  routes: [
    {
      path: frontendURL(
        'accounts/:accountId/settings/telegram-dialogues-access'
      ),
      component: SettingsWrapper,
      props: {
        headerTitle: 'Telegram Dialogues Access',
        icon: 'i-lucide-send',
      },
      children: [
        {
          path: '',
          name: 'telegram_dialogues_access',
          component: TelegramDialoguesAccessIndex,
          meta: {
            permissions: ['administrator'],
          },
        },
      ],
    },
  ],
};
