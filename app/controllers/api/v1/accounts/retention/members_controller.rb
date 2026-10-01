class Api::V1::Accounts::Retention::MembersController < Api::V1::Accounts::BaseController
  before_action :authorize_admin

  rescue_from CustomExceptions::Retention::InvalidMembers,
              CustomExceptions::Retention::StaleMembership,
              with: :render_error_response

  def show
    render json: members_service.show
  end

  def update
    render json: members_service.update(user_ids: params[:user_ids], revision: params.require(:revision))
  end

  private

  def authorize_admin
    authorize Current.account, :update?
  end

  def members_service
    Retention::MembersService.new(Current.account)
  end
end
