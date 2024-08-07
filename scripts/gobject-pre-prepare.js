#!/usr/bin/env node
"use strict";

let DashGov = require("../");

function help() {
  console.info("");
  console.info("USAGE");
  console.info(
    "    pre-proposal <start period> <num periods> <DASH-per-period> <proposal-url> <name> <payment-addr>",
  );
  console.info("");
  console.info("EXAMPLE");
  console.info(
    "    pre-proposal '1' '3' '100.0' 'https://example.com/example-proposal' example-proposal yT6GS8qPrhsiiLHEaTWPYJMwfPPVt2SSFC",
  );
  console.info("");
}

async function main() {
  let startPeriod = parseInt(process.argv[2] || "1", 10);
  let numPeriods = parseInt(process.argv[3] || "1", 10);
  let payment_amount = parseFloat(process.argv[4] || "1");
  let url = process.argv[5] || "";
  let name = process.argv[6] || "";
  let payment_address = process.argv[7] || "";
  if (!url) {
    help();
  }

  let totalCycleCount = numPeriods - 1;
  let endPeriod = startPeriod + totalCycleCount;
  let cycleCount = Math.max(3, endPeriod);

  let estimates = DashGov.estimateProposalCycles(
    cycleCount,
    // snapshot,
    // secondsPerBlock,
  );

  let selected = DashGov.selectEstimates(estimates, startPeriod, endPeriod);
  let gobjData = DashGov.proposal.draftJson(selected, {
    name,
    url,
    payment_address,
    payment_amount,
  });

  let now = Date.now();
  let gobj = DashGov.proposal.draft(now, selected.start.startMs, gobjData, {});
  console.log(selected);

  let gobjCollateralBytes = DashGov.serializeForCollateralTx(gobj);
  let gobjCollateralHex = DashGov.utils.bytesToHex(gobjCollateralBytes);

  let crypto = globalThis.crypto;
  let hash1 = await crypto.subtle.digest("SHA-256", gobjCollateralBytes);
  let gobjCollateralHashBuf = await crypto.subtle.digest("SHA-256", hash1);
  let gobjCollateralHashBytes = new Uint8Array(gobjCollateralHashBuf);
  let gobjCollateralHashHex = DashGov.utils.bytesToHex(gobjCollateralHashBytes);

  console.log(
    "gobject prepare",
    gobj.hashParent,
    gobj.revision,
    gobj.time,
    gobj.dataHex,
  );
  console.log("# blackbox gobject serialization");
  console.log(`# ${gobjCollateralHex}`);
  console.log();
  console.log(`# GObject Hash ID (will be found in collateral tx memo)`);
  console.log(`# ${gobjCollateralHashHex}`);
}

main()
  .then(function () {
    process.exit(0);
  })
  .catch(function (err) {
    console.error("Fail:");
    console.error(err.stack || err);
    process.exit(1);
  });
