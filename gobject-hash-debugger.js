"use strict";

// Adapted from
//   github.com/dashpay/dash/tree/develop/src/governance/common.cpp

// USAGE
//   node ./gobject-hash-debugger.js

const DV_LE = true;
// const DV_BE = false;

var GObj = module.exports;

GObj._type = 0b0000010; // from SER_GETHASH (bitwise enum)
GObj._typeBytes = Uint8Array.from([0b0000010]);
GObj._protocalVersion = 70231; // 0x00011257 (BE) => 0x57120100 (LE)
GObj._protocalVersionBytes = Uint8Array.from([0x57, 0x12, 0x01, 0x00]);

/**
 * Only the serialize hex (string) form is canonical.
 * Typically the serialization sorts keys in lexicographical order.
 * Example:
 *   {
 *     "end_epoch": 1721285247,
 *     "name": "test-proposal-4",
 *     "payment_address": "yM7M4YJFv58hgea9FUxLtjKBpKXCsjxWNX",
 *     "payment_amount": 100,
 *     "start_epoch": 1721275247,
 *     "type": 1,
 *     "url": "https://www.dashcentral.org/p/test-proposal-4"
 *    }
 * @typedef {GObjectData}
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
 *
 * @typedef GObject
 * @prop {Uint8Array} hashParent - typically null / all 0s (32 bytes)
 * @prop {Uint32} revision - typically 1 or 2, etc (4 bytes)
 * @prop {Uint53} time - seconds since epoch (8 bytes)
 * @prop {String} hexJson - variable
 * @prop {null} [masternodeOutpoint] - ??
 * @prop {null} [collateralTxOutputIndex] - 4 bytes of 0xffs
 * @prop {null} [collateralTxId] - 32 bytes of 0x00s
 * @prop {null} [collateralTxOutputIndex] - 4 bytes of 0xffs
 * @prop {null} [signature] - 0 bytes
 */
GObj.serializeForCollateralTx = function (gobj) {
  let dataLen = 32 + 4 + 8 + gobj.hexJson.length + 36 + 0;

  // ORIGINAL C++ CODE:
  // CHashWriter ss(SER_GETHASH, PROTOCOL_VERSION);
  // ss << hashParent;
  // ss << revision;
  // ss << time;
  // ss << HexStr(vchData);
  // ss << masternodeOutpoint << uint8_t{} << 0xffffffff; // adding dummy values here to match old hashing
  // ss << vchSig;
  // return ss.GetHash();

  let bytes = new Uint8Array(dataLen);
  let dv = new DataView(bytes.buffer);

  // IMPORTANT
  // dv.set and bytes.set SWAP THE ORDER of VALUE and OFFSET !!!
  let offset = 0;

  bytes.set(gobj.hashParent, offset); // TODO swap byte order or no?
  offset += 32; // 32

  dv.setInt32(offset, gobj.revision, DV_LE);
  offset += 4; // 36

  {
    let time = BigInt(gobj.time);
    dv.setBigInt64(36, time, DV_LE);
    offset += 8; // 44
  }

  {
    let encoder = new TextEncoder();
    let hexBytes = encoder.encode(gobj.hexJson);
    bytes.set(hexBytes, offset);
    offset += hexBytes.length; // 44 + n
  }

  // 'bytes' is zero-filled, and there is no masternodeOutpoint yet
  // bytes.set(gobj.masternodeOutpointTxId, offset);
  offset += 32; // 76 + n

  {
    let masternodeOutpointIndex = 0xffffffff;
    dv.setUint32(offset, masternodeOutpointIndex, DV_LE);
    offset += 4; // 80 + n
  }

  // no BLS signature, so no bytes
  // bytes.set(gobj.signature, offset);
  // offset += 32 // 112 + n
  offset += 0; // 80 + n

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
  let knownHash =
    "a9f2d073c2e6c80c340f15580fbfd622e8d74f4c6719708560bb94b259ae7e25";

  let gobjCollateralBytes = GObj.serializeForCollateralTx(gobj);
  {
    let gobjCollateralHex = bytesToHex(gobjCollateralBytes);

    console.log("Parsed Hex:");
    let offset = 0;

    let hashParent = gobjCollateralHex.substr(offset, 2 * 32);
    offset += 2 * 32;
    logLine64(hashParent, "# hashParent (??LE/BE??)");

    let revision = gobjCollateralHex.substr(offset, 2 * 4);
    offset += 2 * 4;
    logLine64(revision, `# revision (LE)`, gobj.revision);

    let time = gobjCollateralHex.substr(offset, 2 * 8);
    offset += 2 * 8;
    logLine64(time, `# time (LE)`, gobj.time);

    let hexJson = gobjCollateralHex.substr(offset, 2 * gobj.hexJson.length);
    offset += 2 * gobj.hexJson.length;
    logLine64(hexJson, `# hexJson (not json utf8 bytes)`);

    let txId = gobjCollateralHex.substr(offset, 2 * 32);
    offset += 2 * 32;
    logLine64(txId, ` # masternodeOutpointId (??LE/BE??)`);

    let txOut = gobjCollateralHex.substr(offset, 2 * 4);
    offset += 2 * 4;
    logLine64(txOut, ` # masternodeOutpointIndex (LE)`);

    let sig = gobjCollateralHex.substr(offset, 2 * 32);
    offset += 2 * 0;
    logLine64(sig, " # signature (0 bytes)");

    console.log("");
    console.log("Full Hex");
    console.log(gobjCollateralHex);
  }

  console.log("");

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
