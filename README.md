## To start the bot:

```sh
npm install -g pm2
pm2 start index.js -l debug.log --name 'gpu-availablilty-bot'
pm2 save # TODO: is this one needed?
```