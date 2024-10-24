#!/usr/bin/env node
"use strict";

import DashGov from "dashgov";
import DashKeys from "dashkeys";
import DashTx from "dashtx";
import * as Secp256k1 from "@dashincubator/secp256k1";

import Fs from "node:fs/promises";

async function main() {
  /* jshint maxcomplexity: 100 */
  /* jshint maxstatements: 1000 */

  console.info("");
  console.info("USAGE");
  console.info(
    "    dashgov draft-proposal [start period] [num periods] <DASH-per-period> <proposal-url> <name> <payment-addr> <./burn-key.wif> [network]",
  );
  console.info("");
  console.info("EXAMPLE");
  console.info(
    "    dashgov draft-proposal '1' '3' '100' 'https://example.com/example-proposal' example-proposal yT6GS8qPrhsiiLHEaTWPYJMwfPPVt2SSFC ./private-key.wif testnet",
  );
  console.info("");

  /** @type {"mainnet"|"testnet"} */
  let network = "mainnet";
  let rpcBasicAuth = `api:null`;
  let rpcBaseUrl = `https://${rpcBasicAuth}@rpc.digitalcash.dev/`;
  let rpcExplorer = "https://rpc.digitalcash.dev/";

  let isTestnet = takeFlag(process.argv, ["--testnet"]);
  if (isTestnet) {
    rpcBaseUrl = `https://${rpcBasicAuth}@trpc.digitalcash.dev/`;
    rpcExplorer = "https://trpc.digitalcash.dev/";
    network = "testnet";
  }

  let startPeriod = parseInt(process.argv[2] || "1", 10);
  let numPeriods = parseInt(process.argv[3] || "1", 10);
  let dashAmount = parseInt(process.argv[4] || "1", 10);
  let proposalUrl = process.argv[5] || "";
  let proposalName = process.argv[6] || "";
  let paymentAddr = process.argv[7] || "";
  let burnWifPath = process.argv[8] || "";
  let burnWif = "";
  if (burnWifPath) {
    burnWif = await Fs.readFile(burnWifPath, "utf8");
    burnWif = burnWif.trim();
  }

  /**
   * @param {String} method
   * @param {...any} params
   */
  async function rpc(method, ...params) {
    let result = await DashTx.utils.rpc(rpcBaseUrl, method, ...params);
    return result;
  }

  let tipsResult = await rpc("getbestblockhash");
  let blockInfoResult = await rpc("getblock", tipsResult, 1);
  let blockHeight = blockInfoResult.height;
  let blockMs = blockInfoResult.time * 1000;
  // console.log(rootInfoResult, blockInfoResult, blockMs);
  // let blockTime = new Date(blockMs);

  // for testnet
  let blockDelta = 25000;
  let rootHeight = blockInfoResult.height - blockDelta;
  let rootResult = await rpc("getblockhash", rootHeight);
  let rootInfoResult = await rpc("getblock", rootResult, 1);

  let root = {
    block: rootHeight,
    ms: rootInfoResult.time * 1000,
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

  let gobjData = DashGov.proposal.draftJson(selected, {
    name: proposalName,
    payment_address: paymentAddr,
    payment_amount: dashAmount,
    url: proposalUrl,
  });

  let now = Date.now();
  let gobj = DashGov.proposal.draft(now, selected.start.startMs, gobjData, {});
  console.log(gobj);

  let gobjBurnBytes = DashGov.serializeForBurnTx(gobj);
  let gobjBurnHex = DashGov.utils.bytesToHex(gobjBurnBytes);

  let gobjHashBytes = await DashGov.utils.doubleSha256(gobjBurnBytes);
  let gobjId = DashGov.utils.hashToId(gobjHashBytes);

  let gobjHashBytesReverse = gobjHashBytes.slice();
  gobjHashBytesReverse = gobjHashBytesReverse.reverse();
  let gobjIdForward = DashGov.utils.hashToId(gobjHashBytesReverse);

  console.log("");
  console.log("GObject Serialization (for hash for burn memo)");
  console.log(gobjBurnHex);

  console.log("");
  console.log("(Burnable) GObject ID (for op return memo)");
  console.log(gobjIdForward);
  console.log("GObject ID (for 'gobject get <gobj-id>')");
  console.log(gobjId);

  let keyUtils = {
    /**
     * @param {DashTx.TxInputForSig} txInput
     * @param {Number} [i]
     */
    getPrivateKey: async function (txInput, i) {
      return DashKeys.wifToPrivKey(burnWif, { version: network });
    },

    /**
     * @param {DashTx.TxInputForSig} txInput
     * @param {Number} [i]
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
      // extraEntropy set to null to make gobject transactions idempotent
      let sigOpts = { canonical: true, extraEntropy: null };
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
  let burnAddr = await DashKeys.wifToAddr(burnWif, {
    version: network,
  });

  console.log("");
  console.log("Burn Address (source of 1 DASH network fee):");
  console.log(burnAddr);

  let txid = "";
  let txInfoSigned;
  {
    let utxosResult = await rpc("getaddressutxos", {
      addresses: [burnAddr],
    });
    // TODO make sure there's just 1
    // @type {Array<DashTx.TxInput>} */
    let inputs = [utxosResult[0]];
    // TODO the hash bytes may be reversed
    // @type {Array<DashTx.TxOutput>} */
    let outputs = [{ memo: gobjIdForward, satoshis: 100000000 }];
    let txInfo = { inputs, outputs };
    txInfoSigned = await dashTx.hashAndSignAll(txInfo);
    console.log(utxosResult);
    //

    console.log("");
    console.log("Signed Burn Transaction (ready for broadcast):");
    console.log(txInfoSigned.transaction);

    console.log("");
    console.log("Signed Burn Transaction ID:");
    txid = await DashTx.getId(txInfoSigned.transaction);
    console.log(txid);
  }

  async function check() {
    let gobjResult = await rpc("gobject", "check", gobj.dataHex).catch(
      /** @param {any} err */ function (err) {
        console.error(err.message);
        console.error(err.code);
        console.error(err);
        // invalid burn hash
        return null;
      },
    );

    // { result: { 'Object status': 'OK' }, error: null, id: 5542 }
    if (gobjResult?.["Object status"] !== "OK") {
      throw new Error(`gobject failed: ${gobjResult.error}`);
    }
    return gobjResult;
  }

  await check();

  // ./bin/gobject-prepare.js 1 3 100 https://example.com/proposal-00 proposal-00 yPPy7Z5RQj46SnFtuFXyT6DFAygxESPR7K ./yjZxu7SJAwgSm1JtWybuQRYQDx34z8P2Z7.wif
  // set to false to short circuit for testing
  if (true) {
    let txResult = await rpc("sendrawtransaction", txInfoSigned.transaction);
    console.log("");
    console.log("Transaction sent:");
    console.log(txResult);
  }

  for (;;) {
    let txResult = await rpc("gettxoutproof", [txid]).catch(
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
      let jsonResult = await rpc("getrawtransaction", txid, 1);
      console.log("");
      console.log(`Tx`);
      console.log(jsonResult);
      break;
    }

    console.log(`Waiting for block with TX ${txid}...`);
    await DashGov.utils.sleep(5000);
  }

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
    let gobjResult = await rpc("gobject", ...req.params).catch(
      /** @param {Error} err */ function (err) {
        const E_INVALID_COLLATERAL = -32603;
        // @ts-ignore - code exists
        let code = err.code;
        if (code === E_INVALID_COLLATERAL) {
          // wait for burn to become valid
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
