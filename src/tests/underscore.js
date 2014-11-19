    //
    describe("Test underscore utilities", function() {
        var _ = d3.giotto._;

        it("Check pick", function() {
            var picked = _.pick({a: 1, b: null, c: 'ciao'}, function (value, key) {
                if (key !== 'c')
                    return value;
            });

            expect(picked.a).toBe(1);
            expect(picked.b).toBe(null);
            expect(picked.c).toBe(undefined);
        });
    });