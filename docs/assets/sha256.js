/* SHA-256 síncrono en JavaScript puro (FIPS 180-4).
 * Se usa en lugar de crypto.subtle porque éste no siempre está disponible
 * en file:// y es asíncrono. Entrada: cadena (UTF-8) o Uint8Array. Salida: hex. */
(function (global) {
  "use strict";
  var K = new Uint32Array([
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2]);

  function bytes(input) {
    return typeof input === "string" ? new TextEncoder().encode(input) : input;
  }

  function digest(input) {
    var msg = bytes(input), len = msg.length;
    var total = ((len + 9 + 63) >> 6) << 6;
    var buf = new Uint8Array(total);
    buf.set(msg);
    buf[len] = 0x80;
    var bits = len * 8, view = new DataView(buf.buffer);
    view.setUint32(total - 4, bits >>> 0);
    view.setUint32(total - 8, Math.floor(bits / 0x100000000));
    var H = new Uint32Array([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
                             0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]);
    var W = new Uint32Array(64);
    for (var off = 0; off < total; off += 64) {
      for (var i = 0; i < 16; i++) W[i] = view.getUint32(off + i * 4);
      for (i = 16; i < 64; i++) {
        var w15 = W[i - 15], w2 = W[i - 2];
        var s0 = ((w15 >>> 7) | (w15 << 25)) ^ ((w15 >>> 18) | (w15 << 14)) ^ (w15 >>> 3);
        var s1 = ((w2 >>> 17) | (w2 << 15)) ^ ((w2 >>> 19) | (w2 << 13)) ^ (w2 >>> 10);
        W[i] = (W[i - 16] + s0 + W[i - 7] + s1) | 0;
      }
      var a = H[0], b = H[1], c = H[2], d = H[3], e = H[4], f = H[5], g = H[6], h = H[7];
      for (i = 0; i < 64; i++) {
        var S1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
        var ch = (e & f) ^ (~e & g);
        var t1 = (h + S1 + ch + K[i] + W[i]) | 0;
        var S0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
        var maj = (a & b) ^ (a & c) ^ (b & c);
        var t2 = (S0 + maj) | 0;
        h = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
      }
      H[0] += a; H[1] += b; H[2] += c; H[3] += d; H[4] += e; H[5] += f; H[6] += g; H[7] += h;
    }
    var out = new Uint8Array(32), ov = new DataView(out.buffer);
    for (i = 0; i < 8; i++) ov.setUint32(i * 4, H[i]);
    return out;
  }

  function hex(u8) {
    var s = "";
    for (var i = 0; i < u8.length; i++) s += (u8[i] < 16 ? "0" : "") + u8[i].toString(16);
    return s;
  }
  function fromHex(h) {
    var out = new Uint8Array(h.length / 2);
    for (var i = 0; i < out.length; i++) out[i] = parseInt(h.substr(i * 2, 2), 16);
    return out;
  }
  function concat(prefix, a, b) {
    var out = new Uint8Array(1 + a.length + (b ? b.length : 0));
    out[0] = prefix; out.set(a, 1); if (b) out.set(b, 1 + a.length);
    return out;
  }

  /* Misma construcción que proyecto/custody.py (RFC 6962). */
  function merkleRoot(hashes) {
    if (!hashes.length) return hex(digest(new Uint8Array(0)));
    var level = hashes.map(function (h) { return digest(concat(0, fromHex(h))); });
    while (level.length > 1) {
      var next = [];
      for (var i = 0; i + 1 < level.length; i += 2) next.push(digest(concat(1, level[i], level[i + 1])));
      if (level.length % 2) next.push(level[level.length - 1]);
      level = next;
    }
    return hex(level[0]);
  }

  /* Equivalente a json.dumps(sort_keys=True, ensure_ascii=False, separators=(",", ":")). */
  function canonicalJSON(v) {
    if (v === null || typeof v !== "object") return JSON.stringify(v);
    if (Array.isArray(v)) return "[" + v.map(canonicalJSON).join(",") + "]";
    return "{" + Object.keys(v).sort().map(function (k) {
      return JSON.stringify(k) + ":" + canonicalJSON(v[k]);
    }).join(",") + "}";
  }

  global.Sha256 = {
    hex: function (input) { return hex(digest(input)); },
    merkleRoot: merkleRoot,
    canonicalJSON: canonicalJSON
  };
})(window);
