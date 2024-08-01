"use strict";

// Adapted from
//   github.com/dashpay/dash/tree/develop/src/governance/common.cpp

// USAGE
//   node ./gobject-hash-debugger.js

var GObj = module.exports;

GObj._type = 0b0000010; // from SER_GETHASH (bitwise enum)
GObj._typeBytes = Uint8Array.from([0b0000010]);
GObj._protocalVersion = 70231; // 0x00011257 (BE) => 0x57120100 (LE)
GObj._protocalVersionBytes = Uint8Array.from([0x57, 0x12, 0x01, 0x00]);

/**
 * Returns the number of extra bytes needed to encode the variable-length `nSize`.
 * If it is less than 253, we will store `nSize` in just the one (assumed) byte.
 * Otherwise, we scale up according to the smallest power of 2 integer size it can fit in. (u16, u32, u64)
 * Returns the number of bytes after the first byte that we will need to preserve after `WriteCompactSize` is done.
 * @param {number} nSize
 */
function GetCompactSizeExtraOffset(nSize) {
  return nSize < 253
    ? 0
    : nSize <= 2 ** 16 - 1
      ? 2
      : nSize <= 2 ** 32 - 1
        ? 4
        : 8;
}

/**
 * Writes `nSize` out to `dv` in a variable-length encoding.
 * Assumes you want to write out the data of `nSize` length to `dv` afterwards.
 * @param {DataView} dv
 * @param {number} offset
 * @param {number} nSize
 */
function WriteCompactSize(
  dv,
  offset,
  nSize,
  s = GetCompactSizeExtraOffset(nSize),
) {
  switch (s) {
    case 2:
    case 4:
    case 8:
      dv.setBigUint64(offset + 1, BigInt(nSize), true);
      nSize = 252 + Math.log2(s);
    default:
      dv.setUint8(offset, nSize);
  }
}

/**
 * @typedef GObjectData
 * @prop {Uint53} end_epoch - whole seconds since epoch (like web-standard `exp`)
 * @prop {String} name - kebab case (no spaces)
 * @prop {String} payment_address - base58-encoded p2pkh
 * @prop {String} payment_amount - in whole DASH
 * @prop {Uint53} start_epoch - whole seconds since epoch (like web-standard `iat`)
 * @prop {Uint32} type - TODO
 * @prop {Uint32} url - conventionally dashcentral, with page the same as the 'name'
 */

/**
 * This serialization is used exclusively for creating a hash to place in the OP_RETURN memo
 * of the collateral transaction.
 *
 * As such, it does NOT match the MN gobject serialization.
 *   - NO collateral tx id (this is for that)
 *   - NO masternodeOutpoint (this is for that)
 *   - NO bls data signature (happens on MN)
 *
 * However, it does include all pieces of data required to verify authenticity from proposer.
 * @typedef GObject
 * @prop {Uint8Array} hashParent - typically null / all 0s (32 bytes)
 * @prop {Uint32} revision - typically 1 or 2, etc (4 bytes)
 * @prop {Uint53} time - seconds since epoch (8 bytes)
 * @prop {String} hexJson - variable
 * @param {GObject} gobj
 * @returns {Uint8Array}
 */
// * @prop {null} [masternodeOutpoint] - ??
// * @prop {null} [collateralTxOutputIndex] - 4 bytes of 0xffs
// * @prop {null} [collateralTxId] - 32 bytes of 0x00s
// * @prop {null} [collateralTxOutputIndex] - 4 bytes of 0xffs
// * @prop {null} [signature] - 0 bytes
GObj.serializeForCollateralTx = function ({
  hexJson,
  hashParent,
  revision,
  time,
}) {
  const compactSizeExtraOffset = GetCompactSizeExtraOffset(hexJson.length);

  const dataLen =
    32 + // hashParent
    4 + // revision
    8 + // time
    1 +
    compactSizeExtraOffset + // compacted length header for HexStr(vchData)
    hexJson.length + // HexStr(vchData)
    32 +
    4 + // masterNodeOutpoint (not used, so these bytes are the defaults)
    1 +
    4 + // dummy values to match old hashing
    1; // compacted length header for `vchSig` in C++ version (always a single `0` byte)

  const bytes = new Uint8Array(dataLen);
  const dv = new DataView(bytes.buffer);

  let offset = 0;

  bytes.set(hashParent, offset);
  offset += 32;
  dv.setInt32(offset, revision, true);
  offset += 4;
  dv.setBigInt64(offset, BigInt(time), true);
  offset += 8;

  // Write out hexJson, with a compacted size in front
  WriteCompactSize(dv, offset, hexJson.length, compactSizeExtraOffset);
  offset += 1 + compactSizeExtraOffset;
  bytes.set(new TextEncoder().encode(hexJson), offset);
  offset += hexJson.length;

  {
    // masternodeOutpoint exists in the C++ object and needs to be included,
    // however, it is not filled with data for our purposes.

    // Write out empty masternodeHash
    offset += 32;

    // Write out default mastNode `n` (index)
    let masternodeOutpointIndex = 0xffffffff;
    dv.setUint32(offset, masternodeOutpointIndex, true);
    offset += 4;

    // adding dummy values here to match old hashing
    offset += 1;
    dv.setUint32(offset, 0xffffffff, true);
    offset += 4;
  }

  // In the C++ version, `vchSig` must have its length written out in `WriteCompactSize` fashion.
  // Then, if the length is greater than 0, `vchSig` is written out too.
  // However, we never need a signature here, so we just write out a `0`.
  offset += 1;
  return bytes;
};

function bytesToHex(bytes) {
  let hexes = [];
  for (let i = 0; i < bytes.length; i += 1) {
    let b = bytes[i];
    let h = b.toString(16);
    h = h.padStart(2, "0");
    hexes.push(h);
  }
  let hex = hexes.join("");
  return hex;
}

function hexToBytes(hex) {
  let len = hex.length / 2;
  let bytes = new Uint8Array(len);
  let j = 0;
  for (let i = 0; i < hex.length; i += 2) {
    let h = hex.substr(i, 2);
    let b = parseInt(h, 16);
    bytes[j] = b;
    j += 1;
  }
  return bytes;
}

/** @typedef {Number} Uint8 */
/** @typedef {Number} Uint32 */
/** @typedef {Number} Uint53 */

async function main() {
  // Taken from
  // 2024-07-18T04:04:22Z gobject_prepare -- params: 0 1 1721275147 7b2273746172745f65706f6368223a313732313237353234372c22656e645f65706f6368223a313732313238353234372c226e616d65223a22746573742d70726f706f73616c2d34222c227061796d656e745f61646472657373223a22794d374d34594a4676353868676561394655784c746a4b42704b5843736a78574e58222c227061796d656e745f616d6f756e74223a3130302c2274797065223a312c2275726c223a2268747470733a2f2f7777772e6461736863656e7472616c2e6f72672f702f746573742d70726f706f73616c2d34227d, data: {"start_epoch":1721275247,"end_epoch":1721285247,"name":"test-proposal-4","payment_address":"yM7M4YJFv58hgea9FUxLtjKBpKXCsjxWNX","payment_amount":100,"type":1,"url":"https://www.dashcentral.org/p/test-proposal-4"}, hash: a9f2d073c2e6c80c340f15580fbfd622e8d74f4c6719708560bb94b259ae7e25
  let gobj = {
    hashParent: new Uint8Array(32),
    revision: 1,
    time: 1721275147,
    hexJson:
      "7b2273746172745f65706f6368223a313732313237353234372c22656e645f65706f6368223a313732313238353234372c226e616d65223a22746573742d70726f706f73616c2d34222c227061796d656e745f61646472657373223a22794d374d34594a4676353868676561394655784c746a4b42704b5843736a78574e58222c227061796d656e745f616d6f756e74223a3130302c2274797065223a312c2275726c223a2268747470733a2f2f7777772e6461736863656e7472616c2e6f72672f702f746573742d70726f706f73616c2d34227d",
  };

  // Note to AJ: that .GetHex() function in the C++ code reversed the bytes!!!!!!
  let knownHash =
    "257eae59b294bb60857019674c4fd7e822d6bf0f58150f340cc8e6c273d0f2a9";

  let gobjCollateralBytes = GObj.serializeForCollateralTx(gobj);

  if (1 === 1) {
    const hex_bytes = bytesToHex(gobjCollateralBytes);

    const data = [
      ["hashParent", 32],
      ["revision", 4],
      ["time", 8],
      ["hexJSONLen-header", 1],
      ["hexJSONLen", GetCompactSizeExtraOffset(gobj.hexJson.length)],
      ["hexJSON", gobj.hexJson.length],
      ["masterNodeOutpointHash", 32],
      ["masterNodeOutpointIndex", 4],
      ["dummyByte", 1],
      ["dummy4Bytes", 4],
      ["vchSigLen", 1],
    ];

    const maxLength = data.reduce((a, c) => Math.max(a, c[0].length), 0);

    let start = 0;
    for (const [name, chunkLen] of data) {
      console.log(
        name.padStart(maxLength, " "),
        "",
        hex_bytes.slice(start, (start += 2 * chunkLen)),
      );
    }
  }

  let hashBytes;
  {
    let hash1 = await crypto.subtle.digest("SHA-256", gobjCollateralBytes);
    let hash2 = await crypto.subtle.digest("SHA-256", hash1);

    let hash1Bytes = new Uint8Array(hash1);
    let hash1Hex = bytesToHex(hash1Bytes);
    console.log(hash1Hex, "(single hash)");

    hashBytes = new Uint8Array(hash2);
    let hashHex = bytesToHex(hashBytes);
    console.log(hashHex, "(double hash)");
    if (hashHex !== knownHash) {
      throw new Error(
        `known hash doesn't match generated hash:\n    ${hashHex}\n    ${knownHash} (expected)`,
      );
    }
  }

  return hashBytes;
}

function logLine64(str, comment, value) {
  for (let i = 0; i < str.length; i += 64) {
    let line = str.substring(i, i + 64);
    if (i === 0) {
      if (typeof value !== "undefined") {
        line = `${line} (${value})`;
      }
      line = line.padEnd(64, " ");
      console.info(line, comment);
    } else {
      console.info(line);
    }
  }
}

main()
  .then(function () {
    console.info("Sweet, Sweet Victory!");
  })
  .catch(function (err) {
    console.error(`Not there yet: ${err.message}`);
    process.exit(1);
  });
