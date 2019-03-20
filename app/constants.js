// Constants for use throughout app
module.exports = {
    // Constants for milliseconds in each window
    MS_IN_60: 3600000,
    MS_IN_30: 1800000,
    MS_IN_15: 900000,
    MS_IN_5: 300000,

    // Interval to cleanup old records in db.
    CLEANUP_INTERVAL: 60000,

    // Regexes
    stripNewlinesRegex: /\r?\n|\r/, // from https://stackoverflow.com/a/10805292
    findUserInQueryRegex: /(?:u=(.*)&?)/g, // find user in query string
};
