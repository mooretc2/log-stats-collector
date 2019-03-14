const express = require('express'),
      app = express(),
      redis = require('redis'),
      client = redis.createClient();

client.on('connect', () => {
    console.log('Redis connected')
});

client.on('error', () => {
    console.log('Error with Redis')
});