module CustomExceptions::Retention
  class InvalidMembers < CustomExceptions::Base
    def message
      I18n.t('retention.errors.invalid_members')
    end

    def http_status
      422
    end
  end

  class StaleMembership < CustomExceptions::Base
    def message
      I18n.t('retention.errors.stale_membership')
    end

    def http_status
      409
    end
  end
end
