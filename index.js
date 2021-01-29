const fetch = require('node-fetch')
const PromisePool = require('es6-promise-pool')

console.log('yope')

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
    const responses = []
    await new PromisePool(ccPromiseGenerator(responses), 10).start()
    console.log(
      'w/ avail !== 0:',
      responses.filter((response) => response.avail !== 0)
    )
    console.log(
      `Done in ${Math.round((new Date().getTime() - start) / 1000)} seconds`
    )
  } catch (err) {
    console.log(err)
  }
})()
