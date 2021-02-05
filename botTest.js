const fs = require('fs').promises
const Slimbot = require('slimbot')

;(async () => {
  try {
    const botToken = await fs.readFile('./botToken.txt', 'utf-8')
    const slimbot = new Slimbot(botToken)

    let subscriberChatIds = []

    slimbot.on('message', (message) => {
      console.log(message)
      const isStart = message.text === '/subscribe'
      const isSub = message.text === '/subscribe'
      const isUnsub = message.text === '/unsubscribe'
      let reply = undefined
      if (isSub) {
        reply = "You've been subscribed!"
        subscriberChatIds = subscriberChatIds.concat([message.chat.id])
      } else if (isUnsub) {
        reply = "You've been unsubscribed!"
        subscriberChatIds = subscriberChatIds.filter(
          (sub) => sub !== message.chat.id
        )
      } else if (isStart) {
        reply =
          'Hello. Enter the command /subscribe to subscribe and /unsubscribe to unsubscribe'
      } else {
        reply =
          "I didn't understand that. Enter the command /subscribe to subscribe and /unsubscribe to unsubscribe"
      }
      slimbot.sendMessage(message.chat.id, reply)
    })

    let i = 0

    setInterval(() => {
      i++
      subscriberChatIds.forEach((subscriberChatId) => {
        slimbot.sendMessage(subscriberChatId, i.toString())
      })
    }, [1000])

    slimbot.startPolling()
  } catch (err) {
    console.log(err)
  }
})()
