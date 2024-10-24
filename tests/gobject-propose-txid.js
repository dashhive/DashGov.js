"use strict";

import GObj from "dashgov";

// function hexToBytes(hex) {
//   let len = hex.length / 2;
//   let bytes = new Uint8Array(len);
//   let j = 0;
//   for (let i = 0; i < hex.length; i += 2) {
//     let h = hex.substr(i, 2);
//     let b = parseInt(h, 16);
//     bytes[j] = b;
//     j += 1;
//   }
//   return bytes;
// }

async function main() {
  // Taken from
  // 2024-07-18T04:04:22Z gobject_prepare -- params: 0 1 1721275147 7b2273746172745f65706f6368223a313732313237353234372c22656e645f65706f6368223a313732313238353234372c226e616d65223a22746573742d70726f706f73616c2d34222c227061796d656e745f61646472657373223a22794d374d34594a4676353868676561394655784c746a4b42704b5843736a78574e58222c227061796d656e745f616d6f756e74223a3130302c2274797065223a312c2275726c223a2268747470733a2f2f7777772e6461736863656e7472616c2e6f72672f702f746573742d70726f706f73616c2d34227d, data: {"start_epoch":1721275247,"end_epoch":1721285247,"name":"test-proposal-4","payment_address":"yM7M4YJFv58hgea9FUxLtjKBpKXCsjxWNX","payment_amount":100,"type":1,"url":"https://www.dashcentral.org/p/test-proposal-4"}, hash: a9f2d073c2e6c80c340f15580fbfd622e8d74f4c6719708560bb94b259ae7e25
  let gobj = {
    hashParent: new Uint8Array(32),
    revision: 1,
    time: 1721275147,
    dataHex:
      "7b2273746172745f65706f6368223a313732313237353234372c22656e645f65706f6368223a313732313238353234372c226e616d65223a22746573742d70726f706f73616c2d34222c227061796d656e745f61646472657373223a22794d374d34594a4676353868676561394655784c746a4b42704b5843736a78574e58222c227061796d656e745f616d6f756e74223a3130302c2274797065223a312c2275726c223a2268747470733a2f2f7777772e6461736863656e7472616c2e6f72672f702f746573742d70726f706f73616c2d34227d",
  };

  // Note to AJ: that .GetHex() function in the C++ code reversed the bytes!!!!!!
  let knownHash =
    "257eae59b294bb60857019674c4fd7e822d6bf0f58150f340cc8e6c273d0f2a9";

  let gobjCollateralBytes = GObj.serializeForCollateralTx(gobj);

  if (1 === 1) {
    const hex_bytes = GObj.utils.bytesToHex(gobjCollateralBytes);

    const data = [
      ["hashParent", 32],
      ["revision", 4],
      ["time", 8],
      ["hexJSONLen-header", 1],
      ["hexJSONLen", GObj.utils.toVarIntSize(gobj.dataHex.length)],
      ["hexJSON", gobj.dataHex.length],
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
    let hash1Hex = GObj.utils.bytesToHex(hash1Bytes);
    console.log(hash1Hex, "(single hash)");

    hashBytes = new Uint8Array(hash2);
    let hashHex = GObj.utils.bytesToHex(hashBytes);
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
