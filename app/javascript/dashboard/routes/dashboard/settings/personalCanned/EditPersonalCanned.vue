<script>
import { useVuelidate } from '@vuelidate/core';
import { required, minLength } from '@vuelidate/validators';
import { useAlert } from 'dashboard/composables';
import WootMessageEditor from 'dashboard/components/widgets/WootWriter/Editor.vue';
import NextButton from 'dashboard/components-next/button/Button.vue';
import Modal from '../../../../components/Modal.vue';

export default {
  components: {
    NextButton,
    Modal,
    WootMessageEditor,
  },
  props: {
    id: { type: String, default: null },
    edText: { type: String, default: '' },
    edCommand: { type: String, default: '' },
    onClose: { type: Function, default: () => {} },
  },
  setup() {
    return { v$: useVuelidate() };
  },
  data() {
    return {
      editCanned: {
        showAlert: false,
        showLoading: false,
      },
      command: this.edCommand,
      text: this.edText,
      show: true,
    };
  },
  validations: {
    command: {
      required,
      minLength: minLength(2),
    },
    text: {
      required,
    },
  },
  computed: {
    pageTitle() {
      return `${this.$t('PERSONAL_CANNED_MGMT.EDIT.TITLE')} - ${this.edCommand}`;
    },
  },
  methods: {
    setPageName({ name }) {
      this.v$.text.$touch();
      this.text = name;
    },
    resetForm() {
      this.command = '';
      this.text = '';
      this.v$.command.$reset();
      this.v$.text.$reset();
    },
    editPersonalCannedResponse() {
      this.editCanned.showLoading = true;
      this.$store
        .dispatch('personalCannedResponse/updatePersonalCannedResponse', {
          id: this.id,
          command: this.command,
          text: this.text,
        })
        .then(() => {
          this.editCanned.showLoading = false;
          useAlert(this.$t('PERSONAL_CANNED_MGMT.EDIT.API.SUCCESS_MESSAGE'));
          this.resetForm();
          setTimeout(() => {
            this.onClose();
          }, 10);
        })
        .catch(error => {
          this.editCanned.showLoading = false;
          const errorMessage =
            error?.message ||
            this.$t('PERSONAL_CANNED_MGMT.EDIT.API.ERROR_MESSAGE');
          useAlert(errorMessage);
        });
    },
  },
};
</script>

<template>
  <Modal v-model:show="show" :on-close="onClose">
    <div class="flex flex-col h-auto overflow-auto">
      <woot-modal-header :header-title="pageTitle" />
      <form
        class="flex flex-col w-full"
        @submit.prevent="editPersonalCannedResponse()"
      >
        <div class="w-full">
          <label :class="{ error: v$.command.$error }">
            {{ $t('PERSONAL_CANNED_MGMT.EDIT.FORM.SHORT_CODE.LABEL') }}
            <input
              v-model="command"
              type="text"
              :placeholder="
                $t('PERSONAL_CANNED_MGMT.EDIT.FORM.SHORT_CODE.PLACEHOLDER')
              "
              @input="v$.command.$touch"
            />
          </label>
        </div>

        <div class="w-full">
          <label :class="{ error: v$.text.$error }">
            {{ $t('PERSONAL_CANNED_MGMT.EDIT.FORM.CONTENT.LABEL') }}
          </label>
          <div class="editor-wrap">
            <WootMessageEditor
              v-model="text"
              class="message-editor [&>div]:px-1"
              :class="{ editor_warning: v$.text.$error }"
              enable-variables
              :enable-canned-responses="false"
              :placeholder="
                $t('PERSONAL_CANNED_MGMT.EDIT.FORM.CONTENT.PLACEHOLDER')
              "
              @blur="v$.text.$touch"
            />
          </div>
        </div>
        <div class="flex flex-row justify-end w-full gap-2 px-0 py-2">
          <NextButton
            faded
            slate
            type="reset"
            :label="$t('PERSONAL_CANNED_MGMT.EDIT.CANCEL_BUTTON_TEXT')"
            @click.prevent="onClose"
          />
          <NextButton
            type="submit"
            :label="$t('PERSONAL_CANNED_MGMT.EDIT.FORM.SUBMIT')"
            :disabled="
              v$.text.$invalid || v$.command.$invalid || editCanned.showLoading
            "
            :is-loading="editCanned.showLoading"
          />
        </div>
      </form>
    </div>
  </Modal>
</template>

<style scoped lang="scss">
::v-deep {
  .ProseMirror-menubar {
    @apply hidden;
  }

  .ProseMirror-woot-style {
    @apply min-h-[12.5rem];

    p {
      @apply text-base;
    }
  }
}
</style>
