// TODO: delete
/* eslint-disable no-console */
/* eslint-disable prefer-const */
const express = require('express');
const { Pool } = require('pg');
const Tail = require('tail-file');
const constants = require('./app/constants');

// I'm using a pg docker container, but should be easy enough to use another solution
const pool = new Pool({ user: 'postgres', database: 'postgres' });

const app = express();
const port = process.env.PORT || 3000;
require('./app/routes')(app, pool);

let args = process.argv.slice(2);

const createTableQueryString = 'CREATE TABLE IF NOT EXISTS requests('
        + 'id serial PRIMARY KEY,'
        + 'stamp TIMESTAMP NOT NULL,'
        + 'username VARCHAR (255),'
        + 'code SMALLINT,'
        + 'path VARCHAR (255));';

const insertQueryString = 'INSERT INTO requests(stamp, username, code, path) VALUES ';

const cleanupQueryString = `DELETE FROM requests WHERE NOW() - stamp > interval '${constants.MS_IN_60} milliseconds';`;

// JS doesn't have a date parser that takes a format string
let parseDate = (timestamp) => {
    let year = timestamp.substring(0, 4);
    let month = timestamp.substring(5, 7);
    let date = timestamp.substring(8, 10);
    let hours = timestamp.substring(11, 13);
    let minutes = timestamp.substring(14, 16);
    let seconds = timestamp.substring(17, 19);
    return new Date(year, month - 1, date, hours, minutes, seconds);
};

function insertData(input) {
    let line = input.replace(constants.stripNewlinesRegex, '');
    let parts = line.split(' : ');
    let ts = parseDate(parts[0]);
    if (Date.now() - ts > constants.MS_IN_60) {
        return;
    }
    let message = parts[1];
    let subparts = parts[1].split(' - ');
    let userInQuery = parts[1].match(constants.findUserInQueryRegex);
    let user = subparts.length > 1 ? subparts[1] : '';
    let errorCode = null;
    let path = '';

    if (message !== undefined && message.substring(0, 5) === 'ERROR') {
        errorCode = message.substring(6, 9);
    } else {
        [path] = subparts;
    }

    if (userInQuery !== null && user !== '') {
        user = userInQuery[0].slice(2);
    }
    let querystring = `${insertQueryString}(to_timestamp(${ts.getTime() / 1000.0}), '${user}', ${errorCode}, '${path}');`;
    pool.query(querystring, (err) => {
        if (err) {
            console.log(err);
        }
    });
}

// Logic wrapped in async function to make ordering the queries easier
let main = async () => {
    // Create requests table if it doesn't exist.
    await pool.query(createTableQueryString, (err, res) => {
        console.log(err, res);
    });

    // Clean up old data on an interval.
    setInterval(() => {
        pool.query(cleanupQueryString, (err, res) => {
            console.log(err, res);
        });
    }, constants.CLEANUP_INTERVAL);

    // First call to tail brings in all lines from file, then follows changes.
    // Doesn't run until the file is changed the first time, but in a log file
    // that should happen pretty frequently.
    if (args.length < 1) {
        args.push('logFile.log');
    }
    args.map((file) => {
        let tail = new Tail(file, { startPos: 'start', force: true });
        tail.on('line', insertData);

        tail.on('error', (err) => {
            console.log(err);
        });

        return tail.start();
    });

    app.listen(port, () => {
        console.log('Listening on port ', port);
    });

    // For testing. TODO: delete
    // pool.query('SELECT stamp FROM requests;', (err, res) => {
    //     console.log(err, res.rows);
    // });
};

main();
