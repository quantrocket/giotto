(function (factory) {
    var root;
    if (typeof module === "object" && module.exports)
        root = module.exports;
    else
        root = window;
    //
    if (typeof define === 'function' && define.amd) {
        // Support AMD. Register as an anonymous module.
        // NOTE: List all dependencies in AMD style
        define(['d3'], function () {
            return factory(d3, root);
        });
    } else if (typeof module === "object" && module.exports) {
        // No AMD. Set module as a global variable
        // NOTE: Pass dependencies to factory function
        // (assume that d3 is also global.)
        factory(d3, root);
    }
}(
function(d3, root) {
    "use strict";
    var d3ext = {
        version: "0.1.0"
    };
    d3.ext = d3ext;

    //
    //  Class
    //  ============

    //  Implements javascript class inheritance
    //  Check http://ejohn.org/blog/simple-javascript-inheritance/ for details.
    var
    //
    // Test for ``_super`` method in a ``Class``.
    //
    fnTest = /xyz/.test(function(){var xyz;}) ? /\b_super\b/ : /.*/,
    //
    // Create a method for a derived Class
    create_method = function (type, name, attr, _super) {
        if (typeof attr === "function" && typeof _super[name] === "function" &&
                fnTest.test(attr)) {
            return type.new_attr(name, function() {
                var tmp = this._super;
                // Add a new ._super() method that is the same method
                // but on the super-class
                this._super = _super[name];
                // The method only need to be bound temporarily, so we
                // remove it when we're done executing
                var ret = attr.apply(this, arguments);
                this._super = tmp;
                return ret;
            });
        } else {
            return type.new_attr(name, attr);
        }
    },
    //
    //  Type
    //  -------------

    //  A Type is a factory of Classes. This is the correspondent of
    //  python metaclasses.
    Type = d3ext.Type = (function (t) {

        t.new_class = function (Caller, attrs) {
            var type = this,
                meta = Caller === type,
                _super = meta ? Caller : Caller.prototype;
            // Instantiate a base class
            Caller.initialising = true;
            var prototype = new Caller();
            delete Caller.initialising;
            //
            // Copy the properties over onto the new prototype
            for (var name in attrs) {
                if (name !== 'Metaclass') {
                    prototype[name] = create_method.call(Caller,
                            type, name, attrs[name], _super);
                }
            }
            if (!meta) {
                //
                // The dummy class constructor
                var constructor = function () {
                    // All construction is actually done in the init method
                    if ( !this.constructor.initialising && this.init ) {
                        this.init.apply(this, arguments);
                    }
                };
                //
                // Populate our constructed prototype object
                constructor.prototype = prototype;
                // Enforce the constructor to be what we expect
                constructor.prototype.constructor = constructor;
                // And make this class extendable
                constructor.extend = Caller.extend;
                //
                return constructor;
            } else {
                for (name in _super) {
                    if (prototype[name] === undefined) {
                        prototype[name] = _super[name];
                    }
                }
                return prototype;
            }
        };
        //
        t.new_attr = function (name, attr) {
            return attr;
        };
        // Create a new Class that inherits from this class
        t.extend = function (attrs) {
            return t.new_class(this, attrs);
        };
        //
        return t;
    }(function(){})),
    //
    //  Class
    //  -----------

    //  A function representing a base class.
    //  The `extend` method is the most important function of this function-object.
    Class = d3ext.Class = (function (c) {
        c.__class__ = Type;
        //
        c.extend = function (attrs) {
            var type = attrs.Metaclass || this.__class__;
            var cls = type.new_class(this, attrs);
            cls.__class__ = type;
            return cls;
        };
        //
        return c;
    }(function() {}));


    //  Simple extend function
    //
    var extend = d3ext.extend = function () {
        var length = arguments.length,
            object = arguments[0];

        if (!object || length < 2) {
            return object;
        }
        var index = 0,
            obj;

        while (++index < length) {
            obj = arguments[index];
            if (Object(obj) === obj) {
                for (var prop in obj) {
                    if (obj.hasOwnProperty(prop))
                        object[prop] = obj[prop];
                }
            }
        }
        return object;
    };
    function noop () {}

    var log = function (debug) {

        function formatError(arg) {
            if (arg instanceof Error) {
                if (arg.stack) {
                    arg = (arg.message && arg.stack.indexOf(arg.message) === -1
                        ) ? 'Error: ' + arg.message + '\n' + arg.stack : arg.stack;
                } else if (arg.sourceURL) {
                    arg = arg.message + '\n' + arg.sourceURL + ':' + arg.line;
                }
            }
            return arg;
        }

        function consoleLog(type) {
            var console = window.console || {},
                logFn = console[type] || console.log || noop,
                hasApply = false;

              // Note: reading logFn.apply throws an error in IE11 in IE8 document mode.
              // The reason behind this is that console.log has type "object" in IE8...
              try {
                    hasApply = !!logFn.apply;
              } catch (e) {}

              if (hasApply) {
                    return function() {
                        var args = [];
                        for(var i=0; i<arguments.length; ++i)
                            args.push(formatError(arguments[i]));
                        return logFn.apply(console, args);
                    };
            }

            // we are IE which either doesn't have window.console => this is noop and we do nothing,
            // or we are IE where console.log doesn't have apply so we log at least first 2 args
            return function(arg1, arg2) {
                logFn(arg1, arg2 === null ? '' : arg2);
            };
        }

        return {
            log: consoleLog('log'),
            info: consoleLog('info'),
            warn: consoleLog('warn'),
            error: consoleLog('error'),
            debug: (function () {
                var fn = consoleLog('debug');

                return function() {
                    if (debug) {
                        fn.apply(self, arguments);
                    }
                };
            }()),

        };
    };

    function getWidth (element) {
        return getParentRectValue(element, 'width');
    }


    function getHeight (element) {
        return getParentRectValue(element, 'height');
    }

    function getParentRectValue (element, key) {
        var parent = element.node(),
            r, v;
        while (parent && parent.tagName !== 'BODY') {
            v = parent.getBoundingClientRect()[key];
            if (v)
                break;
            parent = parent.parentNode;
        }
        return v;
    }

    function generateResize () {
        var resizeFunctions = [];
        function callResizeFunctions() {
            resizeFunctions.forEach(function (f) {
                f();
            });
        }
        callResizeFunctions.add = function (f) {
            resizeFunctions.push(f);
        };
        return callResizeFunctions;
    }


    d3ext.VizDefaults = {
        // Add resizing on window resize
        resize: false,
        // milliseconds to delay the resizing of a visualization
        resizeDelay: 200,
        // Option callback after initialisation
        onInit: null,
        // Events dispatched by the visualization
        events: ['build', 'change']
    };
    //
    //  Vizualization Class
    //  -------------------------------
    //
    //  Utility for building visualization using d3
    //  The only method to implement is ``d3build``
    //
    //  ``attrs`` is an object containing optional parameters/callbacks for
    //  the visulaization. For all visualizations the following parameters
    //  are supported
    //
    //  * ``processData``: a function to invoke once data has been loaded
    //  * ``width``: The width of the visualization, if not provided it will be evaluated
    //    from the element of its parent
    //  * ``height``: The height of the visualization, if not provided it will be evaluated
    //    from the element of its parent
    var Viz = d3ext.Viz = Class.extend({
        //
        // Initialise the vizualization with a DOM element and
        //  an object of attributes
        init: function (element, attrs) {
            if (!attrs && Object(element) === element) {
                attrs = element;
                element = null;
            }
            if (!element)
                element = document.createElement('div');
            attrs = extend({}, d3ext.VizDefaults, this.defaults, attrs);
            element = d3.select(element);
            this.element = element;
            this.attrs = attrs;
            this.log = log(attrs.debug);
            this.elwidth = null;
            this.elheight = null;
            this.dispatch = d3.dispatch.apply(d3, attrs.events);

            if (!attrs.width) {
                attrs.width = getWidth(element);
                if (attrs.width)
                    this.elwidth = true;
                else
                    attrs.width = 400;
            }
            if (!attrs.height) {
                attrs.height = getHeight(element);
                if (attrs.height)
                    this.elheight = true;
                else
                    attrs.height = 400;
            }
            else if (typeof(attrs.height) === "string" && attrs.height.indexOf('%') === attrs.height.length-1) {
                attrs.height_percentage = 0.01*parseFloat(attrs.height);
                attrs.height = attrs.height_percentage*attrs.width;
            }
            //
            if (attrs.resize) {
                var self = this;
                if (window.onresize === null) {
                    window.onresize = generateResize();
                }
                if (window.onresize.add) {
                    window.onresize.add(function () {
                        self._resize();
                    });
                }
            }
            //
            if (attrs.onInit)
                this._executeCallback(attrs.onInit);
        },
        //
        // Resize the vizualization
        _resize: function () {
            var w = this.elwidth ? getWidth(this.element) : this.attrs.width,
                h;
            if (this.attrs.height_percentage)
                h = w*this.attrs.height_percentage;
            else
                h = this.elheight ? getHeight(this.element) : this.attrs.height;
            if (this.attrs.width !== w || this.attrs.height !== h) {
                this.attrs.width = w;
                this.attrs.height = h;
                if (!this._resizing) {
                    if (this.attrs.resizeDelay) {
                        var self = this;
                        this._resizing = true;
                        setTimeout(function () {
                            self.log.info('Resizing visualization');
                            self.resize();
                            self._resizing = false;
                        }, this.attrs.resizeDelay);
                    } else {
                        this.resize();
                    }
                }
            }
        },
        //
        // Resize the vizualization
        resize: function (size) {
            if (size) {
                this.attrs.width = size[0];
                this.attrs.height = size[1];
            }
            this.build();
        },
        //
        // Return a new d3 svg element insite the element without any children
        svg: function () {
            this.element.html('');
            return this.element.append("svg")
                .attr("width", this.attrs.width)
                .attr("height", this.attrs.height);
        },

        size: function () {
            return [this.attrs.width, this.attrs.height];
        },
        //
        // Normalized Height
        //
        // Try to always work with non dimensional coordinates,
        // Normalised vi the width
        sy: function () {
            var size = this.size();
            return size[1]/size[0];
        },
        //
        // Build the visualisation
        build: function (options) {
            if (options)
                this.attrs = extend(this.attrs, options);
            this.d3build();
            if (this.dispatch.build)
                this.dispatch.build(this);
        },
        //
        // This is the actual method to implement
        d3build: function () {

        },
        //
        // Load data
        loadData: function (callback) {
            var self = this,
                src = this.attrs.src;
            if (src) {
                return d3.json(src, function(error, json) {
                    if (!error) {
                        self.setData(json, callback);
                    }
                });
            }
        },
        //
        // Set new data for the visualization
        setData: function (data, callback) {
            if (this.attrs.processData)
                data = this.attrs.processData(data);
            if (Object(data) === data && data.data)
                this.attrs = extend(this.attrs, data);
            else
                this.attrs.data = data;
            if (callback)
                callback();
        },
        //
        // Shortcut for this.dispatch.on(...) but chainable
        on: function (event, callback) {
            this.dispatch.on(event, callback);
            return this;
        },
        //
        // Execute a callback
        _executeCallback: function (callback) {
            var cbk = callback;
            if (typeof(callback) === 'string') {
                var obj = root,
                    bits= callback.split('.');

                for (var i=0; i<bits.length; ++i) {
                    obj = obj[bits[i]];
                    if (!obj) break;
                }
                cbk = obj;
            }
            if (typeof(cbk) === 'function')
                cbk.call(this);
            else
                this.log.error('Cannot execute callback "' + callback + '". Not a function');
        }
    });

    d3ext.isviz = function (o) {
        return o !== Viz && o.prototype && o.prototype instanceof Viz;
    };



    d3ext.C3 = Viz.extend({
        c3opts: ['data', 'axis', 'grid', 'region', 'legend', 'tooltip',
                 'subchart', 'zoom', 'point', 'line', 'bar', 'pie', 'donut'],
        //
        init: function (element, attrs) {
            // make sure resize is false, let c3 do the resizing
            if (!attrs && Object(element) === element) {
                attrs = element;
                element = null;
            }
            if (attrs)
                attrs.resize = false;
            this._super(element, attrs);
        },
        //
        d3build: function () {
            var self = this,
                opts = this.attrs;
            if (!this.c3) {
                return require(['c3'], function (c3) {
                    self.c3 = c3;
                    self.d3build();
                });
            }
            //
            //
            // Load data if not already available
            if (!opts.data) {
                return this.loadData(function () {
                    self.d3build();
                });
            }
            //
            var config = {
                    bindto: this.element.node(),
                    size: {
                        width: this.elwidth ? null : opts.width,
                        height: this.elheight ? null : opts.height
                    }
                };
            self.c3opts.forEach(function (name) {
                if (opts[name])
                    config[name] = opts[name];
            });
            var chart = this.c3.generate(config);
        }
    });

    //
    //
    // Force layout example
    d3ext.Force = Viz.extend({
        //
        d3build: function () {
            var d2 = this.d3,
                svg = this.svg(),
                attrs = this.attrs,
                nNodes = attrs.nodes || 100,
                minRadius = attrs.minRadius || 4,
                maxRadius = attrs.maxRadius || 16,
                gravity = attrs.gravity || 0.05,
                charge = attrs.charge || -2000,
                dr = maxRadius > minRadius ? maxRadius - minRadius : 0,
                nodes = d3.range(nNodes).map(function() { return {radius: Math.random() * dr + minRadius}; }),
                color = d3.scale.category10();

            var force = d3.layout.force()
                .gravity(gravity)
                .charge(function(d, i) {
                    return i ? 0 : charge;
                })
                .nodes(nodes)
                .size(this.size());

            var root = nodes[0];
            root.radius = 0;
            root.fixed = true;

            force.start();

            svg.selectAll("circle")
                .data(nodes.slice(1))
                .enter().append("svg:circle")
                .attr("r", function(d) { return d.radius - 2; })
                .style("fill", function(d, i) { return color(i % 3); });

            force.on("tick", function(e) {
                var q = d3.geom.quadtree(nodes),
                    i = 0,
                    n = nodes.length;

                while (++i < n) {
                    q.visit(collide(nodes[i]));
                }

                svg.selectAll("circle")
                    .attr("cx", function(d) { return d.x; })
                    .attr("cy", function(d) { return d.y; });
            });

            svg.on("mousemove", function() {
                var p1 = d3.mouse(this);
                root.px = p1[0];
                root.py = p1[1];
                force.resume();
            }).on("touchmove", function() {
                var p1 = d3.touches(this);
                root.px = p1[0];
                root.py = p1[1];
                force.resume();
            });

            function collide (node) {
                var r = node.radius + 16,
                    nx1 = node.x - r,
                    nx2 = node.x + r,
                    ny1 = node.y - r,
                    ny2 = node.y + r;

                return function(quad, x1, y1, x2, y2) {
                    if (quad.point && (quad.point !== node)) {
                        var x = node.x - quad.point.x,
                            y = node.y - quad.point.y,
                            l = Math.sqrt(x * x + y * y),
                            r = node.radius + quad.point.radius;
                        if (l < r) {
                            l = (l - r) / l * 0.5;
                            node.x -= x *= l;
                            node.y -= y *= l;
                            quad.point.x += x;
                            quad.point.y += y;
                        }
                    }
                    return x1 > nx2 || x2 < nx1 || y1 > ny2 || y2 < ny1;
                };
            }
        },
        //
        //  handle node charge

    });
    d3ext.Leaflet = Viz.extend({
        //
        defaults: {
            center: [41.898582, 12.476801],
            zoom: 4,
            maxZoom: 18
        },
        //
        d3build: function () {
            var o = this.attrs,
                e = this.element[0];
            require('leaflet', function () {
                this.map = new L.Map(e, {
                    center: o.center,
                    zoom: o.zoom
                });
                if (o.buildMap)
                    o.buildMap.call(this);
            });
        },
        //
        addLayer: function (url, options) {
            if (this.map)
                L.tileLayer(url, options).addTo(this.map);
        }
    });

    //
    //  Sunburst visualization
    //
    //  In addition to standard Viz parameters:
    //      labels: display labels or not (default false)
    //      padding: padding of sunburst (default 10)
    d3ext.SunBurst = Viz.extend({
        defaults: {
            labels: true,
            padding: 10,
            transition: 750,
            scale: 'sqrt'
        },
        //
        // Calculate the text size to use from dimensions
        textSize: function () {
            var size = this.size(),
                dim = Math.min(size[0], size[1]);
            if (dim < 400)
                return Math.round(100 - 0.15*(500-dim));
            else
                return 100;
        },
        //
        d3build: function () {
            var self = this;
            //
            // Load data if not already available
            if (!this.attrs.data) {
                return this.loadData(function () {
                    self.d3build();
                });
            }
            //
            var size = this.size(),
                attrs = this.attrs,
                root = attrs.data,
                textSize = this.textSize(),
                padding = +attrs.padding,
                transition = +attrs.transition,
                width = size[0]/2,
                height = size[1]/2,
                radius = Math.min(width, height)-padding,
                // Create the partition layout
                partition = d3.layout.partition()
                    .value(function(d) { return d.size; })
                    .sort(function (d) { return d.order === undefined ? d.size : d.order;}),
                svg = this.svg().append('g')
                          .attr("transform", "translate(" + width + "," + height + ")"),
                sunburst = svg.append('g').attr('class', 'sunburst'),
                color = d3.scale.category20c(),
                x = d3.scale.linear().range([0, 2 * Math.PI]),  // angular position
                y = scale(radius),  // radial position
                depth = 0,
                textContainer,
                dummyPath,
                text,
                positions;
            //
            var arc = d3.svg.arc()
                    .startAngle(function(d) { return Math.max(0, Math.min(2 * Math.PI, x(d.x))); })
                    .endAngle(function(d) { return Math.max(0, Math.min(2 * Math.PI, x(d.x + d.dx))); })
                    .innerRadius(function(d) { return Math.max(0, y(d.y)); })
                    .outerRadius(function(d) { return Math.max(0, y(d.y + d.dy)); }),
                path = sunburst.selectAll("path")
                        .data(partition.nodes(root))
                        .enter()
                        .append('path')
                        .attr("d", arc)
                        .style("fill", function(d) { return color((d.children ? d : d.parent).name); });

            if (this.attrs.labels) {
                var data = path.data();
                positions = [];
                textContainer = svg.append('g')
                                .attr('class', 'text')
                                .selectAll('g')
                                .data(data)
                                .enter().append('g');
                dummyPath = textContainer.append('path')
                        .attr("d", arc)
                        .attr("opacity", 0)
                        .on("click", click);
                text = textContainer.append('text')
                        .text(function(d) {
                            if (attrs.addorder !== undefined && d.order !== undefined)
                                return d.order + ' - ' + d.name;
                            else
                                return d.name;
                        });
                alignText(text);
            }

            function scale (radius) {
                if (attrs.scale === 'log')
                    return d3.scale.log().range([1, radius]);
                if (attrs.scale === 'linear')
                    return d3.scale.linear().range([0, radius]);
                else
                    return d3.scale.sqrt().range([0, radius]);
            }

            function click(d) {
                // Fade out all text elements
                if (depth === d.depth) return;
                if (text) text.transition().attr("opacity", 0);
                depth = d.depth;
                //
                function visible (e) {
                    return e.x >= d.x && e.x < (d.x + d.dx);
                }
                //
                path.transition()
                    .duration(transition)
                    .attrTween("d", arcTween(d))
                    .each('end', function (e, i) {
                        if (e.depth === depth && visible(e)) {
                            self.current = e;
                            if (self.dispatch.change)
                                self.dispatch.change(self);
                        }
                    });

                if (text) {
                    positions = [];
                    dummyPath.transition()
                        .duration(transition)
                        .attrTween("d", arcTween(d))
                        .each('end', function (e, i) {
                            // check if the animated element's data lies within the visible angle span given in d
                            if (e.depth >= depth && visible(e)) {
                                // fade in the text element and recalculate positions
                                alignText(d3.select(this.parentNode)
                                            .select("text")
                                            .transition().duration(transition)
                                            .attr("opacity", 1));
                            }
                        });
                }
            }

            function calculateAngle (d) {
                var a = x(d.x + d.dx / 2),
                    changed = true,
                    tole=Math.PI/40;

                function tween (angle) {
                    var da = a - angle;
                    if (da >= 0 && da < tole) {
                        a += tole;
                        changed = true;
                    }
                    else if (da < 0 && da > -tole) {
                        a -= tole - da;
                        changed = true;
                    }
                }

                while (changed) {
                    changed = false;
                    positions.forEach(tween);
                }
                positions.push(a);
                return a;
            }

            // Align text when labels are displaid
            function alignText(text) {
                var a;
                return text.attr("x", function(d, i) {
                    // Set the Radial position
                    if (d.depth === depth)
                        return 0;
                    else {
                        a = calculateAngle(d);
                        this.__data__.angle = a;
                        return a > Math.PI ? -y(d.y) : y(d.y);
                    }
                }).attr("dx", function(d) {
                    // Set the margin
                    return d.depth === depth ? 0 : (d.angle > Math.PI ? -6 : 6);
                }).attr("dy", function(d) {
                    // Set the Radial position
                    if (d.depth === depth)
                        return d.depth ? 40 : 0;
                    else
                        return ".35em";
                }).attr("transform", function(d) {
                    // Set the Angular position
                    a = 0;
                    if (d.depth > depth) {
                        a = d.angle;
                        if (a > Math.PI)
                            a -= Math.PI;
                        a -= Math.PI / 2;
                    }
                    return "rotate(" + (a / Math.PI * 180) + ")";
                }).attr("text-anchor", function (d) {
                    // Make sure text is never oriented downwards
                    a = d.angle;
                    if (d.depth === depth)
                        return "middle";
                    else if (a && a > Math.PI)
                        return "end";
                    else
                        return "start";
                }).style("font-size", function(d) {
                    var g = d.depth - depth,
                        pc = textSize;
                    if (!g) pc *= 1.2;
                    else if (g > 0)
                        pc = Math.max((1.2*pc - 20*g), 30);
                    return Math.round(pc) + '%';
                });
            }

            // Interpolate the scales!
            function arcTween(d) {
                var xd = d3.interpolate(x.domain(), [d.x, d.x + d.dx]),
                    yd = d3.interpolate(y.domain(), [d.y, 1]),
                    yr = d3.interpolate(y.range(), [d.y ? 20 : 0, radius]);
                return function(d, i) {
                    return i ? function(t) { return arc(d); } : function(t) { x.domain(xd(t)); y.domain(yd(t)).range(yr(t)); return arc(d); };
                };
            }
        }
    });


    d3ext.trianglify = Viz.extend({
        //
        defaults: {
            center: [41.898582, 12.476801],
            zoom: 4,
            maxZoom: 18
        },
        //
        d3build: function () {
            if (!this.Trianglify) {
                var self = this;
                require(['trianglify'], function (Trianglify) {
                    self.Trianglify = Trianglify;
                    self.d3build();
                });
                return;
            }
            if (!this._t)
                this._t = new this.Trianglify();
            var pattern = this._t.generate(this.attrs.width, this.attrs.height),
                element = this.element.select('.trianglify-background');
            if (!element.node()) {
                var parentNode = this.element.node(),
                    node = document.createElement('div'),
                    inner = parentNode.childNodes;
                while (inner.length) {
                    node.appendChild(inner[0]);
                }
                node.className = 'trianglify-background';
                parentNode.appendChild(node);
                element = this.element.select('.trianglify-background');
            }
            element.style("height", this.attrs.height+"px")
                   .style("width", this.attrs.width+"px")
                   .style("background-image", pattern.dataUrl);
        }
    });
    return d3;
}));