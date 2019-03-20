const constants = require('./constants');

module.exports = (app, pool) => {
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
        stats.p60Codes = getStats(constants.MS_IN_60, 'code');
        stats.p30Codes = getStats(constants.MS_IN_30, 'code');
        stats.p15Codes = getStats(constants.MS_IN_15, 'code');
        stats.p5Codes = getStats(constants.MS_IN_5, 'code');

        // Get paths for each window
        stats.p60Paths = getStats(constants.MS_IN_60, 'path');
        stats.p30Paths = getStats(constants.MS_IN_30, 'path');
        stats.p15Paths = getStats(constants.MS_IN_15, 'path');
        stats.p5Paths = getStats(constants.MS_IN_5, 'path');

        // Get users for each window
        stats.p60Users = getStats(constants.MS_IN_60, 'username');
        stats.p30Users = getStats(constants.MS_IN_30, 'username');
        stats.p15Users = getStats(constants.MS_IN_15, 'username');
        stats.p5Users = getStats(constants.MS_IN_5, 'username');

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
};
