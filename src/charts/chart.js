
    x.Chart = x.Viz.extend({
        serieDefaults: {
            lines: {show: true},
            points: {show: true}
        },

        defaults: {

        },

        svg: function () {
            var w = this.attrs.width,
                h = this.attrs.height;
            this.element.html('');
            return this.element.append("svg")
                .attr("width", w)
                .attr("height", h)
                .attr("viewBox", "0 0 " + w + " " + h);
        },

        build: function () {
            var self = this,
                opts = this.attrs,
                data = opts.data || [];

            // Loop through data and build the graph
            data.forEach(function (serie) {
                if (isFunction (serie)) {
                    serie = serie(self);
                }
                self.addSerie(serie);
            });
        },

        addSerie: function (serie) {
            // The serie is
            if (!serie) return;

            if (isArray(serie)) {
                serie = {data: serie};
            }
            if (!serie.data) return;
            this.log.info('Add new serie to chart');

            copyMissing(this.serieDefaults, serie);

            if (serie.lines.show)
                this.paper().drawLine(serie.data, serie.lines);

        }
    });