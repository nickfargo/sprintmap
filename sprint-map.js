import { randomInt32, popcnt, nlbw, getPackedIndex } from './functions.js';
import { SprintMapNode } from './sprint-map-node.js';


const assert = (cond, msg) => {
    if (!cond) {
        debugger;
        throw Error(`Assertion failed: ${msg}`);
    }
};

const randomUint30 = () => randomInt32() & 0x3fffffff;


// Storage used to trace pathing of tree traversals during operations that
// mutate the SprintMap.
const __nodeArray__ = [null, null, null, null, null];
const __intArray0__ = [0, 0, 0, 0, 0];
const __intArray1__ = [0, 0, 0, 0, 0];


// Sparse random integer-mapped trie, with branching factor 32, depth [0..5],
// max capacity 2^30. Insertions associate and return unique random integers
// as keys with wide distribution and O(lg(n))/5 performance.
export class SprintMap {
    root = new SprintMapNode;
    size = 0;

    // Returns the value associated with integer `key`, or `alt` if key is
    // absent.
    search (key, alt) {
        let node = this.root;
        let shift = 0;
        let occ, keyFrag, fragBit;
        while (true) {
            occ = node.occ;
            keyFrag = key >>> shift & 31;
            fragBit = 1 << keyFrag;
            if ((node.int & fragBit) === 0) break;
            node = node.v[getPackedIndex(occ, keyFrag)];
            shift += 5;
        }
        return occ & fragBit ? node.v[getPackedIndex(occ, keyFrag)] : alt;
    } 

    // Returns a random 30-bit integer not yet associated as a key in the map.
    keygen () {
        let node = this.root;

        // Guard overflow.
        if (~node.sat === 0) return;

        // Generate a 30-bit key; descend the tree and patch key fragments as
        // necessary to ensure the key corresponds to a logical vacancy.
        let key = randomUint30();
        let shift = 0;
        while (true) {
            let keyFrag = key >>> shift & 31;
            let fragBit = 1 << keyFrag;
            const occ = node.occ;
            const sat = shift < 25 ? node.sat : occ;

            // If keyFrag refers to a saturated slot then change it to refer to
            // an unsaturated slot.
            if ((sat & fragBit) !== 0) {
                // Use rng of old key fragment to randomly choose a new one.
                keyFrag = nlbw(~sat, keyFrag);
                fragBit = 1 << keyFrag;
                // Patch key with the new keyFrag.
                key = key & ~(31 << shift) | (keyFrag << shift);
            }

            // If slot is empty, key is valid. N.b. at max depth the loop will
            // always exit here as saturation tracking will have already either
            // failed the overflow check or guided the loop to a vacant slot.
            if ((occ & fragBit) === 0) return key;
            assert(shift < 25, "shift >= 25");

            const i = getPackedIndex(occ, keyFrag);
            const k = node.k[i];

            // Slot is a resident key-value pair. Ensure the generated key is
            // distinct from the resident key.
            if ((node.kvp & fragBit) !== 0) {
                if (k === key) {
                    shift += 5;
                    const delta = key >>> shift & 31 || 16;
                    key = key & ~(31 << shift) |
                          ((key >>> shift) + delta & 31) << shift;
                    if (k === key) debugger;
                }
                return key;
            }

            // Only remaining possibility is an internal node; descend.
            assert((node.int & fragBit) !== 0, "!int");
            // todo: could use k & 1<<30 as flag to mark collision node
            node = node.v[i];
            shift += 5;
        }
    }

    // Stores a value `val` in the tree and returns a random unique integer key
    // that will reference the stored value.
    insert (val) {
        const key = this.keygen();
        if (key == null) return;
        const path = __nodeArray__;
        const bits = __intArray0__;

        // Descend the tree as directed by key until a vacant slot or resident
        // key-value pair is encountered. Record the nodes visited and sparse
        // indices that led to them, to be used later to track saturation.
        let node = this.root;
        let depth = 0;
        let shift = 0;
        let occ, keyFrag, fragBit;
        while (true) {
            occ = node.occ;
            keyFrag = key >>> shift & 31;
            fragBit = 1 << keyFrag;

            // Vacant slot: insert directly, mark saturations, exit.
            if ((occ & fragBit) === 0) {
                node.a |= fragBit;
                node.b &= ~fragBit;
                const index = getPackedIndex(node.occ, keyFrag);
                node.k.splice(index, 0, key);
                node.v.splice(index, 0, val);

                // At max depth insertion may cause saturation; check and mark
                // pathed nodes in reverse order (ascending) for saturation,
                // until one is found that remains unsaturated.
                if (depth === 5) {
                    ~node.a      === 0 && (path[4].a |= bits[4]) &&
                    ~path[4].sat === 0 && (path[3].a |= bits[3]) &&
                    ~path[3].sat === 0 && (path[2].a |= bits[2]) &&
                    ~path[2].sat === 0 && (path[1].a |= bits[1]) &&
                    ~path[1].sat === 0 && (path[0].a |= bits[0]);
                }

                // if (depth > 0 && node.v.length === 1) {
                //     debugger;
                // }

                this.size += 1;
                return key;
            }

            const index = getPackedIndex(occ, keyFrag);

            // Resident key-value pair: in its place mount a new internal node
            // containing only the resident pair, then continue descending.
            if ((node.kvp & fragBit) !== 0) {
                const k = node.k[index];
                assert(k !== key, "===");
                const v = node.v[index];
                const n = new SprintMapNode;
                n.a = 1 << (k >>> shift + 5 & 31);
                n.k.push(k);
                n.v.push(v);
                node.a &= ~fragBit;
                node.b |= fragBit;
                node.k[index] = key & ~(-1 << shift + 5);
                node.v[index] = n;
            }
            
            // Must be internal node: descend, recur.
            assert((node.int & fragBit) !== 0, "@#$%!");
            path[depth] = node;
            bits[depth] = fragBit;
            node = node.v[index];
            depth += 1;
            shift += 5;
            if (depth > 5) {
                debugger;
            }
        }
    }

    remove (key, alt) {
        const nodes = __nodeArray__;
        const frags = __intArray0__;
        const ibits = __intArray1__;

        // Descend through internal nodes until a vacant or kvp slot is
        // encountered.
        let node = this.root;
        let depth = 0;
        let shift = 0;
        let occ, keyFrag, fragBit, i;
        while (true) {
            occ = node.occ;
            keyFrag = key >>> shift & 31;
            fragBit = 1 << keyFrag;
            if ((node.int & fragBit) === 0 || depth === 5) break;
            nodes[depth] = node;
            frags[depth] = keyFrag;
            i = getPackedIndex(occ, keyFrag);
            ibits[depth] = i;
            node = node.v[i];
            depth += 1;
            shift += 5;
        }

        // Vacant slot: key not found
        if ((occ & fragBit) === 0) return alt;

        // Key-value pair slot: remove the pair and update bitmaps. If removal
        // would leave a node with just one remaining pair, then that node must
        // be displaced in its parent node by the remaining pair.
        let kvp = node.kvp;
        if ((kvp & fragBit) !== 0) {
            i = getPackedIndex(occ, keyFrag);
            const value = node.v[i];

            // To remove the key-value pair, lift the lone *other* pair into
            // the parent node, then eliminate the current node. Ascend to
            // root, collapsing any nodes that would be left holding only the
            // remaining key-value pair.
            if (depth > 0 && node.b === 0 && popcnt(occ & ~fragBit) === 1) {
                let ri = ~i & 1; // i:{0,1} -> {1,0}
                let rk = node.k[ri];
                let rv = node.v[ri];
                do {
                    node.release();
                    depth -= 1;
                    node = nodes[depth];
                } while (depth > 0 && node.v.length === 1);
                i = ibits[depth];
                node.k[i] = rk;
                node.v[i] = rv;
                fragBit = 1 << frags[depth];
                node.a |= fragBit;
                node.b &= ~fragBit;
            }

            // Root node, or any node that will not be left with one key-value
            // pair: no change to tree structure; just remove the pair.
            else {
                node.a &= ~fragBit;
                node.b &= ~fragBit;
                node.k.splice(i, 1);
                node.v.splice(i, 1);
                // while (depth > 0) {
                //     depth -= 1;
                //     nodes[depth].a &= ~(1 << frags[depth]);
                // }
            }

            this.size -= 1;
            return value;
        }
    }

    clear () {
        // Later pooled impl could retain the root node ref elsewhere, then GC
        // asynchronously by recursively `release`ing all nodes and subnodes.
        this.root = new SprintMapNode;
        this.size = 0;
        return this;
    }
}
