const fetch = require('node-fetch')

const ids = [
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
  183099
]

const getRandomInt = (min, max) => {
  min = Math.ceil(min)
  max = Math.floor(max)
  return Math.floor(Math.random() * (max - min)) + min
}

const sleep = (millis) => new Promise((resolve) => 
  setTimeout(() => {
    resolve()
  }, millis)
)

const getAllResponses = async () => {
  const responses = []
  let i = 0
  for (const id of ids) {
    console.log(`(${++i} / ${ids.length}) Doing request for id: ${id}.`)
    const responseText = await (await fetch(`https://www.canadacomputers.com/product_info.php?ajaxstock=true&itemid=${id}`, {
      headers: {
        'User-Agent': 'curl/7.64.1',
      },
      compress: false,
    })).text()
    try {
      const json = JSON.parse(responseText.slice(0, responseText.indexOf('}') + 1))
      responses.push({
        id,
        response: json,
      })
    } catch (err) {
      console.error('couldnt get json for text:', responseText)
    }
    
    // await sleep(getRandomInt(50, 250))
  }
  return responses
}

;(async () => {
  const start = new Date().getTime()
  const responses = await getAllResponses()
  console.log('w/ avail !== 0:', responses.filter(({ response }) => response.avail !== 0))
  console.log(`Done in ${Math.round((new Date().getTime() - start) / 1000)} seconds`)
})()
