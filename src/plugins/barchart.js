    // Bar charts
    g.paper.plugin('bar', {
        width: 'auto',
        color: null,
        fill: true,
        fillOpacity: 1,
        colorOpacity: 1,
        lineWidth: 1,
        // Radius in pixels of rounded corners. Set to 0 for no rounded corners
        radius: 4,
        active: {
            fill: 'darker',
            color: 'brighter'
        },
        transition: extend({}, g.defaults.transition)
    },

    function (group, p) {
        var type = group.type();

        group.barchart = function (data, opts) {
            opts || (opts = {});
            chartFormats(group, opts);
            chartColor(group.paper(), copyMissing(p.bar, opts));

            return group.add(g[type].barchart)
                .size(bar_size)
                .options(opts)
                .dataConstructor(bar_costructor)
                .data(data);
        };
    });


    var bar_costructor = function (rawdata) {
        var group = this.group(),
            draw = this,
            opts = this.options(),
            data = [],
            width = opts.width,
            bar = g[group.type()].bar;
        if (width === 'auto')
            width = function () {
                return d3.round(0.8*(group.innerWidth() / draw.data().length));
            };

        for (var i=0; i<rawdata.length; i++)
            data.push(bar(this, rawdata[i], width));

        return data;
    };


    g.svg.bar = function (draw, data, size) {
        var p = point(draw, data, size),
            group = draw.group();

        p.render = function (element) {
            group.draw(element);
        };
        return p;
    };

    g.svg.barchart = function () {
        var group = this.group(),
            chart = group.element().select("#" + this.uid()),
            opts = this.options(),
            xscale = group.xaxis().scale(),
            scalex = this.scalex(),
            scaley = this.scaley(),
            size = this.size(),
            zero = group.scaley(0),
            data = this.data(),
            trans = opts.transition,
            bar, y;

        if (!chart.node())
            chart = group.element().append("g")
                        .attr('id', this.uid());

        bar = chart.selectAll(".bar").data(data);

        bar.enter()
            .append("rect")
            .attr('class', 'bar');

        bar.exit().remove();

        group.events(group.draw(bar));

        if (!group.resizing() && trans && trans.duration)
            bar = bar.transition().duration(trans.duration).ease(trans.ease);

        bar.attr("y", function(d) {
            return Math.min(zero, scaley(d.data));
        })
        .attr("height", function(d) {
            return abs(scaley(d.data) - zero);
        });

        // Ordinal scale
        if (xscale.rangeBand) {
            bar.attr("x", function(d) {
                return scalex(d.data);
            })
            .attr("width", xscale.rangeBand());

        } else {
            bar.attr("x", function(d) {
                return scalex(d.data) - 0.5*size(d);
            })
            .attr("width", size);
        }

        if (opts.radius > 0)
            bar.attr('rx', opts.radius).attr('ry', opts.radius);

        return chart;
    };

    g.canvas.barchart = function () {
        this.each(function () {
            this.reset().render();
        });
    };

    g.canvas.bar = function (draw, data, siz) {
        var d = canvasMixin(point(draw, data, siz)),
            group = d.group(),
            xscale = group.xaxis().scale(),
            scalex = draw.scalex(),
            scaley = draw.scaley(),
            size = draw.size(),
            factor = draw.factor(),
            ctx = group.context(),
            x, y, y0, y1, w, w0, yb, radius;

        d.render = function (context) {
            context = context || ctx;
            context.fillStyle = d3.canvas.rgba(d.fill, d.fillOpacity);
            context.strokeStyle = d3.canvas.rgba(d.color, d.colorOpacity);
            context.lineWidth = factor*d.lineWidth;
            _draw(context);
            context.fill();
            context.stroke();
            return d;
        };

        d.inRange = function (ex, ey) {
            _draw(ctx);
            return ctx.isPointInPath(ex, ey);
        };

        d.bbox = function () {
            var x = scalex(d.data) + group.marginLeft(),
                y1 = scaley(d.data) + group.marginTop(),
                y0 = group.scaley(0)  + group.marginTop(),
                yn = Math.min(y1, y0),
                ys = y1 + y0 - yn,
                w0 = 0,
                w;
            if (xscale.rangeBand)
                w = xscale.rangeBand();
            else
                w0 = w = 0.5*size(d);

            return canvasBBox(d, [x-w0, yn], [x+w, yn], [x+w, ys], [x-w0, ys]);
        };

        return d;

        function _draw (context) {
            radius = factor*draw.options().radius;
            context.beginPath();
            x = scalex(d.data);
            w0 = 0;
            if (xscale.invert)
                w0 = w = 0.5*size(d);
            else
                w = xscale.rangeBand();
            y = scaley(d.data);
            y0 = group.scaley(0);
            d3.canvas.drawPolygon(context, [[x-w0, y0], [x+w, y0], [x+w, y], [x-w0, y]], radius);
            context.closePath();
        }
    };