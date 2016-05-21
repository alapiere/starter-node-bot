
var Botkit = require('botkit')

//IN DOCKER : RUN npm i botkit-middleware-witai
var wit = require('botkit-middleware-witai')({
    token: 'FMDGHRBMTWUMUNNZJN72YXZ6RAA4BRWZ'
});

/*
RUN npm i botkit witbot
var Witbot = require('witbot')
var witbot = Witbot('FMDGHRBMTWUMUNNZJN72YXZ6RAA4BRWZ')
*/

var os = require('os');

var token = process.env.SLACK_TOKEN

var controller = Botkit.slackbot({
  // reconnect to Slack RTM when connection goes bad
  retry: Infinity,
  debug: true
})


//plugin wit
controller.middleware.receive.use(wit.receive);

// Assume single team mode if we have a SLACK_TOKEN
if (token) {
  console.log('Starting in single-team mode')
  controller.spawn({
    token: token
  }).startRTM(function (err, bot, payload) {
    if (err) {
      throw new Error(err)
    }

    console.log('Connected to Slack RTM')
  })
// Otherwise assume multi-team mode - setup beep boop resourcer connection
} else {
  console.log('Starting in Beep Boop multi-team mode')
  require('beepboop-botkit').start(controller, { debug: true })
}

controller.on('bot_channel_join', function (bot, message) {
  bot.reply(message, "I'm here!")
})

// Hi + Direct Mention
controller.hears(['hello', 'hi'], ['direct_mention'],function (bot, message) {

    controller.storage.users.get(message.user, function(err, user) {
        if (user && user.name) {
            bot.reply(message, 'Hello ' + user.name + '!!');
        } else {
            bot.reply(message, 'Hello.');
        }
    });
})

//Hi + Direct message
controller.hears(['hello', 'hi'], ['direct_message'], function (bot, message) {

    controller.storage.users.get(message.user, function(err, user) {
        if (user && user.name) {
            bot.reply(message, 'Hello ' + user.name + '!!');
        } else {
            bot.reply(message, 'Hello.');
        }
    });
  bot.reply(message, 'It\'s nice to talk to you directly.')
})

// Any direct message --> send to wit.ai
controller.hears('.*', ['direct_message', 'direct_mention'], wit.hears, function (bot, message) {
  //var wit = witbot.process(message.text, bot, message)
   bot.reply('wit hello')
   wit.hears('congés', 0.53, function (bot, message, outcome) {

      convo.say('leave !')
   })
})


//HELP
controller.hears('help', ['direct_message', 'direct_mention'], function (bot, message) {
  var help = 'I will respond to the following messages: \n' +
      '`bot hi` for a simple message.\n' +
      '`bot attachment` to see a Slack attachment message.\n' +
      '`@<your bot\'s name>` to demonstrate detecting a mention.\n' +
      '`bot help` to see this again.'
  bot.reply(message, help)
})

//Attachment
controller.hears(['attachment'], ['direct_message', 'direct_mention'], function (bot, message) {
  var text = 'Beep Beep Boop is a ridiculously simple hosting platform for your Slackbots.'
  var attachments = [{
    fallback: text,
    pretext: 'We bring bots to life. :sunglasses: :thumbsup:',
    title: 'Host, deploy and share your bot in seconds.',
    image_url: 'https://storage.googleapis.com/beepboophq/_assets/bot-1.22f6fb.png',
    title_link: 'https://beepboophq.com/',
    text: text,
    color: '#7CD197'
  }]
})

//Shutdown conversation
controller.hears(['shutdown'], 'direct_message,direct_mention,mention', function(bot, message) {

  bot.startConversation(message, function(err, convo) {

      convo.ask('Are you sure you want me to shutdown?', [
          {
              pattern: bot.utterances.yes,
              callback: function(response, convo) {
                  convo.say('Bye!');
                  convo.next();
                  setTimeout(function() {
                      process.exit();
                  }, 3000);
              }
          },
      {
          pattern: bot.utterances.no,
          default: true,
          callback: function(response, convo) {
              convo.say('*Phew!*');
              convo.next();
          }
      }
      ]);
  });
 });

controller.hears(['call me (.*)', 'my name is (.*)'], 'direct_message,direct_mention,mention', function(bot, message) {
   var name = message.match[1];
   controller.storage.users.get(message.user, function(err, user) {
       if (!user) {
           user = {
               id: message.user,
           };
       }
       user.name = name;
       controller.storage.users.save(user, function(err, id) {
           bot.reply(message, 'Got it. I will call you ' + user.name + ' from now on.');
       });
     });
});


controller.hears(['what is my name', 'who am i'], 'direct_message,direct_mention,mention', function(bot, message) {

   controller.storage.users.get(message.user, function(err, user) {
       if (user && user.name) {
           bot.reply(message, 'Your name is ' + user.name);
       } else {
           bot.startConversation(message, function(err, convo) {
               if (!err) {
                   convo.say('I do not know your name yet!');
                   convo.ask('What should I call you?', function(response, convo) {
                       convo.ask('You want me to call you `' + response.text + '`?', [
                           {
                               pattern: 'yes',
                               callback: function(response, convo) {
                                   // since no further messages are queued after this,
                                   // the conversation will end naturally with status == 'completed'
                                   convo.next();
                               }
                           },
                           {
                               pattern: 'no',
                               callback: function(response, convo) {
                                   // stop the conversation. this will cause it to end with status == 'stopped'
                                   convo.stop();
                               }
                           },
                           {
                               default: true,
                               callback: function(response, convo) {
                                   convo.repeat();
                                   convo.next();
                               }
                           }
                       ]);

                       convo.next();

                   }, {'key': 'nickname'}); // store the results in a field called nickname

                   convo.on('end', function(convo) {
                       if (convo.status == 'completed') {
                           bot.reply(message, 'OK! I will update my dossier...');

                           controller.storage.users.get(message.user, function(err, user) {
                               if (!user) {
                                   user = {
                                       id: message.user,
                                   };
                               }
                               user.name = convo.extractResponse('nickname');
                               controller.storage.users.save(user, function(err, id) {
                                   bot.reply(message, 'Got it. I will call you ' + user.name + ' from now on.');
                               });
                           });



                       } else {
                           // this happens if the conversation ended prematurely for some reason
                           bot.reply(message, 'OK, nevermind!');
                       }
                   });
               }
           });
       }
   });
});

controller.hears(['uptime', 'identify yourself', 'who are you', 'what is your name'],
   'direct_message,direct_mention,mention', function(bot, message) {

       var hostname = os.hostname();
       var uptime = formatUptime(process.uptime());

       bot.reply(message,
           ':robot_face: I am a bot named <@' + bot.identity.name +
            '>. I have been running for ' + uptime + ' on ' + hostname + '.');

   });

controller.hears('.*', ['direct_message', 'direct_mention'], function (bot, message) {
  bot.reply(message, 'Sorry <@' + message.user + '>, I don\'t understand. \n')
})


function formatUptime(uptime) {
    var unit = 'second';
    if (uptime > 60) {
        uptime = uptime / 60;
        unit = 'minute';
    }
    if (uptime > 60) {
        uptime = uptime / 60;
        unit = 'hour';
    }
    if (uptime != 1) {
        unit = unit + 's';
    }
    uptime = uptime + ' ' + unit;
    return uptime;
}
