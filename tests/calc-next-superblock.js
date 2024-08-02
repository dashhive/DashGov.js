"use strict";

let DashGov = require("../");

let sb = 2126848;
let tests = [
  // Previous Cycle (past)
  [-1, sb - 2, sb - 2 * DashGov.SUPERBLOCK_INTERVAL],
  [-1, sb - 1, sb - 2 * DashGov.SUPERBLOCK_INTERVAL],
  [-1, sb + 0, sb - DashGov.SUPERBLOCK_INTERVAL],
  [-1, sb + 1, sb - DashGov.SUPERBLOCK_INTERVAL],
  [-1, sb + 2, sb - DashGov.SUPERBLOCK_INTERVAL],
  // Current Cycle (past / exact present)
  [0, sb - 2, sb - DashGov.SUPERBLOCK_INTERVAL],
  [0, sb - 1, sb - DashGov.SUPERBLOCK_INTERVAL],
  [0, sb + 0, sb],
  [0, sb + 1, sb],
  [0, sb + 2, sb],
  // Upcoming Cycle
  [+1, sb - 2, sb],
  [+1, sb - 1, sb],
  [+1, sb + 0, sb + DashGov.SUPERBLOCK_INTERVAL],
  [+1, sb + 1, sb + DashGov.SUPERBLOCK_INTERVAL],
  [+1, sb + 2, sb + DashGov.SUPERBLOCK_INTERVAL],
];

for (let test of tests) {
  let offset = test[0];
  let height = test[1];
  let expected = test[2];

  let superblock = DashGov.getNthNextSuperblock(height, offset);
  if (superblock !== expected) {
    throw new Error(
      `expected superblock for height ${height} to be ${expected}, but got ${superblock}`,
    );
  }
}

console.info(`PASS: DashGov.getNthNextSuperblock(height)`);
