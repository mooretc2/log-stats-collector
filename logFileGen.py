#!/usr/bin/env python

# From https://github.com/ccroswhite/logfilegen

import logging
from datetime import datetime
import random
import time


'''
   Dictionary of log items
'''
logItems = [
    "ERROR:401",
    "ERROR:301",
    "ERROR:302",
    "ERROR:501",
    "/prefectch?t=10&s=all - jbrown",
    "/prefectch?t=10&s=all - jharrison",
    "/prefectch?t=10&s=all - carlchen",
    "/prefectch?t=10&s=all - ejones",
    "/prefectch?t=10&s=all - nsharp",
    "/prefectch?t=10&s=all - nrao",
    "/prefectch?t=10&s=all - llightman",
    "/state - jbrown",
    "/state - jharrison",
    "/state - carlchen",
    "/state - ejones",
    "/state - nsharp",
    "/state - nrao",
    "/state - llightman",
    "/auth?u=jbrown",
    "/auth?u=jharrison",
    "/auth?u=carlchen",
    "/auth?u=ejones",
    "/auth?u=nsharp",
    "/auth?u=nrao",
    "/auth?u=llightman",
    "/state/passive - jrbown",
    "/state/passive - jharrison",
    "/state/passive - carlchen",
    "/state/passive - ejones",
    "/state/passive - nsharp",
    "/state/passive - nrao",
    "/state/passive - llightman",
]


def main():
    logFile = 'logFile.log'

    logger = logging.getLogger("logFileGen")
    logger.setLevel(logging.DEBUG)
    fileHandler = logging.FileHandler(logFile)
    fileHandler.setLevel(logging.DEBUG)
    logger.addHandler(fileHandler)

    while True:
        date_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        logger.debug(("{} : {}").format(datetime.now().strftime(
            "%Y-%m-%d %H:%M:%S"), str(logItems[random.randint(0, len(logItems)-1)])))
        # Uncomment if you want to see real console of the log
        #print("{}s - {}s").format(date_time, logItems[random.randint(1,len(logItems)-1)])
        time.sleep(1)

    sys.exit(0)


if __name__ == "__main__":
    main()
