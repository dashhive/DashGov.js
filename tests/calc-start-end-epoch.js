"use strict";

import DashGov from "dashgov";
//import Logger from "dashgov/scripts/estimate.js";

function check2024Aug1() {
  let currentBlockHeight = 2114623;
  let currentBlockTime = "2024-08-01T22:01:00Z";
  let currentBlockMs = Date.parse(currentBlockTime);

  let cycleCount = 2;
  let snapshot = {
    ms: currentBlockMs,
    block: currentBlockHeight,
  };
  let estimates = DashGov.estimateProposalCycles(cycleCount, snapshot);

  if (!estimates.last?.voteDeltaMs) {
    throw new Error(`missing 'estimates.last'`);
  }
  if (estimates.lameduck?.voteDeltaMs) {
    throw new Error(
      `has 'estimates.lameduck' during an active proposal period`,
    );
  }
  if (estimates.upcoming?.length !== cycleCount) {
    throw new Error(
      `expected '${cycleCount}' upcoming cycles but only got '${estimates.upcoming.length}'`,
    );
  }

  //Logger.logEstimates(estimates);
}

function checkLameduck() {
  let secondsBefore = 3 * 24 * 60 * 60;
  let blocksBefore = secondsBefore / DashGov._AVG_SECS_PER_BLOCK;
  blocksBefore = Math.round(blocksBefore);

  let voteDeadlineHeight = 2108570;
  let voteDeadlineTime = "2024-07-19T02:56:54.552Z";

  let lameDuckHeight = voteDeadlineHeight - blocksBefore;
  // '2024-07-22T02:56:54.552Z' - 3 days
  let lameDuckMs = Date.parse(voteDeadlineTime);

  let cycleCount = 3;
  let snapshot = {
    ms: lameDuckMs,
    block: lameDuckHeight,
  };
  let estimates = DashGov.estimateProposalCycles(cycleCount, snapshot);

  if (!estimates.last?.voteDeltaMs) {
    throw new Error(`missing 'estimates.last'`);
  }
  if (!estimates.lameduck?.voteDeltaMs) {
    throw new Error(`missing 'estimates.lameduck' on lame duck period`);
  }
  if (estimates.upcoming?.length !== cycleCount) {
    throw new Error(
      `expected '${cycleCount}' upcoming cycles but only got '${estimates.upcoming.length}'`,
    );
  }

  //Logger.logEstimates(estimates);
}

check2024Aug1();
checkLameduck();

console.info("PASS: DashGov.estimateProposalCycles(count, snapshot)");
console.info("   - correctly categorizes last, lameduck, and upcoming");
