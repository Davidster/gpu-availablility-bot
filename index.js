const fs = require('fs').promises
const fetch = require('node-fetch')
const PromisePool = require('es6-promise-pool')
const cheerio = require('cheerio')
const Slimbot = require('slimbot')

const getRandomInt = (min, max) => {
  min = Math.ceil(min)
  max = Math.floor(max)
  return Math.floor(Math.random() * (max - min)) + min
}

const sleep = (millis) =>
  new Promise((resolve) =>
    setTimeout(() => {
      resolve()
    }, millis)
  )

const ccProductIds = [
  183560,
  185987,
  183101,
  185407,
  185408,
  185675,
  185752,
  183100,
  185087,
  185168,
  184167,
  185406,
  185405,
  184431,
  184743,
  185751,
  183208,
  185086,
  183561,
  184759,
  184760,
  183209,
  183636,
  185988,
  183499,
  183638,
  183099,
]

const DATA_FILE_PATH = './data.json'
const SUBSCRIBERS_FILE_PATH = './subscribers.json'

const getDataFile = async () => {
  try {
    return JSON.parse(await fs.readFile(DATA_FILE_PATH, 'utf-8'))
  } catch (err) {
    console.error(err)
  }
}

const writeDataFile = async (data) =>
  fs.writeFile(DATA_FILE_PATH, JSON.stringify(data))

const getSubscribersFromFile = async () => {
  try {
    return JSON.parse(await fs.readFile(SUBSCRIBERS_FILE_PATH, 'utf-8'))
  } catch (err) {
    console.error(err)
    return []
  }
}

const getBotTokenFromFile = () => fs.readFile('./botToken.txt', 'utf-8')

const writeSubscribersFile = async (subscribers) =>
  fs.writeFile(SUBSCRIBERS_FILE_PATH, JSON.stringify(subscribers))

const getPageText = async (url) => (await fetch(url)).text()

const fetchMeInfo = async () => {
  const results = []

  const getCardLinks = ($) => {
    const resultPageCount = $('.AJAX_List_Pager.AJAX_List_Pager_Compact')
      .first()
      .find('ul > li:not(.AJAX_List_Pager_Next)').length
    if (resultPageCount > 1) {
      console.log(
        'WARNING: result page count > 1. Might need to paginate these requests.'
      )
    }
    $('.c-shca-list-item')
      .toArray()
      .forEach((ele) => {
        const $ele = $(ele)
        const productTitle = $ele
          .find('.c-shca-list-item__body-main > div')
          .first()
          .text()
          .trim()
        if (/3070|3060/i.test(productTitle) && !/win/i.test(productTitle)) {
          const productUrl = $ele
            .find('.c-shca-list-item__body-main')
            .first()
            .attr('href')
            .trim()
          const listInventory = $ele
            .find('.c-shca-list-item__body-inventory')
            .first()
            .text()
            .trim()
          const price = $ele
            .find('.c-shca-list-item__price-listed')
            .first()
            .text()
            .trim()
          results.push({
            price,
            productUrl: `https://www.memoryexpress.com${productUrl}`,
            productTitle,
            // when listInventory is === '', it means there is may be some inventory at some location
            listInventory,
          })
        }
      })
  }

  const [searchPage3060, searchPage3070] = await Promise.all([
    getPageText(
      'https://www.memoryexpress.com/Category/VideoCards?Search=3060&PageSize=120&ViewMode=List'
    ),
    getPageText(
      'https://www.memoryexpress.com/Category/VideoCards?Search=3070&PageSize=120&ViewMode=List'
    ),
  ])

  getCardLinks(cheerio.load(searchPage3060))
  getCardLinks(cheerio.load(searchPage3070))

  const parseCardPage = ($) => {
    const stockItems = $('.c-capr-inventory-store')
    return stockItems.toArray().map((ele) => {
      const $ele = $(ele)
      const storeName = $ele
        .find('.c-capr-inventory-store__name')
        .first()
        .text()
        .trim()
      const inventory = $ele
        .find('.c-capr-inventory-store__availability')
        .first()
        .text()
        .trim()
      return { storeName, inventory }
    })
  }

  await Promise.all(
    results.map(async ({ productUrl }, i) => {
      const pageText = await getPageText(productUrl)
      results[i].inventoryBreakdownTimestamp = new Date().getTime()
      results[i].inventoryBreakdown = parseCardPage(cheerio.load(pageText))
    })
  )

  return results
}

const fetchCCInfo = async (productId, resultsRef) => {
  const responseText = await (
    await fetch(
      `https://www.canadacomputers.com/product_info.php?ajaxstock=true&itemid=${productId}`,
      {
        headers: {
          'User-Agent': 'curl/7.64.1',
        },
        compress: false,
      }
    )
  ).text()
  try {
    const json = JSON.parse(
      responseText.slice(0, responseText.indexOf('}') + 1)
    )
    resultsRef.push({
      ...json,
      productId,
      productUrl: `https://www.canadacomputers.com/product_info.php?cPath=43_557_559&item_id=${productId}`,
      timestamp: new Date().getTime(),
    })
  } catch (err) {
    console.error('couldnt parse json for id: ' + productId)
  }
}

const ccPromiseGenerator = function* (resultsRef) {
  for (const productId of ccProductIds) {
    yield fetchCCInfo(productId, resultsRef)
  }
}

;(async () => {
  let [botToken, subscribers] = await Promise.all([
    getBotTokenFromFile(),
    getSubscribersFromFile(),
  ])
  const tgBot = new Slimbot(botToken)

  const setSubscribers = async (newsubscribers) => {
    try {
      subscribers = newsubscribers
      await writeSubscribersFile(subscribers)
    } catch (err) {
      console.error(err)
    }
  }

  const helpText =
    'Enter the command /subscribe to subscribe and /unsubscribe to unsubscribe'

  tgBot.on('message', (message) => {
    // console.log(message)
    const isStart = message.text === '/subscribe'
    const isSub = message.text === '/subscribe'
    const isUnsub = message.text === '/unsubscribe'
    let reply = undefined
    if (isSub) {
      if (subscribers.some(({ id }) => id === message.chat.id)) {
        reply = "You're already subscribed"
      } else {
        reply = "You've been subscribed!"
        setSubscribers(
          subscribers.concat([
            {
              id: message.chat.id,
              username: message.chat.username,
            },
          ])
        )
        console.log('added subscriber', {
          id: message.chat.id,
          username: message.chat.username,
        })
      }
    } else if (isUnsub) {
      reply = "You've been unsubscribed!"
      setSubscribers(subscribers.filter(({ id }) => id !== message.chat.id))
      console.log('removed subscriber', {
        id: message.chat.id,
        username: message.chat.username,
      })
    } else if (isStart) {
      reply = `Hello. ${helpText}`
    } else {
      reply = `Sorry, I didn't understand that. ${helpText}`
    }
    tgBot.sendMessage(message.chat.id, reply)
  })

  tgBot.startPolling()

  const messageSubscriber = async (subscriber, message) =>
    new Promise((resolve, reject) => {
      tgBot.sendMessage(
        subscriber.id,
        message,
        { parse_mode: 'Markdown', disable_web_page_preview: true },
        (err, result) => {
          if (err) {
            reject(err)
            return
          }
          resolve(result)
        }
      )
    })

  // Promise.allSettled return type:
  //   Promise<[
  //     {status: "fulfilled", value: 99},
  //     {status: "rejected",  reason: Error: an error},
  //     ...etc.
  //   ]>
  const messageSubscribers = async (filteredResponses) => {
    console.log('subscribers', subscribers)
    // const filteredResponses = {
    //   me: [
    //     {
    //       price: '$829.99',
    //       productUrl: 'https://www.memoryexpress.com/Products/MX00114606',
    //       productTitle:
    //         'GeForce RTX 3070 XC3 ULTRA GAMING 8GB PCI-E w/ HDMI, Triple DP',
    //       listInventory: '',
    //       inventoryBreakdownTimestamp: 1612452672534,
    //       inventoryBreakdown: [{ storeName: 'Ottawa:', inventory: '4' }],
    //     },
    //   ],
    //   cc: [
    //     {
    //       loc: 'Ottawa Orleans, ON',
    //       avail: '1',
    //       productId: 183208,
    //       productUrl:
    //         'https://www.canadacomputers.com/product_info.php?cPath=43_557_559&item_id=183208',
    //       timestamp: 1612635374642,
    //     },
    //   ],
    // }
    if (
      filteredResponses.me.length === 0 &&
      filteredResponses.cc.length === 0
    ) {
      return
    }
    /*
      Sample ME Response:
      {
        price: '$829.99',
        productUrl: 'https://www.memoryexpress.com/Products/MX00114606',
        productTitle:
          'GeForce RTX 3070 XC3 ULTRA GAMING 8GB PCI-E w/ HDMI, Triple DP',
        listInventory: '',
        inventoryBreakdownTimestamp: 1612452672534,
        inventoryBreakdown: [{ storeName: 'Ottawa:', inventory: '4' }],
      }
    */
    /*
      Sample CC Response:
      {
        loc: 'Ottawa Orleans, ON',
        avail: '1',
        productId: 183208,
        productUrl: 'https://www.canadacomputers.com/product_info.php?cPath=43_557_559&item_id=183208',
        timestamp: 1612635374642
      }
    */
    let lines = []
    filteredResponses.me.forEach(({ inventoryBreakdown, productUrl }) => {
      inventoryBreakdown.forEach(({ storeName, inventory }) => {
        lines.push(
          `  - [${inventory} available stock in ${storeName}](${productUrl})`
        )
      })
    })
    filteredResponses.cc.forEach(({ avail, loc, productUrl }) => {
      lines.push(`  - [${avail} available stock in ${loc}](${productUrl})`)
    })

    const message = `Found some gpus!\n\n${lines.join('\n')}\n\n${helpText}`
    const responses = await Promise.allSettled(
      subscribers.map((subscriber) => messageSubscriber(subscriber, message))
    )
    responses.forEach((response, i) => {
      if (response.status === 'rejected') {
        const subscriber = subscribers[i]
        console.log(
          `WARNING: failed to send message to subscriber: ${subscribers.username} (${subscribers.id})`,
          response.reason
        )
        setSubscribers(subscribers.filter(({ id }) => id !== subscriber.id))
      }
    })
  }

  const doScrape = async () => {
    const fileData = await getDataFile()

    const ccResponses = []
    const [meResponses] = await Promise.all([
      fetchMeInfo(),
      new PromisePool(ccPromiseGenerator(ccResponses), 10).start(),
    ])

    const filteredResponses = {
      me: meResponses
        .filter(
          ({ listInventory, inventoryBreakdown }) =>
            !/out of stock/i.test(listInventory) ||
            inventoryBreakdown.some(
              ({ inventory }) => !/out of stock/i.test(inventory)
            )
        )
        .map((item) => ({
          ...item,
          inventoryBreakdown: item.inventoryBreakdown.filter(
            ({ inventory }) => !/out of stock/i.test(inventory)
          ),
        })),
      cc: ccResponses.filter((response) => ![0, '0'].includes(response.avail)),
    }

    await writeDataFile({
      me:
        fileData && fileData.me
          ? [...fileData.me, ...filteredResponses.me]
          : filteredResponses.me,
      cc:
        fileData && fileData.cc
          ? [...fileData.cc, ...filteredResponses.cc]
          : filteredResponses.cc,
    })

    return filteredResponses
  }

  const doScrapeLoop = async () => {
    const startTime = new Date().getTime()
    console.log('Starting scrape', new Date().toLocaleString())
    try {
      const filteredResponses = await doScrape()
      console.log('Memory Express:', filteredResponses.me)
      console.log('Canada Computers:', filteredResponses.cc)
      messageSubscribers(filteredResponses)
      console.log(
        `Done in ${Math.round(
          (new Date().getTime() - startTime) / 1000
        )} seconds`
      )
    } catch (err) {
      console.error(err)
    }

    const WAIT_TIME_BASE = 1000 * 60 * 5 // 5 mins
    // const WAIT_TIME_BASE = 1000 * 60
    const RANDOM_ADDED_WAIT_TIME = getRandomInt(1000, 1000 * 90) // wait an extra 1-90 seconds for scraper variablility
    // const RANDOM_ADDED_WAIT_TIME = getRandomInt(1000, 5000)
    const waitTime = WAIT_TIME_BASE + RANDOM_ADDED_WAIT_TIME
    console.log(
      `Waiting ${
        Math.round((waitTime / (1000 * 60)) * 100) / 100
      } minutes till next scrape`
    )
    console.log('\n=====================\n')
    await sleep(waitTime)

    doScrapeLoop()
  }
  doScrapeLoop()
})()
