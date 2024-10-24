#!/usr/bin/env node
"use strict";

import DotEnv from "dotenv";

import DashGov from "dashgov";
import DashRpc from "dashrpc";
import DashKeys from "dashkeys";
import DashTx from "dashtx";
import Secp256k1 from "@dashincubator/secp256k1";

import Fs from "node:fs/promises";

DotEnv.config({ path: ".env" });
DotEnv.config({ path: ".env.secret" });

async function main() {
  /* jshint maxcomplexity: 100 */
  /* jshint maxstatements: 1000 */

  console.info("");
  console.info("USAGE");
  console.info(
    "    dashgov draft-proposal [start period] [num periods] <DASH-per-period> <proposal-url> <name> <payment-addr> <./collateral-key.wif> [network]",
  );
  console.info("");
  console.info("EXAMPLE");
  console.info(
    "    dashgov draft-proposal '1' '3' '100' 'https://example.com/example-proposal' example-proposal yT6GS8qPrhsiiLHEaTWPYJMwfPPVt2SSFC ./private-key.wif testnet",
  );
  console.info("");

  /** @type {"mainnet"|"testnet"} */
  let network = "mainnet";
  let isTestnet = takeFlag(process.argv, ["--testnet"]);
  if (isTestnet) {
    network = "testnet";
  }

  let startPeriod = parseInt(process.argv[2] || "1", 10);
  let numPeriods = parseInt(process.argv[3] || "1", 10);
  let dashAmount = parseInt(process.argv[4] || "1", 10);
  let proposalUrl = process.argv[5] || "";
  let proposalName = process.argv[6] || "";
  let paymentAddr = process.argv[7] || "";
  let collateralWifPath = process.argv[8] || "";
  let collateralWif = "";
  if (collateralWifPath) {
    collateralWif = await Fs.readFile(collateralWifPath, "utf8");
    collateralWif = collateralWif.trim();
  }

  let rpcConfig = {
    protocol: process.env.DASHD_RPC_PROTOCOL || "",
    user: process.env.DASHD_RPC_USER || process.env.DASHD_RPC_USERNAME || "",
    pass: process.env.DASHD_RPC_PASS || process.env.DASHD_RPC_PASSWORD || "",
    host: process.env.DASHD_RPC_HOST || process.env.DASHD_RPC_HOSTNAME || "",
    port: parseInt(process.env.DASHD_RPC_PORT || "", 10),
    onconnected: function () {
      console.info(
        `[dashrpc] connected to '${rpcConfig.host}:${rpcConfig.port}'`,
      );
    },
  };

  if (!rpcConfig.protocol) {
    throw new Error(`not set: export DASHD_RPC_PROTOCOL=`);
  }
  if (!rpcConfig.user) {
    throw new Error(`not set: export DASHD_RPC_USERNAME=`);
  }
  if (!rpcConfig.pass) {
    throw new Error(`not set: export DASHD_RPC_PASSWORD=`);
  }
  if (!rpcConfig.host) {
    throw new Error(`not set: export DASHD_RPC_HOSTNAME=`);
  }
  if (!rpcConfig.port) {
    throw new Error(`not set: export DASHD_RPC_PORT=`);
  }

  let rpc = DashRpc.create(rpcConfig);
  void (await rpc.init());

  let tipsResult = await rpc.getBestBlockHash();
  let blockInfoResult = await rpc.getBlock(tipsResult.result, 1);
  let blockHeight = blockInfoResult.result.height;
  let blockMs = blockInfoResult.result.time * 1000;
  // console.log(rootInfoResult.result, blockInfoResult.result, blockMs);
  // let blockTime = new Date(blockMs);

  // for testnet
  let blockDelta = 25000;
  let rootHeight = blockInfoResult.result.height - blockDelta;
  let rootResult = await rpc.getBlockHash(rootHeight);
  let rootInfoResult = await rpc.getBlock(rootResult.result, 1);

  let root = {
    block: rootHeight,
    ms: rootInfoResult.result.time * 1000,
  };
  // let rootTime = new Date(root.ms);

  let totalCycleCount = numPeriods - 1;
  let endPeriod = startPeriod + totalCycleCount;
  let cycleCount = endPeriod;
  let displayCycleCount = Math.max(3, endPeriod);
  let snapshot = {
    ms: blockMs,
    block: blockHeight,
  };
  let secondsPerBlock = DashGov.measureSecondsPerBlock(snapshot, root);
  console.info();
  console.info(
    `Current Seconds per Block (last ${blockDelta} blocks):`,
    secondsPerBlock,
  );
  let estimates = DashGov.estimateProposalCycles(
    displayCycleCount,
    snapshot,
    secondsPerBlock,
  );

  let msToDays = 24 * 60 * 60 * 1000;
  let msToHours = 60 * 60 * 1000;

  let selected = DashGov.selectEstimates(estimates, startPeriod, endPeriod);

  console.info("");
  console.info("VOTING PERIODS");
  if (estimates.lameduck) {
    show(estimates.lameduck, 0);
  }

  let i = 0;
  for (let estimate of estimates.upcoming) {
    i += 1;
    show(estimate, i);
  }

  /**
   * @param {import('../dashgov.js').Estimate} estimate
   * @param {Number} i
   */
  function show(estimate, i) {
    let log = console.info;
    if (i === 0) {
      log = console.error;
    }
    log(``);

    {
      let startEpochTime = new Date(estimate.startMs);
      let startEpochLocale = startEpochTime.toLocaleString();
      startEpochLocale = startEpochLocale.padEnd(23, " ");
      if (i === 0) {
        log(`0: Lame duck (new proposals will be too late to pass):`);
      } else {
        log(`${i}:  Start   | ${startEpochLocale} |   ${estimate.startIso}`);
      }
    }

    let v = new Date(estimate.voteIso);
    let voteLocaleTime = v.toLocaleString();
    voteLocaleTime = voteLocaleTime.padEnd(23, " ");
    let days = estimate.voteDeltaMs / msToDays;
    let daysStr = days.toFixed(2);
    daysStr = `${daysStr} days`;
    if (i === 0) {
      let hours = estimate.voteDeltaMs / msToHours;
      let hoursStr = hours.toFixed(2);
      daysStr = `${hoursStr} hours`;
    }
    log(
      `    Vote    | ${voteLocaleTime} | ${estimate.voteDelta} blocks | ~${daysStr}`,
    );

    let d = new Date(estimate.superblockIso);
    let superblockLocaleTime = d.toLocaleString();
    superblockLocaleTime = superblockLocaleTime.padEnd(23, " ");
    days = estimate.superblockDeltaMs / msToDays;
    daysStr = days.toFixed(2);
    daysStr = `${daysStr} days`;
    if (i === 0) {
      let hours = estimate.superblockDeltaMs / msToHours;
      let hoursStr = hours.toFixed(2);
      daysStr = `${hoursStr} hours`;
    }
    log(
      `    Payment | ${superblockLocaleTime} | ${estimate.superblockDelta} blocks | ~${daysStr}`,
    );

    {
      let endEpochTime = new Date(estimate.endMs);
      let endEpochLocale = endEpochTime.toLocaleString();
      endEpochLocale = endEpochLocale.padEnd(23, " ");
      log(`    End     | ${endEpochLocale} |   ${estimate.endIso}`);
    }
  }

  /**
   * @param {Number} startMs
   * @param {Number} endMs
   */
  function toDaysStr(startMs, endMs) {
    let deltaMs = endMs - startMs;
    let deltaDays = deltaMs / msToDays;
    let deltaDaysStr = deltaDays.toFixed(1);
    return deltaDaysStr;
  }

  {
    let proposalDeltaStr = toDaysStr(
      selected.start.startMs,
      selected.start.endMs,
    );
    let voteDeltaStr = toDaysStr(selected.start.startMs, selected.start.voteMs);
    let paymentDeltaStr = toDaysStr(
      selected.start.superblockMs,
      selected.end.superblockMs,
    );
    let totalDash = cycleCount * dashAmount;

    console.log("");
    console.log(
      `Proposal Period: ${selected.start.startIso} - ${selected.end.endIso} (~${proposalDeltaStr} days)`,
    );
    console.log(
      `Vote Period:     ${selected.start.startIso} - ${selected.end.voteIso} (~${voteDeltaStr} days)`,
    );
    console.log(
      `Payment Period:  ${selected.start.superblockIso} - ${selected.end.superblockIso} (~${paymentDeltaStr} days)`,
    );
    console.log("");
    console.log(`Total Dash: ${totalDash} = ${dashAmount} x ${cycleCount}`);
  }

  if (!proposalUrl) {
    return;
  }

  /** @type {import('../dashgov.js').GObjectData} */
  let gobjData = DashGov.proposal.draftJson(selected, {
    name: proposalName,
    payment_address: paymentAddr,
    payment_amount: dashAmount,
    url: proposalUrl,
  });

  let now = Date.now();
  let gobj = DashGov.proposal.draft(now, selected.start.startMs, gobjData, {});
  console.log(gobj);

  let gobjCollateralBytes = DashGov.serializeForCollateralTx(gobj);
  let gobjCollateralHex = DashGov.utils.bytesToHex(gobjCollateralBytes);

  let gobjHashBytes = await DashGov.utils.doubleSha256(gobjCollateralBytes);
  let gobjId = DashGov.utils.hashToId(gobjHashBytes);

  let gobjHashBytesReverse = gobjHashBytes.slice();
  gobjHashBytesReverse = gobjHashBytesReverse.reverse();
  let gobjIdForward = DashGov.utils.hashToId(gobjHashBytesReverse);

  console.log("");
  console.log("GObject Serialization (for hash for collateral memo)");
  console.log(gobjCollateralHex);

  console.log("");
  console.log("(Collateralized) GObject ID (for op return memo)");
  console.log(gobjIdForward);
  console.log("GObject ID (for 'gobject get <gobj-id>')");
  console.log(gobjId);

  let keyUtils = {
    /**
     * @param {DashTx.TxInputForSig} txInput
     * @param {Number} i
     */
    getPrivateKey: async function (txInput, i) {
      return DashKeys.wifToPrivKey(collateralWif, { version: network });
    },

    /**
     * @param {DashTx.TxInputForSig} txInput
     * @param {Number} i
     */
    getPublicKey: async function (txInput, i) {
      let privKeyBytes = await keyUtils.getPrivateKey(txInput, i);
      let pubKeyBytes = await keyUtils.toPublicKey(privKeyBytes);

      return pubKeyBytes;
    },

    /**
     * @param {Uint8Array} privKeyBytes
     * @param {Uint8Array} txHashBytes
     */
    sign: async function (privKeyBytes, txHashBytes) {
      let sigOpts = { canonical: true, extraEntropy: true };
      let sigBytes = await Secp256k1.sign(txHashBytes, privKeyBytes, sigOpts);

      return sigBytes;
    },

    /**
     * @param {Uint8Array} privKeyBytes
     */
    toPublicKey: async function (privKeyBytes) {
      let isCompressed = true;
      let pubKeyBytes = Secp256k1.getPublicKey(privKeyBytes, isCompressed);

      return pubKeyBytes;
    },
  };
  let dashTx = DashTx.create(keyUtils);

  // dash-cli -testnet getaddressutxos '{"addresses":["yT6GS8qPrhsiiLHEaTWPYJMwfPPVt2SSFC"]}'
  let collateralAddr = await DashKeys.wifToAddr(collateralWif, {
    version: network,
  });

  console.log("");
  console.log("Collateral Address (source of 1 DASH network fee):");
  console.log(collateralAddr);

  // we can set txid to short circuit for testing
  let txid = "";
  // ./bin/gobject-prepare.js 1 3 100 https://example.com/proposal-00 proposal-00 yPPy7Z5RQj46SnFtuFXyT6DFAygxESPR7K ./yjZxu7SJAwgSm1JtWybuQRYQDx34z8P2Z7.wif
  // txid = "10d9862feb6eac6cf6fa653589e39b60a0ed640bae4140c51c35401ffe019479";
  if (!txid) {
    let utxosResult = await rpc.getaddressutxos({
      addresses: [collateralAddr],
    });
    // TODO make sure there's just 1
    // @type {Array<DashTx.TxInput>} */
    let inputs = [utxosResult.result[0]];
    // TODO the hash bytes may be reversed
    // @type {Array<DashTx.TxOutput>} */
    let outputs = [{ memo: gobjIdForward, satoshis: 100000000 }];
    let txInfo = { inputs, outputs };
    let txInfoSigned = await dashTx.hashAndSignAll(txInfo);
    console.log(utxosResult);
    //

    console.log("");
    console.log("Signed Collateral Transaction (ready for broadcast):");
    console.log(txInfoSigned.transaction);

    console.log("");
    console.log("Signed Collateral Transaction ID:");
    txid = await DashTx.getId(txInfoSigned.transaction);
    console.log(txid);

    let txResult = await rpc.request("/", {
      method: "sendrawtransaction",
      params: [txInfoSigned.transaction],
    });
    console.log("");
    console.log("Transaction sent:");
    console.log(txResult);
  }

  for (;;) {
    let txResult = await rpc
      .request("/", {
        method: "gettxoutproof",
        params: [[txid]],
      })
      .catch(
        /** @param {Error} err */ function (err) {
          const E_NOT_IN_BLOCK = -5;
          // @ts-ignore - code exists
          let code = err.code;
          if (code === E_NOT_IN_BLOCK) {
            return null;
          }
          throw err;
        },
      );
    if (txResult) {
      console.log("");
      console.log(`TxOutProof`);
      console.log(txResult);
      let jsonResult = await rpc.request("/", {
        method: "getrawtransaction",
        params: [txid, 1],
      });
      console.log("");
      console.log(`Tx`);
      console.log(jsonResult);
      break;
    }

    console.log(`Waiting for block with TX ${txid}...`);
    await DashGov.utils.sleep(5000);
  }

  // async function check() {
  //   let gobjResult = await rpc
  //     .request("/", {
  //       method: "gobject",
  //       params: ["check", gobj.dataHex],
  //     })
  //     .catch(
  //       /** @param {any} err */ function (err) {
  //         console.error(err.message);
  //         console.error(err.code);
  //         console.error(err);
  //         // invalid collateral hash
  //         return null;
  //       },
  //     );

  //   return gobjResult;
  // }

  async function submit() {
    let req = {
      method: "gobject",
      params: [
        "submit",
        gobj.hashParent?.toString() || "0", // '0' must be a string for some reason
        gobj.revision?.toString() || "1",
        gobj.time.toString(),
        gobj.dataHex,
        txid,
      ],
    };
    let args = req.params.join(" ");
    console.log(`${req.method} ${args}`);
    let gobjResult = await rpc.request("/", req).catch(
      /** @param {Error} err */ function (err) {
        const E_INVALID_COLLATERAL = -32603;
        // @ts-ignore - code exists
        let code = err.code;
        if (code === E_INVALID_COLLATERAL) {
          // wait for collateral to become valid
          console.error(code, err.message);
          return null;
        }
        throw err;
      },
    );

    return gobjResult;
  }

  for (;;) {
    let gobjResult = await submit();
    if (gobjResult) {
      console.log("");
      console.log("gobject submit result:");
      console.log(gobjResult);
      break;
    }

    console.log(`Waiting for GObject ${gobjId}...`);
    await DashGov.utils.sleep(5000);
  }
}

/**
 * Find, remove, and return the first matching flag from the arguments list
 * @param {Array<String>} argv
 * @param {Array<String>} flags
 */
function takeFlag(argv, flags) {
  let flagValue = null;

  for (let flag of flags) {
    let index = argv.indexOf(flag);
    if (index === -1) {
      continue;
    }

    flagValue = argv[index];
    void argv.splice(index, 1);
    break;
  }

  return flagValue;
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
