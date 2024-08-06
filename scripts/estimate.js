#!/usr/bin/env node
"use strict";

/** @typedef {Number} Float64 */
/** @typedef {Number} Uint53 */

const MS_PER_DAY = 24 * 60 * 60 * 1000;

let DashGov = require("../");

let Logger = module.exports;

Logger.logEstimate = function (estimate, index) {
  console.info(`Until next (${index})...`);

  let voteDeltaDays = estimate.voteDeltaMs / MS_PER_DAY;
  console.info(`  Vote (${estimate.voteHeight}):`);
  console.info("    Blocks:", estimate.voteDelta);
  console.info("    Days:", voteDeltaDays);
  console.info("    Date:", estimate.voteIso);

  let superblockDeltaDays = estimate.superblockDeltaMs / MS_PER_DAY;
  console.info(`  Superblock (${estimate.superblockHeight}):`);
  console.info("    Blocks:", estimate.superblockDelta);
  console.info("    Days:", superblockDeltaDays);
  console.info("    Date:", estimate.superblockIso);

  console.info("");
};

Logger.logEstimates = function (estimates, secondsPerBlock) {
  if (!secondsPerBlock) {
    secondsPerBlock = DashGov.estimateSecondsPerBlock();
  }
  console.info("Measured Seconds per Block", secondsPerBlock);
  console.info("");
  console.info(estimates);

  console.info("LAST:");
  let index = -1;
  Logger.logEstimate(estimates.last, index);

  index += 1;
  if (estimates.lameduck) {
    console.info("LAME DUCK:");
    Logger.logEstimate(estimates.lameduck, 0);
  }

  console.info("UPCOMING:");
  for (let estimate of estimates.upcoming) {
    index += 1;
    Logger.logEstimate(estimate, index);
  }
};

function help() {
  console.info(`USAGE`);
  console.info(
    `    ./scripts/estimate.js <cycle-count> [block-height] [block-time]`,
  );
  console.info(``);

  console.info(`EXAMPLE`);
  console.info(`   ./scripts/estimate.js '3'`);
  console.info(`   ./scripts/estimate.js '3' '2114623' '2024-08-01T22:01:00Z'`);
  console.info(`   ./scripts/estimate.js '3' '2106925' '2024-07-19T02:56:54Z'`);
  console.info(``);
}

function main() {
  let cycleCountStr = process.argv[2] || "0";
  let cycleCount = parseInt(cycleCountStr, 10);
  let blockHeightStr = process.argv[3] || "0";
  let blockHeight = parseInt(blockHeightStr, 10);
  let blockTime = process.argv[4];
  let blockMs = 0;
  let secondsPerBlock = 0;
  let proposalLeadtime = 0;

  if (!cycleCount) {
    console.error(`ERROR`);
    console.error(`    missing arguments`);
    console.error(``);
    help();
    process.exit(1);
    return;
  }

  if (blockTime) {
    blockMs = Date.parse(blockTime);
  } else {
    blockMs = Date.now();
  }

  if (!blockHeight) {
    secondsPerBlock = DashGov.estimateSecondsPerBlock();
    blockHeight = DashGov.estimateBlockHeight(blockMs, secondsPerBlock);
  }

  let snapshot = {
    ms: blockMs,
    block: blockHeight,
  };
  if (!secondsPerBlock) {
    secondsPerBlock = DashGov.measureSecondsPerBlock(snapshot);
  }
  let estimates = DashGov.estimateProposalCycles(
    cycleCount,
    snapshot,
    secondsPerBlock,
    // DashGov.PROPOSAL_LEAD_MS,
  );

  Logger.logEstimates(estimates, secondsPerBlock);
}

Logger.main = main;

if (require.main === module) {
  main();
}
