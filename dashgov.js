/** @typedef {any} Gov - TODO */

/**
 * @typedef Snapshot
 * @prop {Uint53} block - the block to be used for calculation
 * @prop {Uint53} ms - the time of that block in ms
 */

/**
 * @typedef Estimate
 * @prop {Uint53} secondsPerBlock
 * @prop {Uint53} voteHeight
 * @prop {Uint53} voteDelta
 * @prop {String} voteIso - date in ISO format
 * @prop {Uint53} voteMs
 * @prop {Uint53} voteDeltaMs
 * @prop {Uint53} superblockHeight
 * @prop {Uint53} superblockDelta
 * @prop {String} superblockIso - date in ISO format
 * @prop {Uint53} superblockMs
 * @prop {Uint53} superblockDeltaMs
 */

/**
 * @typedef Estimates
 * @prop {Estimate} last - the most recent superblock
 * @prop {Estimate?} lameduck - the current voting period, if close to deadline
 * @prop {Array<Estimate>} upcoming - future voting periods
 */

/** @type {Gov} */
//@ts-ignore
var DashGov = ("object" === typeof module && exports) || {};
(function (window, GObj) {
  "use strict";

  // Adapted from
  //   github.com/dashpay/dash/tree/develop/src/governance/common.cpp

  // USAGE
  //   node ./gobject-hash-debugger.js

  GObj._type = 0b0000010; // from SER_GETHASH (bitwise enum)
  GObj._typeBytes = Uint8Array.from([0b0000010]);
  GObj._protocalVersion = 70231; // 0x00011257 (BE) => 0x57120100 (LE)
  GObj._protocalVersionBytes = Uint8Array.from([0x57, 0x12, 0x01, 0x00]);

  GObj.utils = {};

  /**
   * @param {Uint8Array} bytes
   * @returns {String} hex
   */
  GObj.utils.bytesToHex = function bytesToHex(bytes) {
    let hexes = [];
    for (let i = 0; i < bytes.length; i += 1) {
      let b = bytes[i];
      let h = b.toString(16);
      h = h.padStart(2, "0");
      hexes.push(h);
    }
    let hex = hexes.join("");
    return hex;
  };

  /**
   * Returns the number of extra bytes needed to encode the variable-length `nSize`.
   * If it is less than 253, we will store `nSize` in just the one (assumed) byte.
   * Otherwise, we scale up according to the smallest power of 2 integer size it can fit in. (u16, u32, u64)
   * Returns the number of bytes after the first byte that we will need to preserve after `WriteCompactSize` is done.
   * @param {number} nSize
   */
  GObj.utils.toVarIntSize = function (nSize) {
    return nSize < 253
      ? 0
      : nSize <= 2 ** 16 - 1
        ? 2
        : nSize <= 2 ** 32 - 1
          ? 4
          : 8;
  };

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
    s = GObj.utils.toVarIntSize(nSize),
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
   * @prop {null} [hashParent] - not implemented, Uint8Array of 0s (32 bytes)
   * @prop {1} [revision] - not implemented, always 1 (4 bytes)
   * @prop {BigInt|Uint53} time - seconds since epoch (8 bytes)
   * @prop {String} hexJson - variable
   * @prop {null} [masternodeOutpoint] - ??
   * @prop {null} [collateralTxOutputIndex] - 4 bytes of 0xffs
   * @prop {null} [collateralTxId] - 32 bytes of 0x00s
   * @prop {null} [collateralTxOutputIndex] - 4 bytes of 0xffs
   * @prop {null} [signature] - 0 bytes
   * @returns {Uint8Array}
   */

  /**
   * @param {GObject} gobj
   */
  GObj.serializeForCollateralTx = function ({
    hashParent,
    revision = 1,
    time,
    hexJson,
  }) {
    const compactSizeExtraOffset = GObj.utils.toVarIntSize(hexJson.length);

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
      1; // (varint) size of `vchSig` (always 1 byte to represent 0)

    const bytes = new Uint8Array(dataLen);
    const dv = new DataView(bytes.buffer);

    let offset = 0;

    if (hashParent) {
      bytes.set(hashParent, offset);
    }
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

  // TODO move to a nice place
  const SUPERBLOCK_INTERVAL = 16616;
  const VOTE_LEAD_BLOCKS = 1662;
  const PROPOSAL_LEAD_MS = 6 * 24 * 60 * 60 * 1000;
  DashGov.PROPOSAL_LEAD_MS = PROPOSAL_LEAD_MS;
  DashGov.SUPERBLOCK_INTERVAL = SUPERBLOCK_INTERVAL;

  // not used because the actual average at any time is always closer to 157.5
  //const SECONDS_PER_BLOCK_ESTIMATE = 155;
  DashGov._AVG_SECS_PER_BLOCK = 157.5816652623977;

  // used to calculate ~5 year (~60 month) averages
  const MONTHLY_SUPERBLOCK_01_DATE = "2017-03-05T20:16:05Z";
  const MONTHLY_SUPERBLOCK_01 = 631408;
  const MONTHLY_SUPERBLOCK_61_DATE = "2022-02-26T03:53:02Z";
  const MONTHLY_SUPERBLOCK_61 = 1628368;

  /**
   * @param {Snapshot} snapshot
   * @returns {Float64} - fractional seconds
   */
  GObj.measureSecondsPerBlock = function (snapshot) {
    let blockDelta = snapshot.block - MONTHLY_SUPERBLOCK_01;
    let timeDelta = snapshot.ms - Date.parse(MONTHLY_SUPERBLOCK_01_DATE);
    let msPerBlock = timeDelta / blockDelta;
    let sPerBlock = msPerBlock / 1000;

    return sPerBlock;
  };

  /**
   * @param {Snapshot} [snapshot] - defaults to monthly superblock 61
   */
  GObj.estimateSecondsPerBlock = function (snapshot) {
    if (!snapshot) {
      snapshot = {
        block: MONTHLY_SUPERBLOCK_61,
        ms: Date.parse(MONTHLY_SUPERBLOCK_61_DATE),
      };
    }

    let spb = GObj.measureSecondsPerBlock(snapshot);
    return spb;
  };

  /**
   * @param {Uint53} ms - the current time
   * @param {Float64} secondsPerBlock
   */
  GObj.estimateBlockHeight = function (ms, secondsPerBlock) {
    let then = Date.parse(MONTHLY_SUPERBLOCK_61_DATE);
    let delta = ms - then;
    let deltaS = delta / 1000;
    let blocks = deltaS / secondsPerBlock;
    blocks = Math.round(blocks);

    let height = MONTHLY_SUPERBLOCK_61 + blocks;
    return height;
  };

  /**
   * Note: since we're dealing with estimates that are typically reliable
   *       within an hour (and often even within 15 minutes), this may
   *       generate more results than it presents.
   * @param {Uint8} [cycles] - 3 by default
   * @param {Snapshot?} [snapshot]
   * @param {Uint32} [proposalLeadtime] - default 3 days in ms
   * @param {Float64} [secondsPerBlock] - typically close to 157.6
   * @returns {Estimates} - the last, due, and upcoming proposal cycles
   */
  GObj.estimateProposalCycles = function (
    cycles = 3,
    snapshot = null,
    secondsPerBlock = 0,
    proposalLeadtime = PROPOSAL_LEAD_MS,
  ) {
    let now = snapshot?.ms || Date.now();
    let currentBlock = snapshot?.block;
    if (!secondsPerBlock) {
      if (currentBlock) {
        snapshot = { block: currentBlock, ms: now };
      }
      secondsPerBlock = GObj.measureSecondsPerBlock(snapshot);
    }
    if (!currentBlock) {
      currentBlock = GObj.estimateBlockHeight(now, secondsPerBlock);
    }

    /** @type {Array<Estimate>} */
    let estimates = [];
    for (let i = 0; i <= cycles + 1; i += 1) {
      let estimate = GObj.estimateNthNextGovCycle(
        { block: currentBlock, ms: now },
        secondsPerBlock,
        i,
      );
      estimates.push(estimate);
    }

    {
      /** @type {Estimate} */
      //@ts-ignore - we know there is at least one (past) estimate
      let last = estimates.shift();

      /** @type {Estimate?} */
      let lameduck = null;
      if (estimates.length) {
        if (estimates[0].voteDeltaMs < proposalLeadtime) {
          //@ts-ignore - we just checked the length
          lameduck = estimates.shift();
        } else {
          // lose the extra cycle
          void estimates.pop();
        }
      }
      let upcoming = estimates;

      return {
        last,
        lameduck,
        upcoming,
      };
    }
  };

  /**
   * @param {Snapshot} snapshot
   * @param {Float64} secondsPerBlock
   * @param {Uint53} offset - how many superblocks in the future
   * @returns {Estimate} - details about the current governance cycle
   */
  GObj.estimateNthNextGovCycle = function (
    snapshot,
    secondsPerBlock,
    offset = 0,
  ) {
    if (!secondsPerBlock) {
      secondsPerBlock = GObj.estimateSecondsPerBlock(snapshot);
    }

    let superblockHeight = GObj.getNthNextSuperblock(snapshot.block, offset);

    let superblockDelta = superblockHeight - snapshot.block;
    let superblockDeltaMs = superblockDelta * secondsPerBlock * 1000;
    let voteDeltaMs = VOTE_LEAD_BLOCKS * secondsPerBlock * 1000;

    let d = new Date(snapshot.ms);
    d.setUTCMilliseconds(0);

    d.setUTCMilliseconds(superblockDeltaMs);
    let sbms = d.valueOf();
    let sbts = d.toISOString();

    d.setUTCMilliseconds(-voteDeltaMs);
    let vtms = d.valueOf();
    let vtts = d.toISOString();

    return {
      // TODO split into objects
      voteHeight: superblockHeight - VOTE_LEAD_BLOCKS,
      voteIso: vtts,
      voteMs: vtms,
      voteDelta: superblockDelta - VOTE_LEAD_BLOCKS,
      voteDeltaMs: superblockDeltaMs - voteDeltaMs,
      superblockHeight: superblockHeight,
      superblockDelta: superblockDelta,
      superblockIso: sbts,
      superblockMs: sbms,
      superblockDeltaMs: superblockDeltaMs,
    };
  };

  /**
   * @param {Uint53} height
   * @param {Uint53} offset - 0 (current / previous), 1 (next), 2, 3, nth
   * @returns {Uint53} - the superblock after the given height
   */
  GObj.getNthNextSuperblock = function (height, offset) {
    let superblockCount = height / SUPERBLOCK_INTERVAL;
    superblockCount = Math.floor(superblockCount);

    superblockCount += offset;
    let superblockHeight = superblockCount * SUPERBLOCK_INTERVAL;

    return superblockHeight;
  };

  //@ts-ignore
  window.DashGov = GObj;
})(globalThis.window || {}, DashGov);
if ("object" === typeof module) {
  module.exports = DashGov;
}

/** @typedef {Number} Uint8 */
/** @typedef {Number} Uint32 */
/** @typedef {Number} Uint53 */
/** @typedef {Number} Float64 */
