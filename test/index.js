import { expect } from 'chai';
import SprintMap from '../index.js';
import '../sprint-map-diag.js';


describe("SprintMap", () => {
    it("exists", () => {
        expect(SprintMap).to.exist;
    });

    describe("Populating with 1M entries", () => {
        const N = 1 << 20;
        const sm = new SprintMap;
        const keys = [];
        const errs = [];

        it("inserts 1M entries", () => {
            for (let i = 0; i < N; i++) {
                keys.push(sm.insert(i));
            }
            expect(sm.size).to.equal(N);
            expect(keys).to.have.length(N);
        });

        it("finds each entry", () => {
            for (let i = 0; i < N; i++) {
                sm.search(keys[i]) === i || errs.push(['search', i, keys[i]]);
            }
            expect(errs).to.be.empty;
        });

        it("removes all entries", () => {
            for (let i = 0; i < N; i++) {
                const ERR = {};
                sm.remove(keys[i], ERR) !== ERR || errs.push(['remove', i, keys[i]]);
            }
            expect(errs).to.be.empty;
            expect(sm.size).to.equal(0);
        });
    });
});
