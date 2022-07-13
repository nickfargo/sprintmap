import { SprintMap } from './sprint-map.js';


const lzpad = (x,n) => ('00000000' + x).slice(-n);
const overflow = n => n < 0 ? 0x80000000 + (n & 0x7fffffff) : n;
const hex = (x,n=8) => lzpad(overflow(x).toString(16), n);
const b32 = (x,n=7) => lzpad(overflow(x).toString(32), n);
const b32hex = (x,n1=7,n2=8) => `${b32(x,n1)}|${hex(x,n2)}`;
const b32hexdec = (x,n1=1,n2=2,n3=2) => `${b32hex(x,n1,n2)}|${lzpad(x,n3)}`;


SprintMap.prototype.print = (() => {
    const indent = (n = 0, ws = '  ') => {
        let out = '', i = 0;
        while (i++ < n) out += ws;
        return out;
    };
    const prnode = (node, ind = 0) => {
        let out = `Node ${b32hex(node.a)} ${b32hex(node.b)}\n`;
        ind += 1;
        let slotIndex = 0;
        while (slotIndex < 32) {
            const i = getPackedIndex(node.occ, slotIndex);
            if (i !== -1) {
                out += `${indent(ind)}${b32hex(slotIndex,1,2)}: `;
                const k = node.k[i];
                const v = node.v[i];
                if ((node.int & 1 << slotIndex) !== 0) {
                    out += prnode(v, ind + 1);
                } else if ((node.kvp & 1 << slotIndex) !== 0) {
                    out += prterm(k,v);
                }
            }
            slotIndex += 1;
        }
        return out;
    };
    const prterm = (k, v) => `Term ${b32hex(k,6)}\n`;

    return function (b32path = '') {
        let node = this.root;
        for (let i = b32path.length; i--;) {
            let sparseIndex = parseInt(b32path[i], 32);
            let packedIndex = getPackedIndex(node.occ, sparseIndex);
            node = node.v[packedIndex];
        }
        return prnode(node);
    };
})();

SprintMap.prototype.checkIntegrity = (() => {
    const checkNode = (out, node, shift = 0, addr = 0) => {
        if (shift > 0 && node.v.length < 2) {
            const key = node.k[0];
            const value = node.v[0];
            if (!(value instanceof SprintMapNode)) {
                out.push({
                    "": "Bad node",
                    node,
                    shift,
                    key,
                    // value,
                });
            }
        }
        const mask = ~(-1 << 5 + shift);
        for (let slotIndex = 0; slotIndex < 32; slotIndex++) {
            const index = getPackedIndex(node.occ, slotIndex);
            if (index === -1) continue;
            const key = node.k[index];
            const value = node.v[index];
            const slotAddr = slotIndex << shift | addr;
            if (value instanceof SprintMapNode) {
                checkNode(out, value, shift + 5, slotAddr);
            } else if (mask & (slotAddr ^ key)) {
                out.push({
                    "": "Bad term",
                    depth: shift / 5,
                    slotIndex: b32hexdec(slotIndex,1,2,2),
                    slotAddr: b32hex(slotAddr, 6),
                    key: b32hex(key, 6),
                    // value,
                });
            }
        }
        return out;
    };
    return function () {
        return checkNode([], this.root);
    };
})();
