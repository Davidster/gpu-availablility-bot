const fs = require('fs').promises
const fetch = require('node-fetch')
const PromisePool = require('es6-promise-pool')
const cheerio = require('cheerio')

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

const getDataFile = async () => {
  try {
    return JSON.parse(await fs.readFile(DATA_FILE_PATH, 'utf-8'))
  } catch (err) {
    console.error(err)
  }
}

const writeDataFile = async (data) =>
  fs.writeFile(DATA_FILE_PATH, JSON.stringify(data))

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
      'https://www.memoryexpress.com/Search/Products?Search=3060&PageSize=120&ViewMode=List'
    ),
    getPageText(
      'https://www.memoryexpress.com/Search/Products?Search=3070&PageSize=120&ViewMode=List'
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
  try {
    await sleep(getRandomInt(1000, 1000 * 90))
    console.log(new Date().toLocaleString())
    const start = new Date().getTime()
    const fileData = await getDataFile()

    const ccResponses = []
    const [meResponses] = await Promise.all([
      fetchMeInfo(),
      new PromisePool(ccPromiseGenerator(ccResponses), 10).start(),
    ])

    const filteredResponses = {
      me: meResponses.filter(
        ({ listInventory, inventoryBreakdown }) =>
          !/out of stock/i.test(listInventory) ||
          inventoryBreakdown.some(
            ({ inventory }) => !/out of stock/i.test(inventory)
          )
      ),
      cc: ccResponses.filter((response) => response.avail !== 0),
    }

    console.log('Memory Express:', filteredResponses.me)
    console.log('Canada Computers:', filteredResponses.cc)

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

    console.log(
      `Done in ${Math.round((new Date().getTime() - start) / 1000)} seconds`
    )
    console.log('\n=====================\n')
  } catch (err) {
    console.log(err)
  }
})()
