# frozen_string_literal: true

log_dir = Rails.root.join('log/agent_assignment')
FileUtils.mkdir_p(log_dir) unless Dir.exist?(log_dir)

log_file = log_dir.join('agent_assignment.log')
AGENT_ASSIGNMENT_LOGGER = Logger.new(log_file, 'daily')
AGENT_ASSIGNMENT_LOGGER.level = Logger::DEBUG
AGENT_ASSIGNMENT_LOGGER.formatter = proc do |severity, datetime, _progname, msg|
  "[#{datetime.strftime('%Y-%m-%d %H:%M:%S.%L')}] [#{severity}] #{msg}\n"
end
