/**
 * TypeByAman — Standalone QR Code Generator
 * Pure JavaScript, zero dependencies, offline, standards-compliant (Model 2, Byte Mode).
 * Author: Aman Kumar | github.com/Amankr0075
 */

'use strict';

(function (global) {
  // ─── Galois Field GF(256) Math for Reed-Solomon ─────────────────────────────
  const EXP = new Uint8Array(512);
  const LOG = new Uint8Array(256);
  let val = 1;
  for (let i = 0; i < 255; i++) {
    EXP[i] = val;
    EXP[i + 255] = val;
    LOG[val] = i;
    val = (val << 1) ^ (val >= 128 ? 0x11d : 0);
  }
  function glog(n) { return LOG[n]; }
  function gexp(n) { return EXP[n]; }
  function gmul(x, y) { return (x === 0 || y === 0) ? 0 : EXP[LOG[x] + LOG[y]]; }

  function rsGeneratorPoly(numEc) {
    let poly = [1];
    for (let i = 0; i < numEc; i++) {
      const next = [1, gexp(i)];
      const res = new Array(poly.length + 1).fill(0);
      for (let j = 0; j < poly.length; j++) {
        for (let k = 0; k < next.length; k++) {
          res[j + k] ^= gmul(poly[j], next[k]);
        }
      }
      poly = res;
    }
    return poly;
  }

  function rsEncode(data, numEc) {
    const gen = rsGeneratorPoly(numEc);
    const msg = data.concat(new Array(numEc).fill(0));
    for (let i = 0; i < data.length; i++) {
      const coef = msg[i];
      if (coef !== 0) {
        for (let j = 0; j < gen.length; j++) {
          msg[i + j] ^= gmul(gen[j], coef);
        }
      }
    }
    return msg.slice(data.length);
  }

  // ─── Version Parameters (Level L) ──────────────────────────────────────────
  // [dataBytes, ecBytes, numBlocks]
  const VERSION_SPECS_L = {
    1:  { totalBytes: 26,   dataBytes: 19,  ecBytes: 7,   blocks: 1 },
    2:  { totalBytes: 44,   dataBytes: 34,  ecBytes: 10,  blocks: 1 },
    3:  { totalBytes: 70,   dataBytes: 55,  ecBytes: 15,  blocks: 1 },
    4:  { totalBytes: 100,  dataBytes: 80,  ecBytes: 20,  blocks: 1 },
    5:  { totalBytes: 134,  dataBytes: 108, ecBytes: 26,  blocks: 1 },
    6:  { totalBytes: 172,  dataBytes: 136, ecBytes: 18,  blocks: 2 },
    7:  { totalBytes: 196,  dataBytes: 156, ecBytes: 20,  blocks: 2 },
    8:  { totalBytes: 242,  dataBytes: 194, ecBytes: 24,  blocks: 2 },
    9:  { totalBytes: 292,  dataBytes: 232, ecBytes: 30,  blocks: 2 },
    10: { totalBytes: 346,  dataBytes: 274, ecBytes: 18,  blocks: 4 },
  };

  const ALIGNMENT_PATTERN_POS = {
    2: [6, 18],
    3: [6, 22],
    4: [6, 26],
    5: [6, 30],
    6: [6, 34],
    7: [6, 22, 38],
    8: [6, 24, 42],
    9: [6, 26, 46],
    10: [6, 28, 50],
  };

  function chooseVersion(byteLen) {
    for (let v = 1; v <= 10; v++) {
      const spec = VERSION_SPECS_L[v];
      // Byte mode overhead: 4 bits mode + (v <= 9 ? 8 : 16) bits char count
      const charCountBits = v <= 9 ? 8 : 16;
      const capacity = spec.dataBytes - Math.ceil((4 + charCountBits) / 8);
      if (byteLen <= capacity) return v;
    }
    return 10;
  }

  function encodeData(text, version) {
    const spec = VERSION_SPECS_L[version];
    const utf8 = unescape(encodeURIComponent(text));
    const dataBytes = [];
    for (let i = 0; i < utf8.length; i++) {
      dataBytes.push(utf8.charCodeAt(i));
    }

    const bitBuffer = [];
    function putBits(num, count) {
      for (let i = count - 1; i >= 0; i--) {
        bitBuffer.push((num >>> i) & 1);
      }
    }

    // 1. Mode indicator: Byte mode (0100)
    putBits(0b0100, 4);

    // 2. Character count indicator
    const charCountBits = version <= 9 ? 8 : 16;
    putBits(dataBytes.length, charCountBits);

    // 3. Data bits
    for (const b of dataBytes) {
      putBits(b, 8);
    }

    // 4. Terminator (up to 4 zero bits)
    const maxDataBits = spec.dataBytes * 8;
    const termCount = Math.min(4, maxDataBits - bitBuffer.length);
    putBits(0, termCount);

    // 5. Pad to multiple of 8
    while (bitBuffer.length % 8 !== 0) {
      bitBuffer.push(0);
    }

    // 6. Pad bytes 0xEC and 0x11
    const padBytes = [0xEC, 0x11];
    let padIdx = 0;
    while (bitBuffer.length < maxDataBits) {
      putBits(padBytes[padIdx % 2], 8);
      padIdx++;
    }

    // Convert bitBuffer to byte array
    const rawData = [];
    for (let i = 0; i < bitBuffer.length; i += 8) {
      let b = 0;
      for (let j = 0; j < 8; j++) {
        b = (b << 1) | bitBuffer[i + j];
      }
      rawData.push(b);
    }

    // Error correction
    const numBlocks = spec.blocks;
    const bytesPerBlock = Math.floor(spec.dataBytes / numBlocks);
    const ecPerBlock = spec.ecBytes;

    const dataBlocks = [];
    const ecBlocks = [];

    for (let b = 0; b < numBlocks; b++) {
      const start = b * bytesPerBlock;
      const end = (b === numBlocks - 1) ? spec.dataBytes : start + bytesPerBlock;
      const blockData = rawData.slice(start, end);
      dataBlocks.push(blockData);
      ecBlocks.push(rsEncode(blockData, ecPerBlock));
    }

    // Interleave data blocks and then ec blocks
    const finalStream = [];
    const maxDataLen = Math.max(...dataBlocks.map(b => b.length));
    for (let i = 0; i < maxDataLen; i++) {
      for (let b = 0; b < numBlocks; b++) {
        if (i < dataBlocks[b].length) {
          finalStream.push(dataBlocks[b][i]);
        }
      }
    }
    for (let i = 0; i < ecPerBlock; i++) {
      for (let b = 0; b < numBlocks; b++) {
        finalStream.push(ecBlocks[b][i]);
      }
    }

    return finalStream;
  }

  // ─── Matrix Layout & Masking ────────────────────────────────────────────────
  function createMatrix(version) {
    const size = version * 4 + 17;
    const matrix = Array.from({ length: size }, () => Array(size).fill(null));
    const isReserved = Array.from({ length: size }, () => Array(size).fill(false));

    function setModule(r, c, val, reserved = true) {
      if (r < 0 || r >= size || c < 0 || c >= size) return;
      matrix[r][c] = val ? 1 : 0;
      if (reserved) isReserved[r][c] = true;
    }

    // 1. Finder patterns (7x7) + separators
    function drawFinder(row, col) {
      for (let r = -1; r <= 7; r++) {
        for (let c = -1; c <= 7; c++) {
          const pr = row + r;
          const pc = col + c;
          if (pr < 0 || pr >= size || pc < 0 || pc >= size) continue;
          if (r >= 0 && r <= 6 && c >= 0 && c <= 6) {
            const isBlack = (r === 0 || r === 6 || c === 0 || c === 6 || (r >= 2 && r <= 4 && c >= 2 && c <= 4));
            setModule(pr, pc, isBlack);
          } else {
            setModule(pr, pc, false); // separator
          }
        }
      }
    }

    drawFinder(0, 0);
    drawFinder(0, size - 7);
    drawFinder(size - 7, 0);

    // 2. Timing patterns
    for (let i = 8; i < size - 8; i++) {
      const val = (i % 2 === 0);
      setModule(6, i, val);
      setModule(i, 6, val);
    }

    // 3. Dark module (4*v + 9, 8)
    setModule(size - 8, 8, true);

    // 4. Alignment patterns (versions >= 2)
    const alignCoords = ALIGNMENT_PATTERN_POS[version];
    if (alignCoords) {
      for (const r of alignCoords) {
        for (const c of alignCoords) {
          // Skip if overlapping with finders
          if ((r === 6 && c === 6) || (r === 6 && c === size - 7) || (r === size - 7 && c === 6)) {
            continue;
          }
          for (let dr = -2; dr <= 2; dr++) {
            for (let dc = -2; dc <= 2; dc++) {
              const isBlack = (Math.abs(dr) === 2 || Math.abs(dc) === 2 || (dr === 0 && dc === 0));
              setModule(r + dr, c + dc, isBlack);
            }
          }
        }
      }
    }

    // 5. Reserve format information areas
    for (let i = 0; i < 9; i++) {
      if (i !== 6) { setModule(8, i, 0); setModule(i, 8, 0); }
    }
    for (let i = size - 8; i < size; i++) {
      setModule(8, i, 0);
      setModule(i, 8, 0);
    }

    return { matrix, isReserved, size };
  }

  // Format info for Error Correction L, Mask 0..7
  const FORMAT_INFOS = [
    0b111011111000100, // Mask 0
    0b111001011110011, // Mask 1
    0b111110110101010, // Mask 2
    0b111100010011101, // Mask 3
    0b110011000101111, // Mask 4
    0b110001100011000, // Mask 5
    0b110110001000001, // Mask 6
    0b110100101110110, // Mask 7
  ];

  function writeFormatInfo(matrix, maskIndex) {
    const size = matrix.length;
    const formatBits = FORMAT_INFOS[maskIndex];
    for (let i = 0; i < 15; i++) {
      const bit = ((formatBits >>> i) & 1);
      // Horizontal / top-left + top-right
      if (i <= 5) {
        matrix[8][i] = bit;
      } else if (i === 6) {
        matrix[8][7] = bit;
      } else if (i === 7) {
        matrix[8][8] = bit;
      } else if (i === 8) {
        matrix[7][8] = bit;
      } else {
        matrix[14 - i][8] = bit;
      }

      // Vertical / bottom-left + top-right
      if (i < 8) {
        matrix[size - 1 - i][8] = bit;
      } else {
        matrix[8][size - 15 + i] = bit;
      }
    }
  }

  const MASKS = [
    (r, c) => (r + c) % 2 === 0,
    (r)    => r % 2 === 0,
    (_, c) => c % 3 === 0,
    (r, c) => (r + c) % 3 === 0,
    (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0,
    (r, c) => ((r * c) % 2) + ((r * c) % 3) === 0,
    (r, c) => (((r * c) % 2) + ((r * c) % 3)) % 2 === 0,
    (r, c) => (((r + c) % 2) + ((r * c) % 3)) % 2 === 0,
  ];

  function placeDataAndMask(grid, byteStream, maskIndex) {
    const { matrix, isReserved, size } = grid;
    const maskFn = MASKS[maskIndex];

    const bits = [];
    for (const b of byteStream) {
      for (let i = 7; i >= 0; i--) {
        bits.push((b >>> i) & 1);
      }
    }

    let bitIdx = 0;
    let upward = true;

    for (let right = size - 1; right > 0; right -= 2) {
      if (right === 6) right--; // skip vertical timing column
      const cols = [right, right - 1];

      for (let rowStep = 0; rowStep < size; rowStep++) {
        const row = upward ? size - 1 - rowStep : rowStep;
        for (const col of cols) {
          if (!isReserved[row][col]) {
            let bit = bitIdx < bits.length ? bits[bitIdx++] : 0;
            if (maskFn(row, col)) {
              bit ^= 1; // invert according to mask
            }
            matrix[row][col] = bit;
          }
        }
      }
      upward = !upward;
    }

    writeFormatInfo(matrix, maskIndex);
    return matrix;
  }

  // ─── Public API ─────────────────────────────────────────────────────────────

  function generateMatrix(text) {
    const utf8Len = unescape(encodeURIComponent(text)).length;
    const version = chooseVersion(utf8Len);
    const bytes = encodeData(text, version);
    const grid = createMatrix(version);
    // Mask 0 or 2 provides balanced contrast
    const matrix = placeDataAndMask(grid, bytes, 2);
    return matrix;
  }

  const QRCode = {
    /** Generate standalone crisp SVG string */
    toSVG(text, options = {}) {
      const matrix = generateMatrix(text);
      const size = matrix.length;
      const margin = options.margin !== undefined ? options.margin : 2;
      const totalSize = size + margin * 2;
      const darkColor = options.color || '#000000';
      const lightColor = options.background || '#ffffff';

      let rects = '';
      for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
          if (matrix[r][c] === 1) {
            rects += `<rect x="${c + margin}" y="${r + margin}" width="1" height="1" fill="${darkColor}"/>`;
          }
        }
      }

      return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalSize} ${totalSize}" shape-rendering="crispEdges" width="100%" height="100%">
        <rect width="${totalSize}" height="${totalSize}" fill="${lightColor}"/>
        ${rects}
      </svg>`;
    },

    /** Render to HTML5 canvas element */
    drawCanvas(canvas, text, options = {}) {
      const matrix = generateMatrix(text);
      const size = matrix.length;
      const margin = options.margin !== undefined ? options.margin : 2;
      const totalSize = size + margin * 2;
      const scale = options.scale || Math.floor((options.width || 220) / totalSize) || 4;

      canvas.width = totalSize * scale;
      canvas.height = totalSize * scale;
      const ctx = canvas.getContext('2d');

      ctx.fillStyle = options.background || '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.fillStyle = options.color || '#000000';
      for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
          if (matrix[r][c] === 1) {
            ctx.fillRect((c + margin) * scale, (r + margin) * scale, scale, scale);
          }
        }
      }
    },
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = QRCode;
  } else {
    global.QRCode = QRCode;
  }
})(typeof window !== 'undefined' ? window : globalThis);
