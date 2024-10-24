"use strict";

import Assert from "node:assert/strict";

import DashGov from "dashgov";

let currentBlockHeight = 2114623;
let currentBlockMs = Date.parse("2024-08-01T22:01:00Z");
let snapshot = { block: currentBlockHeight, ms: currentBlockMs };

let tests = [
  [
    -1,
    {
      endIso: "2024-06-28T15:00:00.000Z",
      endMs: 1719586800000,
      startIso: "2024-05-29T13:00:00.000Z",
      startMs: 1716987600000,
      voteHeight: 2091954,
      voteIso: "2024-06-21T13:44:00.273Z",
      voteMs: 1718977440273,
      voteDelta: -22669,
      voteDeltaMs: -3572218769.8332934,
      superblockHeight: 2093616,
      superblockDelta: -21007,
      superblockIso: "2024-06-24T14:29:01.958Z",
      superblockMs: 1719239341958,
      superblockDeltaMs: -3310318042.1671886,
    },
  ],
  [
    0,
    {
      endIso: "2024-07-28T22:00:00.000Z",
      endMs: 1722204000000,
      startIso: "2024-06-28T21:00:00.000Z",
      startMs: 1719608400000,
      voteHeight: 2108570,
      voteIso: "2024-07-21T21:03:37.273Z",
      voteMs: 1721595817273,
      voteDelta: -6053,
      voteDeltaMs: -953841819.8332933,
      superblockHeight: 2110232,
      superblockDelta: -4391,
      superblockIso: "2024-07-24T21:48:38.908Z",
      superblockMs: 1721857718908,
      superblockDeltaMs: -691941092.1671883,
    },
  ],
  [
    1,
    {
      endIso: "2024-08-28T06:00:00.000Z",
      endMs: 1724824800000,
      startIso: "2024-07-29T04:00:00.000Z",
      startMs: 1722225600000,
      voteHeight: 2125186,
      voteIso: "2024-08-21T04:23:14.273Z",
      voteMs: 1724214194273,
      voteDelta: 10563,
      voteDeltaMs: 1664535130.166707,
      superblockHeight: 2126848,
      superblockDelta: 12225,
      superblockIso: "2024-08-24T05:08:15.857Z",
      superblockMs: 1724476095857,
      superblockDeltaMs: 1926435857.832812,
    },
  ],
];

for (let test of tests) {
  let offset = test[0];
  let expected = test[1];
  let estimate = DashGov.estimateNthNextGovCycle(
    snapshot,
    DashGov._AVG_SECS_PER_BLOCK,
    offset,
  );
  Assert.deepEqual(estimate, expected);
}

console.info(
  `PASS: DashGov.estimateNthNextGovCycle(snapshot, secsPerBlock, offset)`,
);
