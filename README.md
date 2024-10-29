# DashGov.js

Utility functions for Dash governance on the blockchain.

# Table of Contents

- [How to Install](#how-to-install)
  - [with cURL](#with-curl)
  - [with NPM](#with-npm)
- [How to Use](#how-to-use)
  - [Node](#node)
  - [Browser](#browser)
- [QuickStart](#quickstart)
  - [Boilerplate](#boilerplate)
- [API](#api)
  - [Overview](#overview)
  - [Core Details](#core-details)
  - [Additional Details](#additional-details)
- [Notes](#notes)

# How to Install

## with cURL

1. Make a `vendor` folder
   ```sh
   mkdir -p ./vendor/
   ```
2. Download
   ```sh
   # versioned: https://github.com/dashhive/DashGov.js/blob/v1.0.0/dashgov.js
   # latest
   curl https://github.com/dashhive/DashGov.js/blob/main/dashgov.js > ./vendor/dashgov.js
   ```

## with NPM

1. Install `node@22+`
   ```sh
   curl https://webi.sh/node | sh
   source ~/.config/envman/PATH.env
   ```
2. Install `dashgov@1.x`

```sh
npm install --save dashgov@1
```

# How to Use

## Node

```js
// node versions < v22.0 may require `node --experimental-require-module`
let DashGov = require(`dashgov`);

// ...
```

## Browser

```html
<script type="importmap">
  {
    "imports": {
      "dashgov": "./node_modules/dashgov/dashgov.js",
      "dashgov/": "./node_modules/dashgov/"
    }
  }
</script>
<script type="module">
  import DashGov from "dashgov";

  // ...
</script>
```

# QuickStart

There is no real quickstart.

This is a complex process with many steps and several business logic decisions
that you must make for your application.

HOWEVER, the basic process is this:

1. Display Valid Voting and Payment Ranges

   ```js
   let startPeriod = 1;
   let count = 3;
   let offset = count - 1;
   let endPeriod = startPeriod + offset;

   let blockinfo = await Boilerplate.getCurrentBlockinfo();
   let estimates = DashGov.estimateProposalCycles(
     count,
     blockinfo.snapshot,
     blockinfo.secondsPerBlock,
   );
   let selected = DashGov.selectEstimates(estimates, startPeriod, endPeriod);
   ```

2. Create proposal from user choices
   ```js
   let dashAmount = 75;
   let gobjData = DashGov.proposal.draftJson(selected, {
     name: `DCD_Web-Wallet_QR-Explorer`,
     payment_address: `XdNoeWLEGr7U7rz4vobtx1awMMtbzjK5AL`,
     payment_amount: 75,
     url: `https://digitalcash.dev/proposals/dcd-2-web-wallet-address-explorer/`,
   });
   ```
3. Get & Load Burn WIF

   ```js
   let burnWif = await DashKeys.utils.generateWifNonHd();
   let burnAddr = await DashKeys.wifToAddr(burnWif, {
     version: network,
   });

   let minimumAmount = "1.00000250";
   let addrQr = new QRCode({
     content: `dash:${burnAddr}?amount=${minimumAmount}`,
     padding: 4,
     width: 256,
     height: 256,
     color: "#000000",
     background: "#ffffff",
     ecl: "M",
   });

   // Show the SVG to the user
   let addrSvg = addrQr.svg();

   // Check the UTXOs by some interval (10+ seconds to avoid rate limiting)
   let utxos = await rpc("getaddressutxos", {
     addresses: [burnAddr],
   });
   let total = DashTx.sum(utxos);
   if (sats >= 100100000) {
     throw new Error("refusing to burn > 1.001 DASH");
   }
   if (sats < 100000250) {
     throw new Error("need at least 1.000 DASH + 250 dust for fee");
   }
   ```

4. Draft & Check the full Tx and Gobj

   ```js
   let now = Date.now();
   let gobj = DashGov.proposal.draft(
     now,
     selection.start.startMs,
     gobjData, // from 'DashGov.proposal.draftJson' (above)
     {},
   );

   let gobjBurnBytes = DashGov.serializeForBurnTx(gobj);
   let gobjBurnHex = DashGov.utils.bytesToHex(gobjBurnBytes);

   let gobjHashBytes = await DashGov.utils.doubleSha256(gobjBurnBytes);
   let gobjid = DashGov.utils.hashToId(gobjHashBytes);

   let gobjHashBytesReverse = gobjHashBytes.slice();
   gobjHashBytesReverse = gobjHashBytesReverse.reverse();
   let gobjidLittleEndian = DashGov.utils.hashToId(gobjHashBytesReverse);

   let txInfoSigned = await dashTx.hashAndSignAll(txInfo);
   let txid = await DashTx.getId(txInfoSigned.transaction);
   ```

5. Validate & Submit Tx & Gobj

   ```js
   let gobjResult = await Boilerplate.rpc(
     "gobject",
     "check",
     gobj.dataHex,
   ).catch(function (err) {
     return { error: err.message || err.stack || err.toString() };
   });

   // { result: { 'Object status': 'OK' }, error: null, id: 5542 }
   if (gobjResult?.["Object status"] !== "OK") {
     throw new Error(`gobject failed: ${gobjResult?.error}`);
   }

   let txResult = await ProposalApp.rpc(
     "sendrawtransaction",
     draft.tx.transaction,
   );

   // wait for confirmation of burn tx
   for (;;) {
     let txResult = await ProposalApp.rpc("gettxoutproof", [draft.txid]).catch(
       function (err) {
         const E_NOT_IN_BLOCK = -5;
         if (err.code === E_NOT_IN_BLOCK) {
           return null;
         }
         throw err;
       },
     );
     if (txResult) {
       break;
     }
     await DashGov.utils.sleep(10000);
   }

   // wait for confirmation of gobj
   for (;;) {
     // some of these numbers must be strings for some reason
     let hashParent = gobj.hashParent?.toString() || "0";
     let revision = gobj.revision?.toString() || "1";
     let time = gobj.time.toString();
     let gobjResult = await ProposalApp.rpc(
       "gobject",
       "submit",
       hashParent,
       revision,
       time,
       gobj.dataHex,
       txid,
     ).catch(function (err) {
       const E_INVALID_COLLATERAL = -32603;
       if (err.code === E_INVALID_COLLATERAL) {
         return null;
       }
       throw err;
     });
     if (gobjResult) {
       break;
     }
     await DashGov.utils.sleep(10000);
   }
   ```

## Boilerplate

And the Boilerplate functions can be implemented like this: \
(this is not included due to dependency issues with many bundlers)

```js
let network = `mainnet`;

let Boilerplate = {};

let DashKeys = require("dashkeys");
let DashTx = require("dashtx");
let Secp256k1 = require("Secp256k1");

Boilerplate.rpc = async function (method, ...params) {
  let rpcBasicAuth = `api:null`;
  let rpcBaseUrl = `https://${rpcBasicAuth}@rpc.digitalcash.dev/`;
  let rpcExplorer = "https://rpc.digitalcash.dev/";

  // from DashTx
  let result = await DashTx.utils.rpc(rpcBaseUrl, method, ...params);
  return result;
};

Boilerplate.getCurrentBlockinfo = async function () {
  let rootResult = await Boilerplate.rpc("getblockhash", rootHeight);
  let rootInfoResult = await Boilerplate.rpc("getblock", rootResult, 1);
  let root = {
    block: blockInfoResult.height - 25000, // for reasonable estimates
    ms: rootInfoResult.time * 1000,
  };

  let tipsResult = await Boilerplate.rpc("getbestblockhash");
  let blockInfoResult = await Boilerplate.rpc("getblock", tipsResult, 1);
  let snapshot = {
    ms: blockInfoResult.time * 1000,
    block: blockInfoResult.height,
  };

  let secondsPerBlock = DashGov.measureSecondsPerBlock(snapshot, root);

  return {
    secondsPerBlock,
    snapshot,
  };
};

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

Boilerplate.dashtx = DashTx.create(keyUtils);
```

# API

## Overview

- Estimation Utils

  ```js
  DashGov.PROPOSAL_LEAD_MS; // PROPOSAL_LEAD_MS
  DashGov.SUPERBLOCK_INTERVAL; // SUPERBLOCK_INTERVAL

  DashGov.measureSecondsPerBlock(snapshot, root); // sPerBlock
  DashGov.estimateSecondsPerBlock(snapshot); // spb
  DashGov.estimateBlockHeight(ms, secondsPerBlock); // height
  DashGov.getNthNextSuperblock(height, offset); // superblockHeight
  DashGov.estimateProposalCycles(cycles, snapshot, secsPerBlock, leadtime); // estimates

  DashGov.selectEstimates(estimates, startPeriod, endPeriod); // selection
  DashGov.estimateNthNextGovCycle(snapshot, secsPerBlock, offset); // estimate

  DashGov.proposal.draftJson(selected, proposalData); // normalizedData
  DashGov.proposal.draft(now, startEpochMs, data, gobj); // normalGObj
  DashGov.proposal.sortAndEncodeJson(normalizedData); // hex

  DashGov.serializeForBurnTx(gobj); // bytes
  ```

- Convenience Utils
  ```js
  DashGov.utils.bytesToHex(bytes); // hex
  await DashGov.utils.sleep(ms); // void
  await DashGov.utils.doubleSha256(bytes); // gobjHash
  DashGov.utils.hashToId(hashBytes); // id
  DashGov.utils.toVarIntSize(n); // size
  ```

## Core Details

```
DashGov.estimateProposalCycles
DashGov.selectEstimates
DashGov.proposal.draftJson
DashGov.proposal.draft
DashGov.serializeForBurnTx
```

- DashGov.estimateProposalCycles
  ```js
  let estimates = DashGov.estimateProposalCycles(
    count,
    blockinfo.snapshot,
    blockinfo.secondsPerBlock,
  );
  // See definition of 'Estimate' for each of these
  // { last, lameduck, estimates }
  ```
- DashGov.selectEstimates
  ```js
  let selected = DashGov.selectEstimates(estimates, startPeriod, endPeriod);
  // See definition of 'Estimate' for each of these
  // { sart, end }
  ```
- DashGov.proposal.draftJson
  ```js
  let gobjData = DashGov.proposal.draftJson(selected, {
    name: `DCD_Web-Wallet_QR-Explorer`,
    payment_address: `XdNoeWLEGr7U7rz4vobtx1awMMtbzjK5AL`,
    payment_amount: 75,
    url: `https://digitalcash.dev/proposals/dcd-2-web-wallet-address-explorer/`,
  });
  // { end_epoch, name, payment_address,
  //   payment_amount, start_epoch, type, url }
  ```
- DashGov.proposal.draft
  ```js
  let overrides = {};
  let gobj = DashGov.proposal.draft(
    Date.now(),
    selection.start.startMs,
    gobjData,
    overrides,
  );
  // { end_epoch, name, payment_address,
  //   payment_amount, start_epoch, type, url,
  //   hashParent, revision, time, dataHex,
  //   masternodeOutpoint, collateralTxId,
  //   collateralTxOutputIndex, signature }
  ```
- DashGov.serializeForBurnTx
  ```js
  DashGov.serializeForBurnTx(gobj);
  // Uint8Array
  ```

## Additional Details

- Typedefs in the source
- Implementation in `./bin/`
- Implementation at <https://github.com/digitalcashdev/DashProposal>
- Copy and paste into an LLM and ask some questions

# Notes

```text
A block is generated for a self-correcting target average of 155 seconds.
(actually 157.64 seconds over the 7 year average)

Superblock is every 16616 blocks (rounded up from 30 days).
Superblock is when payment occurs.

Voting ends 1662 blocks before the superblock (rounded up from 3 days).
 // ~(60*24*3)/2.6

Votes after the block deadline are discarded for that superblock, but will
be counted for the next, if the proposal is still active.
```
