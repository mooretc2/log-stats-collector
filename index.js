/* eslint-disable prefer-const */
const express = require('express');
const { Pool } = require('pg');
const Tail = require('tail-file');

// I'm using a pg docker container, but should be easy enough to use another solution
const pool = new Pool({ user: 'postgres', database: 'postgres' });

const app = express();
const port = process.env.PORT || 3000;

// Constants for milliseconds in each window
const MS_IN_60 = 3600000;
const MS_IN_30 = 1800000;
const MS_IN_15 = 900000;
const MS_IN_5 = 300000;

app.get('/', (req, res) => {
    let response = {};

    const codestring = 'SELECT code, COUNT(*)::integer, '
                     + 'COUNT(*) * 100.0 / sum(count(*)) over() AS percentage_of_requests '
                     + "FROM requests WHERE NOW() - stamp <= interval '?' GROUP BY code;";

    // Get status codes for each window
    const p60Codes = pool.query(codestring.replace('?', MS_IN_60));
    const p30Codes = pool.query(codestring.replace('?', MS_IN_30));
    const p15Codes = pool.query(codestring.replace('?', MS_IN_15));
    const p5Codes = pool.query(codestring.replace('?', MS_IN_5));

    Promise.all([p60Codes, p30Codes, p15Codes, p5Codes])
        .then((data) => {
            response.codes = {};
            response.codes.sixty = data[0].rows;
            response.codes.thirty = data[1].rows;
            response.codes.fifteen = data[2].rows;
            response.codes.five = data[3].rows;
            res.json(response);
        });
});

function insertData(input) {
    let line = input.replace(/\r?\n|\r/, ''); // regex from https://stackoverflow.com/a/10805292
    let parts = line.split(' : ');
    let timestamp = parts[0];
    let year = timestamp.substring(0, 4);
    let month = timestamp.substring(5, 7);
    let date = timestamp.substring(8, 10);
    let hours = timestamp.substring(11, 13);
    let minutes = timestamp.substring(14, 16);
    let seconds = timestamp.substring(17, 19);
    let ts = new Date(year, month, date, hours, minutes, seconds);
    if (Date.now() - ts > MS_IN_60) {
        return;
    }
    let message = parts[1];
    let subparts = parts[1].split(' - ');
    let user = subparts.length > 1 ? subparts[1] : '';
    let errorCode = null;
    let path = '';

    if (message !== undefined && message.substring(0, 5) === 'ERROR') {
        errorCode = message.substring(6, 9);
    } else {
        [path] = subparts;
    }
    let querystring = `INSERT INTO requests(stamp, username, code, path) VALUES (to_timestamp(${ts.getTime() / 1000.0}), '${user}', ${errorCode}, '${path}');`;
    pool.query(querystring, (err) => {
        if (err) {
            console.log(err);
        }
    });
}

// Logic wrapped in async function to make ordering the queries easier
let main = async () => {
    await pool.query('CREATE TABLE IF NOT EXISTS requests('
        + 'id serial PRIMARY KEY,'
        + 'stamp TIMESTAMP NOT NULL,'
        + 'username VARCHAR (255),'
        + 'code SMALLINT,'
        + 'path VARCHAR (255));', (err, res) => {
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
    const tail = new Tail('logFile.log', { startPos: 'start', force: true });
    tail.on('line', insertData);

    tail.on('error', (err) => {
        console.log(err);
    });

    tail.start();

    app.listen(port, () => {
        console.log('Listening on port ', port);
    });

    // For testing. TODO: delete
    // pool.query(`SELECT COUNT(*)FROM requests;`, (err, res) => {
    //     console.log(err, res);
    // });
};

main();
