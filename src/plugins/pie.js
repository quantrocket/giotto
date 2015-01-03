
    // Add pie charts to giotto groups

    g.paper.plugin('pie', {
        lineWidth: 1,
        // pad angle in degrees
        padAngle: 0,
        cornerRadius: 0,
        fillOpacity: 0.7,
        colorOpacity: 1,
        innerRadius: 0,
        startAngle: 0,
        formatX: d3_identity,
        active: {
            fill: 'darker',
            color: 'brighter',
            //innerRadius: 100%,
            //outerRadius: 105%,
            fillOpacity: 1
        },
        transition: extend({}, g.defaults.transition),
        tooltip: {
            template: function (d) {
                return "<p><strong style='color:"+d.c+"'>" + d.x + "</strong> " + d.y + "</p>";
            }
        }
    },

    function (group, p) {
        var type = group.type(),
            pieslice = g[type].pieslice,
            arc = d3[type].arc()
                            .innerRadius(function (d) {return d.innerRadius;})
                            .outerRadius(function (d) {return d.outerRadius;});

        // add a pie chart drawing to the group
        group.pie = function (data, opts) {
            opts || (opts = {});
            chartFormats(group, opts);
            copyMissing(p.pie, opts);

            var draw = group.add(function () {

                var width = group.innerWidth(),
                    height = group.innerHeight(),
                    opts = this.options(),
                    outerRadius = 0.5*Math.min(width, height),
                    innerRadius = opts.innerRadius*outerRadius,
                    cornerRadius = group.scale(group.dim(opts.cornerRadius)),
                    value = this.y(),
                    data = this.data(),
                    pie = d3.layout.pie().value(function (d) {return value(d.data);})
                                         .padAngle(d3_radians*opts.padAngle)
                                         .startAngle(d3_radians*opts.startAngle)(data),
                    d, dd;

                this.arc = arc.cornerRadius(cornerRadius);

                // recalculate pie angles
                for (var i=0; i<pie.length; ++i) {
                    d = pie[i];
                    dd = d.data;
                    dd.set('innerRadius', innerRadius);
                    dd.set('outerRadius', outerRadius);
                    delete d.data;
                    data[i] = extend(dd, d);
                }

                return g[type].pie(this, width, height);
            });

            return draw.options(opts)
                        .data(data.map(function (d) {return pieslice(draw, d);}));
        };
    });

    function pieSlice (draw, data) {
        // Default values
        var d = {},
            dd = isArray(data) ? d : data;
        dd.fill = dd.fill || draw.paper().pickColor();
        dd.color = dd.color || d3.rgb(dd.fill).darker().toString();
        return paperData(draw, data, pieOptions, d);
    }

    g.svg.pie = function (draw, width, height) {

        var group = draw.group(),
            container = group.element(),
            pp = container.select('#' + draw.uid());

        if (!pp.size())
            pp = container.append("g")
                        .attr('id', draw.uid())
                        .classed('pie', true);

        pp.attr("transform", "translate(" + width/2 + "," + height/2 + ")")
            .selectAll(".slice").remove();

        return group.events(
                group.draw(pp
                            .selectAll(".slice")
                            .data(draw.data())
                            .enter()
                            .append("path")
                            .attr('class', 'slice')
                            .attr('d', draw.arc)));
    };

    g.svg.pieslice = function (draw, data) {
        var group = draw.group(),
            p = pieSlice(draw, data);
        p.render = function (element) {
            group.draw(element).attr('d', draw.arc);
        };
        return p;
    };

    g.canvas.pie = function (draw) {
        draw.each(function () {
            this.reset().render();
        });
    };

    g.canvas.pieslice = function (draw, data) {
        var d = canvasMixin(pieSlice(draw, data)),
            group = draw.group(),
            factor = draw.factor(),
            ctx = group.context();

        d.render = function (context) {
            context = context || ctx;
            context.save();
            context.translate(0.5*group.innerWidth(), 0.5*group.innerHeight());
            context.fillStyle = rgba(d.fill, d.fillOpacity);
            context.strokeStyle = rgba(d.color, d.colorOpacity);
            context.lineWidth = factor*d.lineWidth;
            draw.arc.context(context)(d);
            context.fill();
            context.stroke();
            context.restore();
            return d;
        };

        d.context = function (context) {
            ctx = context;
            return d;
        };

        d.inRange = function (ex, ey) {
            ctx.save();
            ctx.translate(0.5*group.innerWidth(), 0.5*group.innerHeight());
            draw.arc.context(ctx)(d);
            var res = ctx.isPointInPath(ex, ey);
            ctx.restore();
            return res;
        };

        return d;
    };

