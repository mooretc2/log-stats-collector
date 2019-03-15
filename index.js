const express = require('express'),
      app = express(),
      { Pool } = require('pg'),
      //I'm using a pg docker container, but should be easy enough to use another solution
      pool = new Pool({user: 'postgres', database: 'postgres'}),
      fs = require('fs'),
      readline = require('readline');

// Constants for milliseconds in each window
const MS_IN_60 = 3600000,
      MS_IN_30 = 1800000,
      MS_IN_15 = 900000,
      MS_IN_5 = 300000;

function insertData(line) {
    let parts = line.split(' - ');
    let timestamp = parts[0];
    let year = timestamp.substring(0, 4),
        month = timestamp.substring(4, 6),
        date = timestamp.substring(6, 8),
        hours = timestamp.substring(9, 11),
        minutes = timestamp.substring(12, 14),
        seconds = timestamp.substring(15, 17),
        ms = timestamp.substring(18, 21);
    let ts = new Date(year, month, date, hours, minutes, seconds, ms);
    if(Date.now() - ts > MS_IN_60){
        console.log('Old: %s', ts.toLocaleString());
        return
    }
    let message = parts[1],
        user = '',
        errorCode = null,
        path = '';
    
    if(parts[1].substring(0, 5) == 'ERROR'){
        errorCode = parts[1].substring(6, 9);
    } else {
        path = parts[1];
    }
    if(parts[2] !== undefined){
        user = parts[2];
    }
    querystring = `INSERT INTO requests(stamp, username, code, path) VALUES
                    (to_timestamp(${ts.getTime() / 1000.0}), '${user}', ${errorCode}, '${path}');`;
    console.log(querystring);
    console.log('Time: %s, Message: %s, User: %s', ts.toLocaleString(), message, user);
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

    const rl = readline.createInterface({
        input: fs.createReadStream('access.log'),
        crlfDelay: Infinity
    });

    rl.on('line', insertData);

    pool.query('SELECT * FROM requests;', (err, res) => {
        console.log(err, res)
    });
}

main();
