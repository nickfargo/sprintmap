// Integer absolute value. Some platforms (FF!) do not appear to optimize away
// type/bounds checks of `Math.abs`, which severely hurts perf (100-1000x!).
export const abs = x => {
    const y = x >> 31;
    return (x ^ y) - y;
};

// Population count
export const popcnt = x => {
    x -= (x >> 1) & 0x55555555;
    x = (x & 0x33333333) + ((x >> 2) & 0x33333333);
    return ((x + (x >> 4) & 0x0f0f0f0f) * 0x01010101) >> 24;
};

// Trailing zero count
export const tzcnt = (() => {
    const deBruijnSeqMod37 = [
        32, 0, 1, 26, 2, 23, 27, 0, 3, 16, 24, 30, 28, 11, 0, 13,
        4, 7, 17, 0, 25, 22, 31, 15, 29, 10, 12, 6, 0, 21, 14, 9,
        5, 20, 8, 19, 18
    ];
    // With two's-complement, the bottom signed int32 -0x80000000 is the unique
    // case for which `(x & -x) < 0`. In JS `%` is a *remainder* (not *modulo*)
    // operator, which outputs the sign of its *dividend* (not its *divisor*).
    // Given these two facts, use `abs` to correct the sign of the array index.
    return x => deBruijnSeqMod37[abs((x & -x) % 37)];
})();

// Logarithmic-time alternative to `tzcnt`; ostensibly less performant, but may
// vary depending on perf of platform's `%` operator.
const tzcnt_lg = x => {
    var c = 32;
    x &= -(x|0);
    if (x) c--;
    if (x & 0x0000ffff) c -= 16;
    if (x & 0x00ff00ff) c -= 8;
    if (x & 0x0f0f0f0f) c -= 4;
    if (x & 0x33333333) c -= 2;
    if (x & 0x55555555) c -= 1;
    return c;
}

// Right fill. All bits lower than the highest 1-bit are set to 1. Non-negative
// ints round up to one less than the next power of 2; negative ints return -1.
export const rfill = x => {
    x |= x >> 1;
    x |= x >> 2;
    x |= x >> 4;
    x |= x >> 8;
    x |= x >> 16;
    return x;
};

// High bit. Returns the position [0..31] of the highest 1-bit. Positive ints
// return log base 2; zero returns -1; negative ints return 31.
export const highbit = x => tzcnt(~rfill(x)) - 1;

// High bit value. Non-negative ints round up to the next power of 2; negative
// ints return the bottom int -0x80000000.
export const highbitval = x => {
    x = rfill(x);
    return x & ~(x >>> 1);
};

// Right shift, wrapping: bits truncated off the right wrap in from the left.
// Branching alternative: `(x, n) => n ? x >>> n | x << -n : x;`
export const rsw = (x, n) => x >>> n | x << (32 - n & 31);

// Position of next left 1-bit, wrapping, counting from position n.
// E.g.: (17 = 0b10001, 2) -> 4; (18, 0) -> 1; (12 = 0b1100, 4) -> 2
export const nlbw = (x, n) => x ? (tzcnt(rsw(x, n)) + n) & 31 : -1;

// Decodes a logical sparse index to the actual packed index it represents.
export const getPackedIndex = (bitmap, sparseIndex) => {
    const b = 1 << sparseIndex;
    return (bitmap & b) === 0 ? -1 : popcnt(bitmap & ~(-1 << sparseIndex));
};



// RNG
export const randomInt32 = (() => {
    return () => (Math.random() * 0x100000000)|0;
    // if (typeof crypto === undefined) {
    //     return () => (Math.random() * 0x100000000)|0;
    // } else {
    //     const i32a = new Int32Array(256);
    //     let i = 0;
    //     return () => {
    //         if (i === 0) crypto.getRandomValues(i32a);
    //         const val = i32a[i];
    //         i = i + 1 & 255;
    //         return val;
    //     };
    // }
})();
