//      Giotto - v0.1.0

//      Compiled 2014-11-20.
//      Copyright (c) 2014 - Luca Sbardella
//      Licensed BSD.
//      For all details and documentation:
//      http://quantmind.github.io/giotto/
//
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
}(function(d3, root) {
    "use strict";
    var giotto = {
            version: "0.1.0",
            d3: d3,
            math: {}
        },
        g = giotto;

    d3.giotto = giotto;
    d3.canvas = {};

    // Warps RequireJs call so it can be used in conjunction with
    //  require-config.js
    //
    //  http://quantmind.github.io/require-config-js/
    g.require = function (deps, callback) {
        if (root.rcfg && root.rcfg.min)
            deps = root.rcfg.min(deps);
        require(deps, callback);
        return g;
    };

    //
    //  Create an angular module for visualizations
    //
    g.angular = {
        module: function (angular, moduleName, deps) {
            moduleName = moduleName || 'giotto';
            deps = deps || [];

            return angular.module(moduleName, deps)

                    .directive('jstats', function () {
                        return {
                            link: function (scope, element, attrs) {
                                var mode = attrs.mode ? +attrs.mode : 1;
                                require(rcfg.min(['stats']), function () {
                                    var stats = new Stats();
                                    stats.setMode(mode);
                                    scope.stats = stats;
                                    element.append(angular.element(stats.domElement));
                                });
                            }
                        };
                    });
        },

        directive: function (angular, name, VizClass, moduleName, injects) {
            moduleName = moduleName || 'giotto';
            injects = injects || [];
            var dname = 'viz' + name.substring(0,1).toUpperCase() + name.substring(1);

            injects.push(function () {
                var injected = arguments;
                return {
                    //
                    // Create via element tag or attribute
                    restrict: 'AE',
                    //
                    link: function (scope, element, attrs) {
                        var viz = element.data(dname);
                        if (!viz) {
                            var options = getOptions(attrs),
                                autoBuild = options.autoBuild;
                            options.autoBuild = false;
                            // add scope to the options
                            options.scope = scope;
                            viz = new VizClass(element[0], options);
                            element.data(viz);
                            scope.$emit('giotto-viz', viz);
                            // Add a callback for injects
                            if (autoBuild === undefined || autoBuild)
                                viz.build();
                        }
                    }
                };
            });

            angular.module(moduleName).directive(dname, injects);
        },
        //
        //  Load all visualizations into angular 'giotto' module
        addAll: function (angular, moduleName, deps, injects) {
            g.angular.module(angular, moduleName, deps);
            //
            // Loop through d3 extensions and create directives
            // for each Visualization class
            angular.forEach(g, function (VizClass, name) {
                if (g.isviz(VizClass)) {
                    g.angular.directive(angular, name, VizClass, moduleName, injects);
                }
            });
        }
    };

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
    Type = g.Type = (function (t) {

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
    Class = g.Class = (function (c) {
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

    g.log = log(root.debug);


    g.xyfunction = function (X, funy) {
        var xy = [];
        if (isArray(X))
            X.forEach(function (x) {
                xy.push([x, funy(x)]);
            });
        return xy;
    };


    var
    //
    ostring = Object.prototype.toString,
    //
    // Underscore-like object
    _ = g._ = {},
    //  Simple extend function
    //
    extend = g.extend = function () {
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
    },
    //  copyMissing
    //  =================
    //
    //  Copy values to toObj from fromObj which are missing (undefined) in toObj
    copyMissing = function (fromObj, toObj) {
        if (fromObj && toObj) {
            for (var prop in fromObj) {
                if (fromObj.hasOwnProperty(prop) && toObj[prop] === undefined)
                    toObj[prop] = fromObj[prop];
            }
        }
        return toObj;
    },
    //
    //
    // Obtain extra information from javascript objects
    getOptions = function (attrs) {
        if (attrs && typeof attrs.options === 'string') {
            var obj = root,
                bits= attrs.options.split('.');

            for (var i=0; i<bits.length; ++i) {
                obj = obj[bits[i]];
                if (!obj) break;
            }
            if (typeof obj === 'function')
                obj = obj(g, attrs);
            attrs = extend(attrs, obj);
        }
        return attrs;
    },
    //
    //
    keys = _.keys = function (obj) {
        var keys = [];
        for (var key in obj) {
            if (obj.hasOwnProperty(key))
                keys.push(key);
        }
        return keys;
    },
    //
    pick = _.pick = function (obj, callback) {
        var picked = {},
            val;
        for (var key in obj) {
            if (obj.hasOwnProperty(key)) {
                val = callback(obj[key], key);
                if (val !== undefined)
                    picked[key] = val;
            }
        }
        return picked;
    },
    //
    isObject = _.isObject = function (value) {
        return ostring.call(value) === '[object Object]';
    },
    //
    isFunction = _.isFunction = function (value) {
        return ostring.call(value) === '[object Function]';
    },
    //
    isArray = _.isFunction = function (value) {
        return ostring.call(value) === '[object Array]';
    },

    encodeObject = _.encodeObject = function (obj, contentType) {
        var p;
        if (contentType === 'multipart/form-data') {
            var fd = new FormData();
            for(p in obj)
                if (obj.hasOwnProperty(p))
                    fd.append(p, obj[p]);
            return fd;
        } else if (contentType === 'application/json') {
            return JSON.stringify(obj);
        } else {
            var str = [];
            for(p in obj)
                if (obj.hasOwnProperty(p))
                    str.push(encodeURIComponent(p) + "=" + encodeURIComponent(obj[p]));
            return str.join("&");
        }
    };


    function getWidth (element) {
        return getParentRectValue(element, 'width');
    }

    function getHeight (element) {
        return getParentRectValue(element, 'height');
    }

    function getWidthElement (element) {
        return getParentElementRect(element, 'width');
    }

    function getHeightElement (element) {
        return getParentElementRect(element, 'height');
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

    function getParentElementRect (element, key) {
        var parent = element.node(),
            r, v;
        while (parent && parent.tagName !== 'BODY') {
            v = parent.getBoundingClientRect()[key];
            if (v)
                return d3.select(parent);
            parent = parent.parentNode;
        }
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


    g.defaults = {};

    g.defaults.paper = {
        type: 'svg',
        resizeDelay: 200,
        yaxis: 1,
        resize: false,
        margin: {top: 20, right: 20, bottom: 20, left: 20},
    };

    g.defaults.viz = extend({
        //
        // Option callback after initialisation
        onInit: null,
        //
        autoBuild: true,
        // Default events dispatched by the visualization
        events: ['build', 'change', 'start', 'tick', 'end'],
        //
        // Default parameters when drawing lines
        lines: {
            interpolate: 'basis'
        }
    });

    g.constants = {
        DEFAULT_VIZ_GROUP: 'default_viz_group',
        WIDTH: 400,
        HEIGHT: 300
    };
    //
    // Create a new paper for drawing stuff
    g.paper = function (element, p) {

        var paper = {};

        if (isObject(element)) {
            p = element;
            element = null;
        }
        if (!element)
            element = document.createElement('div');

        element = d3.select(element);

        p = _newPaperAttr(element, p);

        paper.destroy = function () {
            element.selectAll('*').remove();
        };

        paper.type = function () {
            return p.type;
        };

        paper.size = function () {
            return [p.size[0], p.size[1]];
        };

        paper.width = function () {
            return p.size[0];
        };

        paper.height = function () {
            return p.size[1];
        };

        paper.aspectRatio = function () {
            return p.size[1]/p.size[0];
        };

        paper.element = function () {
            return element;
        };

        paper.yaxis = function (x) {
            if (!arguments.length) return p.yaxis;
            if (x === 1 || x === 2)
                p.yaxis = x;
            return paper;
        };

        paper.xAxis = function (x) {
            if (!arguments.length) return p.xAxis;
            p.xAxis = x;
            return paper;
        };

        paper.yAxis = function (x) {
            if (!arguments.length) return p.yAxis[p.yaxis-1];
            p.yAxis[p.yaxis-1] = x;
            return paper;
        };

        paper.scale = function (r) {
            var s = p.xAxis.scale();
            return s(r) - s(0);
        };

        paper.scalex = function (x) {
            return p.xAxis.scale()(x);
        };

        paper.scaley = function (y) {
            return paper.yAxis().scale()(y);
        };

        // Resize the paper and fire the resize event if resizing was performed
        paper.resize = function (size) {
            p._resizing = true;
            if (!size) {
                size = paper.boundingBox();
            }
            if (p.size[0] !== size[0] || p.size[1] !== size[1]) {
                g.log.info('Resizing paper');
                p.size = size;
                paper.refresh();
            }
            p._resizing = false;
        };

        paper.boundingBox = function () {
            var w = p.elwidth ? getWidth(p.elwidth) : p.size[0],
                h;
            if (p.height_percentage)
                h = w*p.height_percentage;
            else
                h = p.elheight ? getHeight(p.elheight) : p.size[1];
            return [w, h];
        };

        // Auto resize the paper
        if (p.resize) {
            //
            d3.select(window).on('resize', function () {
                if (!p._resizing) {
                    if (p.resizeDelay) {
                        p._resizing = true;
                        d3.timer(function () {
                            paper.resize();
                            return true;
                        }, p.resizeDelay);
                    } else {
                        paper.resize();
                    }
                }
            });
        }

        return _initPaper(paper, p);
    };


    g.paper.types = {};


    function xyData (data) {
        if (!isArray(data)) return;
        if (isArray(data[0]) && data[0].length === 2) {
            var xydata = [];
            data.forEach(function (xy) {
                xydata.push({x: xy[0], y: xy[1]});
            });
            return xydata;
        }
        return data;
    }

    //
    //  SVG Paper
    //  ================
    //
    g.paper.types.svg = function (paper, p) {
        var svg = paper.element().append('svg')
                        .attr('width', p.size[0])
                        .attr('height', p.size[1])
                        .attr("viewBox", "0 0 " + p.size[0] + " " + p.size[1]),
            current = svg;

        p.xAxis = d3.svg.axis(),
        p.yAxis = [d3.svg.axis(), d3.svg.axis()];

        paper.refresh = function () {
            svg.attr('width', p.size[0])
               .attr('height', p.size[1]);
            p.event.refresh({type: 'refresh', size: p.size.slice(0)});
            return paper;
        };

        paper.clear = function () {
            current = svg;
            svg.selectAll('*').remove();
            return paper;
        };

        // return the current svg element
        paper.current = function () {
            return current;
        };

        // set the current element to be the root svg element and returns the paper
        paper.root = function () {
            current = svg;
            return paper;
        };

        // set the current element to be the parent and returns the paper
        paper.parent = function () {
            if (current !== svg) {
                var parent = current.node().parentNode;
                if (parent === svg.node())
                    return svg;
                else
                    return d3.select(parent);
            }
            return paper;
        };

        paper.group = function () {
            current = current.append('g');
            return current;
        };

        paper.circle = function (cx, cy, r) {
            cx = paper.scalex(cx);
            cy = paper.scaley(cy);
            r = paper.scale(r);
            return current.append('circle')
                            .attr('cx', cx)
                            .attr('cy', cy)
                            .attr('r', r);
        };

        paper.rect = function (x, y, width, height, r) {
            var X = paper.scalex(x),
                Y = paper.scaley(y);
            width = paper.scalex(x+width) - X;
            height = paper.scalex(y+height) - Y;
            var rect = current.append('rect')
                                .attr('x', X)
                                .attr('y', Y)
                                .attr('width', width)
                                .attr('height', height);
            if (r) {
                var rx = paper.scalex(r) - paper.scalex(0),
                    ry = paper.scaley(r) - paper.scaley(0);
                rect.attr('rx', rx).attr('ry', rt);
            }
            return rect;
        };

        paper.path = function (opts) {
            if (isArray(opts)) opts = {data: opts};
            if (!(opts && opts.data)) return;

            copyMissing(this.options.lines, opts);

            var line = d3.svg.line()
                        .interpolate(opts.interpolate)
                        .x(function(d) {
                            return d.x;
                        })
                        .y(function(d) {
                            return d.y;
                        }),
                data = xyData(opts.data);

            return current.append('path')
                            .datum(data)
                            .attr('d', line);
        };

        paper.encode = function () {
            return btoa(unescape(encodeURIComponent(
                svg.attr("version", "1.1")
                    .attr("xmlns", "http://www.w3.org/2000/svg")
                    .node().parentNode.innerHTML)));
        };

        paper.downloadSVG = function (e) {
            var data = "data:image/svg+xml;charset=utf-8;base64," + paper.encode();
            d3.select(e.target).attr("href", data);
        };

        paper.downloadPNG = function (e) {
            if (!g.cloudConvertApiKey)
                return;

            var params = {
                apikey: g.cloudConvertApiKey,
                inputformat: 'svg',
                outputformat: 'png'
            };

            var blob = new Blob(['base64,',paper.encode()], {type : 'image/svg+xml;charset=utf-8'});

            d3.xhr('https://api.cloudconvert.org/process?' + encodeObject(params))
                .header('content-type', 'multipart/form-data')
                .post(submit);

            function submit(_, request) {
                if (!request || request.status !== 200)
                    return;
                var data = JSON.parse(request.responseText);
                d3.xhr(data.url)
                    .post(encodeObject({
                        input: 'upload',
                        file: blob
                    }, 'multipart/form-data'), function (r, request) {
                        if (!request || request.status !== 200)
                            return;
                        data = JSON.parse(request.responseText);
                        wait_for_data(data);
                    });
            }

            function wait_for_data (data) {
                d3.xhr(data.url, function (r, request) {
                    if (!request || request.status !== 200)
                        return;
                    data = JSON.parse(request.responseText);
                    if (data.step === 'finished')
                        download(data.output);
                    else if (data.step === 'error')
                        error(data);
                    else
                        wait_for_data(data);
                });
            }

            function error (data) {

            }

            function download(data) {
                d3.select(e.target).attr("href", data.url + '?inline');
            }
        };
    };


    g.vizRegistry = (function () {
        var _vizMap = {};

        function initializeVizGroup(group) {
            if (!group) {
                group = g.constants.DEFAULT_VIZ_GROUP;
            }

            if (!_vizMap[group]) {
                _vizMap[group] = [];
            }

            return group;
        }

        return {
            has: function (viz) {
                for (var e in _vizMap) {
                    if (_vizMap[e].indexOf(viz) >= 0) {
                        return true;
                    }
                }
                return false;
            },

            register: function (viz, group) {
                group = initializeVizGroup(group);
                _vizMap[group].push(viz);
            },

            deregister: function (viz, group) {
                group = initializeVizGroup(group);
                for (var i = 0; i < _vizMap[group].length; i++) {
                    if (_vizMap[group][i].anchorName() === viz.anchorName()) {
                        _vizMap[group].splice(i, 1);
                        break;
                    }
                }
            },

            clear: function (group) {
                if (group) {
                    delete _vizMap[group];
                } else {
                    _vizMap = {};
                }
            },

            list: function (group) {
                group = initializeVisGroup(group);
                return _vizMap[group];
            }
        };
    }());

    g.registerViz = function (viz, group) {
        g.vizRegistry.register(viz, group);
    };

    g.deregisterViz = function (viz, group) {
        g.vizRegistry.deregister(viz, group);
    };

    g.hasViz = function (viz) {
        return g.vizRegistry.has(viz);
    };

    var _idCounter = 0;
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
    var Viz = g.Viz = Class.extend({
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
            attrs = extend({}, g.defaults.viz, g.defaults.paper, this.defaults, attrs);
            element = d3.select(element);
            this.element = element;
            this.log = log(attrs.debug);
            this.uid = ++_idCounter;
            this.dispatch = d3.dispatch.apply(d3, attrs.events);
            this.g = g;
            this.attrs = this.getAttributes(attrs);
            //
            if (attrs.onInit)
                this._executeCallback(attrs.onInit);
            if (attrs.autoBuild)
                this.build();
        },
        //
        // Resize the vizualization
        resize: function (size) {
            if (this._paper)
                this._paper.resize(size);
        },
        //
        //  Retrieve the paper when the visualization is displayed
        //  Create a new one if not available
        paper: function (createNew) {
            if (createNew || this._paper === undefined) {
                var self = this;

                if (this._paper)
                    this._paper.destroy();

                this._paper = g.paper(this.element.node(), this.attrs);
                this._paper.on('refresh', function () {
                    self._refresh();
                });
            }
            return this._paper;
        },
        //
        // Build the visualisation
        build: function (options) {
            if (options)
                this.attrs = extend(this.attrs, options);
            this.d3build();
            this.dispatch.build(this);
        },
        //
        // Same as build
        redraw: function (options) {
            this.build(options);
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
        getAttributes: function (attrs) {
            return attrs;
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
        // Fire an event if it exists
        fire: function (event) {
            if (this.dispatch[event])
                this.dispatch[event].call(this);
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
        },
        //
        // Use this method to do something when a refresh event occurs
        _refresh: function () {
            if (this.paper().type() === 'canvas')
                this.build();
        }
    });

    g.isviz = function (o) {
        return o !== Viz && o.prototype && o.prototype instanceof Viz;
    };


    //
    g.viz = {};
    //
    // Factory of Giotto visualizations
    g.createviz = function (name, defaults, constructor) {

        var vizType = function (element, opts) {

            if (isObject(element)) {
                opts = element;
                element = null;
            }
            opts = extend({}, g.defaults.viz, g.defaults.paper, defaults, opts);

            var viz = {},
                uid = ++_idCounter,
                event = d3.dispatch.apply(d3, opts.events),
                alpha = 0,
                paper;

            viz.uid = function () {
                return uid;
            };

            // Return the visualization type (a function)
            viz.vizType = function () {
                return vizType;
            };

            viz.vizName = function () {
                return vizType.vizName();
            };

            viz.paper = function (createNew) {
                if (createNew || paper === undefined) {
                    if (paper)
                        paper.destroy();

                    paper = g.paper(element, opts);
                    paper.on('refresh', function () {
                        viz.refresh();
                    });
                }
                return paper;
            };

            viz.element = function () {
                return viz.paper().element();
            };

            viz.alpha = function(x) {
                if (!arguments.length) return alpha;

                x = +x;
                if (alpha) { // if we're already running
                    if (x > 0) alpha = x; // we might keep it hot
                    else alpha = 0; // or, next tick will dispatch "end"
                } else if (x > 0) { // otherwise, fire it up!
                    event.start({type: "start", alpha: alpha = x});
                    d3.timer(viz.tick);
                }

                return viz;
            };

            viz.resume = function() {
                return viz.alpha(0.1);
            };

            viz.stop = function() {
                return viz.alpha(0);
            };

            viz.tick = function() {
                // simulated annealing, basically
                if ((alpha *= 0.99) < 0.005) {
                    event.end({type: "end", alpha: alpha = 0});
                    return true;
                }

                event.tick({type: "tick", alpha: alpha});
            };

            // This could be re-implemented by the constructor
            viz.start = function () {
                return viz.resume();
            };

            viz.refresh = function () {
                if (paper && paper.type() === 'canvas')
                    this.start();
                return viz;
            };

            d3.rebind(viz, event, 'on');

            if (constructor)
                constructor(viz, opts);

            return viz;
        };

        g.viz[name] = vizType;

        vizType.vizName = function () {
            return name;
        };

        return vizType;
    };

    //
    //  Initaise paper
    function _initPaper (paper, p) {
        g.paper.types[p.type](paper, p);

        paper.xAxis().scale().range([0, p.size[0]]);
        paper.yaxis(2).yAxis().scale().range([0, p.size[1]]);
        paper.yaxis(1).yAxis().scale().range([0, p.size[1]]);
        //
        return d3.rebind(paper, p.event, 'on');
    }


    function _newPaperAttr (element, cfg) {
        var width, height;

        if (cfg) {
            width = cfg.width;
            height = cfg.height;
            cfg = pick(cfg, function (value, key) {
                if (g.defaults.paper[key] !== undefined)
                    return value;
            });
        }
        else
            cfg = {};

        var p = extend({}, g.defaults.paper, cfg);

        if (!width) {
            width = getWidth(element);
            if (width)
                p.elwidth = getWidthElement(element);
            else
                width = g.constants.WIDTH;
        }

        if (!height) {
            height = getHeight(element);
            if (height)
                p.elheight = getHeightElement(element);
            else
                height = g.constants.HEIGHT;
        }
        else if (typeof(height) === "string" && height.indexOf('%') === height.length-1) {
            p.height_percentage = 0.01*parseFloat(height);
            height = p.height_percentage*width;
        }

        p.size = [width, height];
        p.event = d3.dispatch('refresh');
        return p;
    }

    d3.canvas.axis = function() {
        var scale = d3.scale.linear(),
            orient = d3_canvas_axisDefaultOrient,
            innerTickSize = 6,
            outerTickSize = 6,
            tickPadding = 3,
            tickArguments_ = [10],
            tickValues = null,
            tickFormat_;

        function axis (g) {
            g.each(function() {
            var g = d3.select(this);

            // Stash a snapshot of the new scale, and retrieve the old snapshot.
            var scale0 = this.__chart__ || scale,
                scale1 = this.__chart__ = scale.copy();

            // Ticks, or domain values for ordinal scales.
            var ticks = tickValues === null ? (scale1.ticks ? scale1.ticks.apply(scale1, tickArguments_) : scale1.domain()) : tickValues,
                tickFormat = tickFormat_ === null ? (scale1.tickFormat ? scale1.tickFormat.apply(scale1, tickArguments_) : d3_identity) : tickFormat_,
                tick = g.selectAll(".tick").data(ticks, scale1),
                tickEnter = tick.enter().insert("g", ".domain").attr("class", "tick").style("opacity", ε),
                tickExit = d3.transition(tick.exit()).style("opacity", ε).remove(),
                tickUpdate = d3.transition(tick.order()).style("opacity", 1),
                tickSpacing = Math.max(innerTickSize, 0) + tickPadding,
                tickTransform;

            // Domain.
            var range = d3_scaleRange(scale1),
                path = g.selectAll(".domain").data([0]),
                pathUpdate = (path.enter().append("path").attr("class", "domain"), d3.transition(path));

            tickEnter.append("line");
            tickEnter.append("text");

            var lineEnter = tickEnter.select("line"),
                lineUpdate = tickUpdate.select("line"),
                text = tick.select("text").text(tickFormat),
                textEnter = tickEnter.select("text"),
                textUpdate = tickUpdate.select("text"),
                sign = orient === "top" || orient === "left" ? -1 : 1,
                x1, x2, y1, y2;

            if (orient === "bottom" || orient === "top") {
              tickTransform = d3_canvas_axisX, x1 = "x", y1 = "y", x2 = "x2", y2 = "y2";
              text.attr("dy", sign < 0 ? "0em" : ".71em").style("text-anchor", "middle");
              pathUpdate.attr("d", "M" + range[0] + "," + sign * outerTickSize + "V0H" + range[1] + "V" + sign * outerTickSize);
            } else {
              tickTransform = d3_canvas_axisY, x1 = "y", y1 = "x", x2 = "y2", y2 = "x2";
              text.attr("dy", ".32em").style("text-anchor", sign < 0 ? "end" : "start");
              pathUpdate.attr("d", "M" + sign * outerTickSize + "," + range[0] + "H0V" + range[1] + "H" + sign * outerTickSize);
            }

            lineEnter.attr(y2, sign * innerTickSize);
            textEnter.attr(y1, sign * tickSpacing);
            lineUpdate.attr(x2, 0).attr(y2, sign * innerTickSize);
            textUpdate.attr(x1, 0).attr(y1, sign * tickSpacing);

            // If either the new or old scale is ordinal,
            // entering ticks are undefined in the old scale,
            // and so can fade-in in the new scale’s position.
            // Exiting ticks are likewise undefined in the new scale,
            // and so can fade-out in the old scale’s position.
            if (scale1.rangeBand) {
              var x = scale1, dx = x.rangeBand() / 2;
              scale0 = scale1 = function(d) { return x(d) + dx; };
            } else if (scale0.rangeBand) {
              scale0 = scale1;
            } else {
              tickExit.call(tickTransform, scale1, scale0);
            }

            tickEnter.call(tickTransform, scale0, scale1);
            tickUpdate.call(tickTransform, scale1, scale1);
            });
        }

        axis.scale = function(x) {
            if (!arguments.length) return scale;
            scale = x;
            return axis;
        };

        axis.orient = function(x) {
            if (!arguments.length) return orient;
            orient = x in d3_canvas_axisOrients ? x + "" : d3_canvas_axisDefaultOrient;
            return axis;
        };

        axis.ticks = function() {
            if (!arguments.length) return tickArguments_;
            tickArguments_ = arguments;
            return axis;
        };

        axis.tickValues = function(x) {
            if (!arguments.length) return tickValues;
            tickValues = x;
            return axis;
        };

        axis.tickFormat = function(x) {
            if (!arguments.length) return tickFormat_;
            tickFormat_ = x;
            return axis;
        };

        axis.tickSize = function(x) {
            var n = arguments.length;
            if (!n) return innerTickSize;
            innerTickSize = +x;
            outerTickSize = +arguments[n - 1];
            return axis;
        };

        axis.innerTickSize = function(x) {
            if (!arguments.length) return innerTickSize;
            innerTickSize = +x;
            return axis;
        };

        axis.outerTickSize = function(x) {
            if (!arguments.length) return outerTickSize;
            outerTickSize = +x;
            return axis;
        };

        axis.tickPadding = function(x) {
            if (!arguments.length) return tickPadding;
            tickPadding = +x;
            return axis;
        };

        axis.tickSubdivide = function() {
            return arguments.length && axis;
        };

        return axis;
    };

    var d3_canvas_axisDefaultOrient = "bottom",
        d3_canvas_axisOrients = {top: 1, right: 1, bottom: 1, left: 1};

    function d3_canvas_axisX(selection, x0, x1) {
        selection.attr("transform", function(d) { var v0 = x0(d); return "translate(" + (isFinite(v0) ? v0 : x1(d)) + ",0)"; });
    }

    function d3_canvas_axisY(selection, y0, y1) {
        selection.attr("transform", function(d) { var v0 = y0(d); return "translate(0," + (isFinite(v0) ? v0 : y1(d)) + ")"; });
    }

    g.paper.types.canvas = function (paper, p) {
        var canvas, ctx, current;

        p.xAxis = d3.canvas.axis();
        p.yAxis = [d3.canvas.axis(), d3.canvas.axis()];

        paper.refresh = function () {
            paper.destroy();
            canvas = paper.element().append("canvas")
                            .attr("width", p.size[0])
                            .attr("height", p.size[1]);
            ctx = canvas.node().getContext('2d');
            current = ctx;
            p.event.refresh({type: 'refresh', size: p.size.slice(0)});
            return paper;
        };

        paper.refresh();

        paper.current = function () {
            return current;
        };

        paper.clear = function () {
            current = ctx;
            current.clearRect(0, 0, p.size[0], p.size[1]);
            return paper;
        };
    };

    g.C3 = Viz.extend({
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
    g.Force = Viz.extend({
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
    g.Leaflet = Viz.extend({
        //
        defaults: {
            center: [41.898582, 12.476801],
            zoom: 4,
            maxZoom: 18,
            zoomControl: true,
            wheelZoom: true,
        },
        getAttributes: function (attrs) {
            // switch off resizing, handled by leflet
            attrs.resize = false;
            return attrs;
        },
        //
        d3build: function () {
            var o = this.attrs,
                e = this.element.node();
            if (typeof L === 'undefined') {
                var self = this;
                require(['leaflet'], function () {
                    self.d3build();
                });
            } else {
                var opts = this.attrs,
                    map = this.map = new L.map(e, {
                        center: o.center,
                        zoom: o.zoom
                    });
                if (opts.zoomControl) {
                    if (!opts.wheelZoom)
                        map.scrollWheelZoom.disable();
                } else {
                    map.dragging.disable();
                    map.touchZoom.disable();
                    map.doubleClickZoom.disable();
                    map.scrollWheelZoom.disable();

                    // Disable tap handler, if present.
                    if (map.tap) map.tap.disable();
                }

                if (o.buildMap)
                    o.buildMap.call(this);
            }
        },
        //
        addLayer: function (url, options) {
            if (this.map)
                L.tileLayer(url, options).addTo(this.map);
        },
        //
        addSvgLayer: function (collection, draw) {
            var transform = d3.geo.transform({point: ProjectPoint}),
                path = d3.geo.path().projection(transform),
                map = this.map,
                svg = map ? d3.select(map.getPanes().overlayPane).append("svg") : null,
                g = svg ? svg.append("g").attr("class", "leaflet-zoom-hide") : null;

            // Use Leaflet to implement a D3 geometric transformation.
            function ProjectPoint (x, y) {
                var point = map.latLngToLayerPoint(new L.LatLng(y, x));
                this.stream.point(point.x, point.y);
            }
            //
            // Reposition the SVG to cover the features.
            function reset () {
                var bounds = path.bounds(collection),
                    topLeft = bounds[0],
                    bottomRight = bounds[1];

                svg.attr("width", bottomRight[0] - topLeft[0])
                    .attr("height", bottomRight[1] - topLeft[1])
                    .style("left", topLeft[0] + "px")
                    .style("top", topLeft[1] + "px");

                g.attr("transform", "translate(" + -topLeft[0] + "," + -topLeft[1] + ")");

                if (draw)
                    draw(path);
            }
            //
            if (map) {
                var svgLayer = {
                    svg: svg,
                    g: g,
                    collection: collection,
                    path: path,
                    draw: function () {
                        var bounds = path.bounds(collection),
                            topLeft = bounds[0],
                            bottomRight = bounds[1];

                        svg.attr("width", bottomRight[0] - topLeft[0])
                            .attr("height", bottomRight[1] - topLeft[1])
                            .style("left", topLeft[0] + "px")
                            .style("top", topLeft[1] + "px");

                        g.attr("transform", "translate(" + -topLeft[0] + "," + -topLeft[1] + ")");

                        if (draw)
                            draw(svgLayer);
                    }
                };
                map.on("viewreset", svgLayer.draw);
                return svgLayer;
            }
        }
    });

    //
    //  Sunburst visualization
    //
    //  In addition to standard Viz parameters:
    //      labels: display labels or not (default false)
    //      padding: padding of sunburst (default 10)
    g.SunBurst = Viz.extend({
        defaults: {
            // Show labels
            labels: true,
            // sunburst padding
            addorder: false,
            // Add the order of labels if available in the data
            padding: 10,
            // speed in transitions
            transition: 750,
            //
            scale: 'sqrt',
            //
            initNode: null
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
        select: function (path) {
            if (!this.current) return;
            var node = this.attrs.data;
            if (path && path.length) {
                for (var n=0; n<path.length; ++n) {
                    var name = path[n];
                    if (node.children) {
                        for (var i=0; i<=node.children.length; ++i) {
                            if (node.children[i] && node.children[i].name === name) {
                                node = node.children[i];
                                break;
                            }
                        }
                    } else {
                        break;
                    }
                }
            }
            return this._select(node);
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

            this._select = function (node) {
                if (node === this.current) return;

                if (text) text.transition().attr("opacity", 0);
                //
                function visible (e) {
                    return e.x >= node.x && e.x < (node.x + node.dx);
                }

                var arct = arcTween(node);
                depth = node.depth;

                path.transition()
                    .duration(transition)
                    .attrTween("d", arct)
                    .each('end', function (e, i) {
                        if (node === e) {
                            self.current = e;
                            self.fire('change');
                        }
                    });

                if (text) {
                    positions = [];
                    dummyPath.transition()
                        .duration(transition)
                        .attrTween("d", arct)
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
                return true;
            };

            //
            this.current = root;
            if (!this.select(this.attrs.initNode))
                this.fire('change');

            function scale (radius) {
                if (attrs.scale === 'log')
                    return d3.scale.log().range([1, radius]);
                if (attrs.scale === 'linear')
                    return d3.scale.linear().range([0, radius]);
                else
                    return d3.scale.sqrt().range([0, radius]);
            }

            function click (d) {
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
                            self.fire('change');
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


    g.Trianglify = Viz.extend({
        //
        defaults: {
            bleed: 150,
            fillOpacity: 1,
            strokeOpacity: 1,
            noiseIntensity: 0,
            gradient: null,
            x_gradient: null,
            y_gradient: null
        },
        //
        d3build: function () {
            //
            if (this.Trianglify === undefined && typeof Trianglify === 'undefined') {
                var self = this;
                return g.require(['trianglify'], function (Trianglify) {
                    self.Trianglify = Trianglify || null;
                    self.d3build();
                });
            }

            if (this.Trianglify === undefined)
                this.Trianglify = Trianglify;

            var t = this._t,
                attrs = this.attrs,
                cellsize = attrs.cellsize ? +attrs.cellsize : 0,
                cellpadding = attrs.cellpadding ? +attrs.cellpadding : 0,
                fillOpacity = attrs.fillOpacity ? +attrs.fillOpacity : 1,
                strokeOpacity = attrs.strokeOpacity ? +attrs.strokeOpacity : 1,
                noiseIntensity = attrs.noiseIntensity ? +attrs.noiseIntensity : 0,
                gradient = this.gradient(attrs.gradient),
                x_gradient = this.gradient(attrs.x_gradient) || gradient,
                y_gradient = this.gradient(attrs.y_gradient) || gradient;

            if (!this._t)
                this._t = t = new Trianglify();

            t.options.fillOpacity = Math.min(1, Math.max(fillOpacity, 0));
            t.options.strokeOpacity = Math.min(1, Math.max(strokeOpacity, 0));
            t.options.noiseIntensity = Math.min(1, Math.max(noiseIntensity, 0));
            if (x_gradient)
                t.options.x_gradient = x_gradient;
            if (y_gradient)
                t.options.y_gradient = y_gradient;
            if (cellsize > 0) {
                t.options.cellsize = cellsize;
                t.options.bleed = +attrs.bleed;
            }
            var pattern = t.generate(this.attrs.width, this.attrs.height),
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
            element.style("min-height", "100%")
                   //.style("height", this.attrs.height+"px")
                   //.style("width", this.attrs.width+"px")
                   .style("background-image", pattern.dataUrl);
        },
        //
        gradient: function (value) {
            if (value && typeof(value) === 'string') {
                var bits = value.split('-');
                if (bits.length === 2) {
                    var palette = Trianglify.colorbrewer[bits[0]],
                        num = +bits[1];
                    if (palette) {
                        return palette[num];
                    }
                }
            }
        }
    });

    g.Chart = Viz.extend({
        serieDefaults: {
            lines: {show: true},
            points: {show: true}
        },

        defaults: {

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
var BITS = 52,
    SCALE = 2 << 51,
    MAX_DIMENSION = 21201,
    COEFFICIENTS = [
        'd       s       a       m_i',
        '2       1       0       1',
        '3       2       1       1 3',
        '4       3       1       1 3 1',
        '5       3       2       1 1 1',
        '6       4       1       1 1 3 3',
        '7       4       4       1 3 5 13',
        '8       5       2       1 1 5 5 17',
        '9       5       4       1 1 5 5 5',
        '10      5       7       1 1 7 11 1'
    ];


g.math.sobol = function (dim) {
    if (dim < 1 || dim > MAX_DIMENSION) throw new Error("Out of range dimension");
    var sobol = {},
        count = 0,
        direction = [],
        x = [],
        zero = [],
        lines,
        i;

    sobol.next = function() {
        var v = [];
        if (count === 0) {
            count++;
            return zero.slice();
        }
        var c = 1;
        var value = count - 1;
        while ((value & 1) == 1) {
            value >>= 1;
            c++;
        }
        for (i = 0; i < dim; i++) {
            x[i] ^= direction[i][c];
            v[i] = x[i] / SCALE;
        }
        count++;
        return v;
    };

    sobol.dimension = function () {
        return dim;
    };

    sobol.count = function () {
        return count;
    };


    var tmp = [];
    for (i = 0; i <= BITS; i++) tmp.push(0);
    for (i = 0; i < dim; i++) {
        direction[i] = tmp.slice();
        x[i] = 0;
        zero[i] = 0;
    }

    if (dim > COEFFICIENTS.length) {
        throw new Error("Out of range dimension");
        //var data = fs.readFileSync(file);
        //lines = ("" + data).split("\n");
    }
    else
        lines = COEFFICIENTS;

    for (i = 1; i <= BITS; i++) direction[0][i] = 1 << (BITS - i);
    for (var d = 1; d < dim; d++) {
        var cells = lines[d].split(/\s+/);
        var s = +cells[1];
        var a = +cells[2];
        var m = [0];
        for (i = 0; i < s; i++) m.push(+cells[3 + i]);
        for (i = 1; i <= s; i++) direction[d][i] = m[i] << (BITS - i);
        for (i = s + 1; i <= BITS; i++) {
            direction[d][i] = direction[d][i - s] ^ (direction[d][i - s] >> s);
            for (var k = 1; k <= s - 1; k++)
            direction[d][i] ^= ((a >> (s - 1 - k)) & 1) * direction[d][i - k];
        }
    }

    return sobol;
};


    return d3;
}));