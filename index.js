const express = require('express'),
      app = express(),
      redis = require('redis'),
      client = redis.createClient(),
      fs = require('fs'),
      readline = require('readline');

client.on('connect', () => {
    console.log('Redis connected');
});

client.on('error', () => {
    console.log('Error with Redis');
});

const rl = readline.createInterface({
    input: fs.createReadStream('access.log'),
    crlfDelay: Infinity
});

rl.on('line', (line) => {
    let parts = line.split(' - ', 2)
    let timestamp = parts[0]
    let year = timestamp.substring(0, 4),
        month = timestamp.substring(4, 6),
        date = timestamp.substring(6, 8),
        hours = timestamp.substring(9, 11),
        minutes = timestamp.substring(12, 14),
        seconds = timestamp.substring(15, 17),
        ms = timestamp.substring(18, 21)
    let ts = new Date(year, month, date, hours, minutes, seconds, ms)
    if(Date.now() - ts > 3600000){
        console.log('Old: ' + ts.toString())
        return
    }
    console.log(ts.toString());
    let info = parts[1]
})

client.set('test key', 'test val', redis.print);
client.get('test key', (error, result) => {
    if (error) {
        console.log(error);
    }
    console.log('Value: ' + result);
});