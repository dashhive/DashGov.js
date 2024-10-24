"use strict";

import DashGov from "dashgov";

let secondsPerBlock = DashGov.estimateSecondsPerBlock();
if (secondsPerBlock !== DashGov._AVG_SECS_PER_BLOCK) {
  throw new Error(
    `expected '${DashGov._AVG_SECS_PER_BLOCK}' got '${secondsPerBlock}', the method of calculating seconds per block has changed (possibly due to using a different block height and timestamp)`,
  );
}

console.info(
  `PASS: DashGov.estimateSecondsPerBlock() == ${DashGov._AVG_SECS_PER_BLOCK}`,
);
console.info(`PASS: DashGov.measureSecondsPerBlock(snapshot, root)`);
