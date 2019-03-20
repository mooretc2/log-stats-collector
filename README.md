# log-stats-collector
Collects stats from a log file. Devops challenge for Enlitic.

# Usage
Make sure you have npm/node installed, and an instance of PostgreSQL running before starting the app.
I use the basic postgres docker container with the default port exposed.

Run these commands in sequence:
```
npm install
py logFileGen.py
npm run start
```

# Line format examples
Parses logfiles with lines similar to the following:
```
2019-03-20 15:24:52 : /prefectch?t=10&s=all - ejones
2019-03-20 15:24:53 : /state - nsharp
2019-03-20 15:24:54 : /auth?u=ejones
2019-03-20 15:24:55 : ERROR:401
2019-03-20 15:24:56 : /state - ejones
```

# Command Line Args
`log-stats-collector` will follow any filenames passed to it after `npm run start`

# Endpoint Doc
There is one endpoint included, which returns stats for the logfiles it has followed.
Calling `localhost:3000` will return JSON with the following format:
```
{
 codes: {
  5: [
   {
    code: 301,
    count: 53,
    percentage_of_requests: "3.6652835408022130"
   },
   ...
  ],
  15: [
   {
    code: 301,
    count: 225,
    percentage_of_requests: "3.6046139057994233"
   },
   ...
  ],
  30: [
   ...
  ],
  60: [
   ...
  ]
 },
 paths: {
  like codes
 },
 users: {
  like codes
 }
}
```
Where 5/15/30/60 represent time intervals in minutes. Each time interval will have data for each unique code/request/user.
