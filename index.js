const fetch = require('node-fetch')
const PromisePool = require('es6-promise-pool')
const cheerio = require('cheerio')

// const getRandomInt = (min, max) => {
//   min = Math.ceil(min)
//   max = Math.floor(max)
//   return Math.floor(Math.random() * (max - min)) + min
// }

// const sleep = (millis) =>
//   new Promise((resolve) =>
//     setTimeout(() => {
//       resolve()
//     }, millis)
//   )

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

const getPageText = async (url) => (await fetch(url)).text()

const fetchMeInfo = async () => {
  const results = []

  const [searchPage3060, searchPage3070] = await Promise.all([
    getPageText(
      'https://www.memoryexpress.com/Search/Products?Search=3060&PageSize=120&ViewMode=List'
    ),
    getPageText(
      'https://www.memoryexpress.com/Search/Products?Search=3070&PageSize=120&ViewMode=List'
    ),
  ])

  const searchPageForCards = ($) => {
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
          const inventory = $ele
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
            inventory, // TODO: when inventory is '', it means there is some inventory at some location, in which case we must visit the productUrl and check the breakdown of the stock.
          })
        }
      })
  }

  searchPageForCards(cheerio.load(searchPage3060))
  searchPageForCards(cheerio.load(searchPage3070))

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
    resultsRef.push(json)
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
    const start = new Date().getTime()

    const ccResponses = []
    const [meResponses] = await Promise.all([
      fetchMeInfo(),
      new PromisePool(ccPromiseGenerator(ccResponses), 10).start(),
    ])

    console.log(
      'Memory Express:',
      meResponses.filter(
        (meResponse) => !/out of stock/i.test(meResponse.inventory)
      )
    )
    console.log(
      'Canada Computers:',
      ccResponses.filter((response) => response.avail !== 0)
    )
    console.log(
      `Done in ${Math.round((new Date().getTime() - start) / 1000)} seconds`
    )
  } catch (err) {
    console.log(err)
  }
})()
