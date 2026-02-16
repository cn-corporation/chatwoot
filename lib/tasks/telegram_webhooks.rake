namespace :telegram do
  desc 'Re-register webhooks for all Telegram channels (updates URL and allowed_updates)'
  task reregister_webhooks: :environment do
    channels = Channel::Telegram.all
    puts "Found #{channels.count} Telegram channel(s)"

    channels.find_each do |channel|
      print "Re-registering webhook for channel ##{channel.id} (#{channel.bot_name})... "
      channel.updated_at = Time.current
      channel.save!
      puts 'OK'
    rescue StandardError => e
      puts "FAILED: #{e.message}"
    end

    puts 'Done'
  end
end
