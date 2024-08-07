# DashGov.js

Utility functions for Dash governance on the blockchain.

## Prosposal

- proposal close (previous end epoch)
- vote close
- superblock (payment)
- proposal open (start epoch)
- vote open
- proposal close (upcoming end epoch)

```js
let current = {
  height: 2114623,
  ms: new Date("2024-08-01 22:01:00").valueOf(),
};
let cycles = 3;
let estimates = DashGov.estimateFutureBlocks(current, cycles);

let proposalObj = {
  start_epoch: current.proposalOpen[0].seconds,
  end_epoch: current.proposalClose[2].seconds,
  name: "test-proposal-4",
  payment_address: "yM7M4YJFv58hgea9FUxLtjKBpKXCsjxWNX",
  payment_amount: 100,
  type: 1,
  url: "https://www.dashcentral.org/p/test-proposal-4",
};

let proposalJson = JSON.stringify(proposal);
let encoder = new TextEncoder();
let proposalBytes = encoder.encode(proposalJson);

// JSON *should* be serialized canonically with lexicographically-sorted keys,
// HOWEVER, a hex string (not bytes) is used to guarantee reproducible output.
let proposalHex = Gobj.utils.bytesToHex(proposalBytes);

let now = Date.now();
let secs = now / 1000;
secs = Math.round(secs);

// Note: the full object is shown for completeness, however, most
//       gobject args were either deprecated or never implemented
let gobj = {
  // hashParent: null,
  // revision: 1, // MUST be one
  time: secs,
  dataHex: proposalHex,
  // signature: null,
};

gobj = DashGov.normalize(gobj);

let gobjBytes = DashGov.serializeForCollateralTx(gobj);
let gobjOpReturn = await DashGov.utils.doubleSha256(gobjBytes);

let keyUtils = {
  getPrivateKey: function (info) {
    // lookup by info.address or similar
    let privKeyBytes = doStuff();
    return privKeyBytes;
  },
};
let dashTx = DashTx.create(keyUtils);
let txraw = await dashTx.createMemo({ bytes: gobjOpReturnBytes });

let result = await RPC.request({
  method: "sendrawtransaction",
  params: [txraw.hex],
});

// poll for txid to appear in recent blocks
let txid = result.txid;

let result = await RPC.request({
  method: "gobject",
  params: [
    "submit",
    gobj.hashParent,
    gobj.revision,
    gobj.time,
    gobj.dataHex,
    txid,
  ],
});
```

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
