const express = require('express'),
      app = express(),
      { Pool } = require('pg'),
      //I'm using a pg docker container, but should be easy enough to use another solution
      pool = new Pool({user: 'postgres', database: 'postgres'}),
      fs = require('fs'),
      readline = require('readline'),
      Tail = require('tail-file');

// Constants for milliseconds in each window
const MS_IN_60 = 3600000,
      MS_IN_30 = 1800000,
      MS_IN_15 = 900000,
      MS_IN_5 = 300000;

function insertData(input) {
    line = input.replace(/\r?\n|\r/, "") //regex from https://stackoverflow.com/a/10805292
    let parts = line.split(' : ');
    let timestamp = parts[0];
    let year = timestamp.substring(0, 4),
        month = timestamp.substring(5, 7),
        date = timestamp.substring(8, 10),
        hours = timestamp.substring(11, 13),
        minutes = timestamp.substring(14, 16),
        seconds = timestamp.substring(17, 19);
    let ts = new Date(year, month, date, hours, minutes, seconds);
    if(Date.now() - ts > MS_IN_60){
        console.log('Old: %s', ts.toLocaleString());
        return
    }
    let message = parts[1],
        subparts = parts[1].split(' - ');
        user = subparts.length > 1 ? subparts[1] : '',
        errorCode = null,
        path = '';
    
    if(message != undefined && message.substring(0, 5) == 'ERROR'){
        errorCode = message.substring(6, 9);
    } else {
        path = subparts[0];
    }
    querystring = `INSERT INTO requests(stamp, username, code, path) VALUES
                  (to_timestamp(${ts.getTime() / 1000.0}), '${user}', ${errorCode}, '${path}');`;
    console.log(querystring);
    pool.query(querystring, (err, res) => {
        console.log(err, res);
    })
}

// Logic wrapped in async function to make ordering the queries easier
main = async () => {
    await pool.query('CREATE TABLE IF NOT EXISTS requests(' +
        'id serial PRIMARY KEY,' +
        'stamp TIMESTAMP NOT NULL,' +
        'username VARCHAR (255),' +
        'code SMALLINT,' +
        'path VARCHAR (255));', (err, res) => {
            console.log(err, res);
        });

    // Clean up old data on startup. This will be moved to a periodic query later.
    await pool.query(`DELETE FROM requests WHERE NOW() - stamp > interval '${MS_IN_60} milliseconds';`, (err, res) => {
        console.log(err, res);
    });

    // For testing. TODO: delete
    // await pool.query(`DELETE FROM requests;`, (err, res) => {
    //     console.log(err, res);
    // });

    // First call to tail brings in all lines from file, then follows changes.
    // Doesn't run until the file is changed the first time, but in a log file 
    // that should happen pretty frequently.
    const tail = new Tail('logFile.log', {startPos: 'start', force: true});
    // tail.on('line', insertData);
    let linecount = 0
    tail.on('line', insertData)

    tail.on('error', (error) => {
        console.log(error);
    });

    tail.start();

    pool.query('SELECT * FROM requests;', (err, res) => {
        console.log(err, res)
    });
}

main();
