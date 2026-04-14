import { frontendURL } from '../../../helper/URLHelper';

const OperatorReportsWrapper = () => import('./OperatorReportsWrapper.vue');
const MyResponseStatistics = () => import('./MyResponseStatistics.vue');
const MyResolutionStatistics = () => import('./MyResolutionStatistics.vue');
const MyCsatStatistics = () => import('./MyCsatStatistics.vue');
const MyQualityReviewStatistics = () =>
  import('./MyQualityReviewStatistics.vue');

const meta = {
  permissions: ['administrator', 'agent', 'custom_role'],
};

export default {
  routes: [
    {
      path: frontendURL('accounts/:accountId/my-reports'),
      component: OperatorReportsWrapper,
      children: [
        {
          path: '',
          redirect: to => {
            return {
              name: 'my_response_statistics',
              params: to.params,
            };
          },
        },
        {
          path: 'response_statistics',
          name: 'my_response_statistics',
          meta,
          component: MyResponseStatistics,
        },
        {
          path: 'resolution_statistics',
          name: 'my_resolution_statistics',
          meta,
          component: MyResolutionStatistics,
        },
        {
          path: 'csat_statistics',
          name: 'my_csat_statistics',
          meta,
          component: MyCsatStatistics,
        },
        {
          path: 'quality_review',
          name: 'my_quality_review_statistics',
          meta,
          component: MyQualityReviewStatistics,
        },
      ],
    },
  ],
};
