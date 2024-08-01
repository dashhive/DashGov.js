"use strict";

/** @typedef {Number} Float64 */
/** @typedef {Number} Uint53 */

let GObj = require("../");

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function logEstimates(estimates) {
  console.log("Measured Seconds per Block", estimates.secondsPerBlock);
  console.log("");

  let superblockDeltaDays = estimates.superblockDeltaMs / MS_PER_DAY;
  console.log(`Until next Superblock (${estimates.superblockHeight}):`);
  console.log("    Blocks:", estimates.superblockDelta);
  console.log("    Days:", superblockDeltaDays);
  console.log("    Date:", estimates.superblockIso);
  console.log("");

  let voteDeltaDays = estimates.voteDeltaMs / MS_PER_DAY;
  console.log(`Until next Vote (${estimates.voteHeight}):`);
  console.log("    Blocks:", estimates.voteDelta);
  console.log("    Days:", voteDeltaDays);
  console.log("    Date:", estimates.voteIso);
  console.log("");
}

function check2024Aug1() {
  // let currentBlockHeight = 2114626;
  // let currentBlockMs = new Date("2024-08-01T22:09:01Z");
  let currentBlockHeight = 2114623;
  let currentBlockMs = new Date("2024-08-01 22:01:00");

  let estimates = GObj.estimateFutureBlocks(currentBlockMs, currentBlockHeight);
  // TODO test outputs for rough legitimacy
  logEstimates(estimates);
}

check2024Aug1();
