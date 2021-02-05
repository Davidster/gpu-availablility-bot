const fs = require('fs').promises

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

;(async () => {
  try {
    console.log(new Date().toLocaleString())
    const start = new Date().getTime()
    const fileData = await getDataFile()

    if (fileData) {
      const { me, cc } = fileData

      const newMe = me
        .filter(
          ({ productTitle }) =>
            !productTitle
              .toLowerCase()
              .includes('Hydro X Series XG7'.toLowerCase())
        )
        .map((item) => ({
          ...item,
          inventoryBreakdown: item.inventoryBreakdown.filter(
            ({ inventory }) => !/out of stock/i.test(inventory)
          ),
        }))

      console.log(newMe)

      const newCc = cc.filter(({ avail }) => ![0, '0'].includes(avail))

      await writeDataFile({
        me: newMe,
        cc: newCc,
      })
    }

    console.log(
      `Done in ${Math.round((new Date().getTime() - start) / 1000)} seconds`
    )
    console.log('\n=====================\n')
  } catch (err) {
    console.log(err)
  }
})()
