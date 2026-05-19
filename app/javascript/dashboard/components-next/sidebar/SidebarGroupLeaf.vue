<script setup>
import { isVNode, computed } from 'vue';
import Icon from 'next/icon/Icon.vue';
import Policy from 'dashboard/components/policy.vue';
import { useSidebarContext } from './provider';

const props = defineProps({
  label: { type: String, required: true },
  to: { type: [String, Object], default: null },
  href: { type: String, default: null },
  icon: { type: [String, Object], default: null },
  active: { type: Boolean, default: false },
  component: { type: Function, default: null },
  count: { type: Number, default: 0 },
  totalCount: { type: Number, default: 0 },
  permissions: { type: Array, default: null },
});

const { resolvePermissions, resolveFeatureFlag } = useSidebarContext();

const shouldRenderComponent = computed(() => {
  return typeof props.component === 'function' || isVNode(props.component);
});

const resolvedPermissions = computed(
  () => props.permissions ?? resolvePermissions(props.to)
);
</script>

<!-- eslint-disable-next-line vue/no-root-v-if -->
<template>
  <Policy
    :permissions="resolvedPermissions"
    :feature-flag="resolveFeatureFlag(to)"
    as="li"
    class="py-0.5 ltr:pl-3 rtl:pr-3 rtl:mr-3 ltr:ml-3 relative text-n-slate-11 child-item before:bg-n-slate-4 after:bg-transparent after:border-n-slate-4 before:left-0 rtl:before:right-0"
  >
    <component
      :is="href ? 'a' : to ? 'router-link' : 'div'"
      :to="to || undefined"
      :href="href || undefined"
      :target="href ? '_blank' : undefined"
      :rel="href ? 'noopener noreferrer' : undefined"
      class="flex h-8 items-center gap-2 px-2 py-1 rounded-lg max-w-[9.438rem] hover:bg-gradient-to-r from-transparent via-n-slate-3/70 to-n-slate-3/70 group [-webkit-touch-callout:none]"
      :class="{
        'text-n-blue-text bg-n-alpha-2 active': active,
      }"
      @contextmenu.prevent
    >
      <component
        :is="component"
        v-if="shouldRenderComponent"
        :label="label"
        :icon="icon"
        :active="active"
        :count="count"
        :to="to"
      />
      <template v-else>
        <Icon v-if="icon" :icon="icon" class="size-4 inline-block" />
        <div v-tooltip="label" class="truncate min-w-0">{{ label }}</div>
        <span
          v-if="totalCount > 0"
          class="text-xs font-medium px-1 py-0.5 rounded bg-n-slate-3 text-n-slate-11 flex-shrink-0"
        >
          {{ totalCount > 99 ? '99+' : totalCount }}
        </span>
        <span
          v-if="count > 0"
          class="ml-auto text-xs font-semibold px-1.5 py-0.5 rounded bg-n-ruby-9 text-white flex-shrink-0"
        >
          {{ count }}
        </span>
      </template>
    </component>
  </Policy>
</template>
