/* eslint-disable no-console */
/* eslint-disable prefer-const */
const express = require('express');
const { Pool } = require('pg');
const Tail = require('tail-file');

// I'm using a pg docker container, but should be easy enough to use another solution
const pool = new Pool({ user: 'postgres', database: 'postgres' });

const app = express();
const port = process.env.PORT || 3000;

let args = process.argv.slice(2);

// Constants for milliseconds in each window
const MS_IN_60 = 3600000;
const MS_IN_30 = 1800000;
const MS_IN_15 = 900000;
const MS_IN_5 = 300000;

const statsString = 'SELECT column, COUNT(*)::integer, '
    + 'COUNT(*) * 100.0 / sum(count(*)) over() AS percentage_of_requests '
    + "FROM requests WHERE NOW() - stamp <= interval 'window milliseconds' GROUP BY column;";

let getStats = (ms, col) => pool.query(statsString.replace(/window/g, ms).replace(/column/g, col));

let prepResponse = (data) => {
    let response = {};

    response.codes = {};
    response.codes['60'] = data[0].rows;
    response.codes['30'] = data[1].rows;
    response.codes['15'] = data[2].rows;
    response.codes['5'] = data[3].rows;

    response.paths = {};
    response.paths['60'] = data[4].rows;
    response.paths['30'] = data[5].rows;
    response.paths['15'] = data[6].rows;
    response.paths['5'] = data[7].rows;

    response.users = {};
    response.users['60'] = data[8].rows;
    response.users['30'] = data[9].rows;
    response.users['15'] = data[10].rows;
    response.users['5'] = data[11].rows;
    return response;
};

let collectStats = () => {
    let stats = {};
    // Get status codes for each window
    stats.p60Codes = getStats(MS_IN_60, 'code');
    stats.p30Codes = getStats(MS_IN_30, 'code');
    stats.p15Codes = getStats(MS_IN_15, 'code');
    stats.p5Codes = getStats(MS_IN_5, 'code');

    // Get paths for each window
    stats.p60Paths = getStats(MS_IN_60, 'path');
    stats.p30Paths = getStats(MS_IN_30, 'path');
    stats.p15Paths = getStats(MS_IN_15, 'path');
    stats.p5Paths = getStats(MS_IN_5, 'path');

    // Get paths for each window
    stats.p60Users = getStats(MS_IN_60, 'username');
    stats.p30Users = getStats(MS_IN_30, 'username');
    stats.p15Users = getStats(MS_IN_15, 'username');
    stats.p5Users = getStats(MS_IN_5, 'username');

    return new Promise((resolve) => {
        resolve(stats);
    });
};

app.get('/', (req, res) => {
    collectStats().then((stats) => {
        Promise.all([stats.p60Codes, stats.p30Codes, stats.p15Codes, stats.p5Codes,
            stats.p60Paths, stats.p30Paths, stats.p15Paths, stats.p5Paths,
            stats.p60Users, stats.p30Users, stats.p15Users, stats.p5Users])
            .then((data) => {
                res.json(prepResponse(data));
            })
            .catch((err) => {
                console.log(err);
            });
    });
});

// JS doesn't have a date parser that takes a format string so this is what I'm left with
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
    let line = input.replace(/\r?\n|\r/, ''); // regex from https://stackoverflow.com/a/10805292
    let parts = line.split(' : ');
    let ts = parseDate(parts[0]);
    if (Date.now() - ts > MS_IN_60) {
        return;
    }
    let message = parts[1];
    let subparts = parts[1].split(' - ');
    let userInQuery = parts[1].match(/(?:u=(.*)&?)/g); // Find user in query string
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
        + 'path VARCHAR (255));',
    (err, res) => {
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
