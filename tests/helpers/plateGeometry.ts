/**
 * Plate masters are local-only (`.gitignore` keeps `public/art/*.png` out of the repo — the app ships the
 * webp layer), so a test that opens the PNG would pass here and fail in a fresh clone. These helpers read
 * the geometry straight out of the SHIPPED webp instead, which is what the loader in StreamStage actually
 * gets, plus the PNG header when the master happens to be on disk.
 */

export type PlateDims = { width: number; height: number; codec: string; alpha: boolean };

/** RIFF/WEBP container: VP8 (lossy), VP8L (lossless) and VP8X (extended) all carry the canvas size. */
export function readWebpDims(buf: Buffer): PlateDims | null {
  if (buf.length < 12 || buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WEBP') {
    return null;
  }
  let at = 12;
  while (at + 8 <= buf.length) {
    const fourcc = buf.toString('ascii', at, at + 4);
    const size = buf.readUInt32LE(at + 4);
    const body = at + 8;
    if (fourcc === 'VP8X' && size >= 10) {
      return {
        width: 1 + (buf[body + 4]! | (buf[body + 5]! << 8) | (buf[body + 6]! << 16)),
        height: 1 + (buf[body + 7]! | (buf[body + 8]! << 8) | (buf[body + 9]! << 16)),
        codec: 'VP8X',
        // The ALPH flag is what lets the heroine float over the room background with no matte box.
        alpha: (buf[body]! & 0x10) === 0x10,
      };
    }
    if (fourcc === 'VP8L' && size >= 5) {
      const bits = buf.readUInt32LE(body + 1);
      return {
        width: (bits & 0x3fff) + 1,
        height: ((bits >> 14) & 0x3fff) + 1,
        codec: 'VP8L',
        alpha: ((bits >> 28) & 1) === 1,
      };
    }
    if (fourcc === 'VP8 ' && size >= 12) {
      // 3-byte frame tag, then the 0x9d 0x01 0x2a start code, then 14-bit width/height pairs.
      const start = body + 3;
      if (buf[start] === 0x9d && buf[start + 1] === 0x01 && buf[start + 2] === 0x2a) {
        return {
          width: buf.readUInt16LE(start + 3) & 0x3fff,
          height: buf.readUInt16LE(start + 5) & 0x3fff,
          codec: 'VP8',
          alpha: false,
        };
      }
    }
    at += 8 + size + (size % 2);
  }
  return null;
}

/** PNG IHDR — width/height at fixed offsets, colour type at byte 25 (6 = RGBA, what the keyer must write). */
export function readPngDims(buf: Buffer): (PlateDims & { colorType: number }) | null {
  if (buf.length < 26 || buf.readUInt32BE(0) !== 0x89504e47) return null;
  const colorType = buf[25]!;
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20), colorType, codec: 'PNG', alpha: colorType === 6 };
}
