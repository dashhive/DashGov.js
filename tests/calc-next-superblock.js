"use strict";

let DashGov = require("../");

let tests = [
  [
    2115106 - DashGov.SUPERBLOCK_INTERVAL,
    2126848 - DashGov.SUPERBLOCK_INTERVAL,
  ],
  [2115106, 2126848],
  [2126847, 2126848],
  [2126848, 2126848 + DashGov.SUPERBLOCK_INTERVAL],
  [2126849, 2126848 + DashGov.SUPERBLOCK_INTERVAL],
];

for (let test of tests) {
  let height = test[0];
  let expected = test[1];

  let superblock = DashGov.getNextSuperblock(height);
  if (superblock !== expected) {
    throw new Error(
      `expected superblock for height ${height} to be ${expected}, but got ${superblock}`,
    );
  }
}

console.info(`PASS: DashGov.getNextSuperblock(height)`);
