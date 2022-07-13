// Internal node struct defines 32 logical slots, indicated bitwise by integer
// fields, with packed arrays containing key-value data and/or subnodes.
export class SprintMapNode {
    a = 0;
    b = 0;
    k = [];
    v = [];

    // Occupancy: marks non-empty slots.
    get occ () { return this.a | this.b; }

    // Terminal: marks slots that contain key-value pairs.
    get kvp () { return this.a & ~this.b; }

    // Internal: marks slots that contain an internal node. The associated key
    // may encode additional information pertaining to the internal node.
    // TODO: explain
    get int () { return ~this.a & this.b; }

    // Saturation: marks slots that are completely filled. At max depth this
    // is equivalent to occupancy; above max depth this marks internal nodes
    // whose slots are themselves saturated. Saturation tracking accelerates
    // keygen and insertion operations.
    get sat () { return this.a & this.b; }

    // Later pooled impl will reinit (zero, clear) and repool the struct. For
    // now just no-op and let the node get gc'd.
    release () {}
}
