/**
 * @license ts 0.0.0 Copyright (c) 2011 C. Scott Ananian, portions Copyright (c) 2010-2011, The Dojo Foundation All Rights Reserved.
 * Available via the MIT or new BSD license.
 */

/* Yes, deliciously evil. */
/*jslint evil: true, strict: false, plusplus: false, regexp: false */
/*global require: false, XMLHttpRequest: false, ActiveXObject: false,
  define: false, process: false, window: false */

(function () {

    var fs, getXhr,
        progIds = ['Msxml2.XMLHTTP', 'Microsoft.XMLHTTP', 'Msxml2.XMLHTTP.4.0'],
        fetchText = function () {
            throw new Error('Environment unsupported.');
        },
        buildMap = [];



    if (typeof window !== "undefined" && window.navigator && window.document) {
        // Browser action
        getXhr = function () {
            //Would love to dump the ActiveX crap in here. Need IE 6 to die first.
            var xhr, i, progId;
            if (typeof XMLHttpRequest !== "undefined") {
                return new XMLHttpRequest();
            } else {
                for (i = 0; i < 3; i++) {
                    progId = progIds[i];
                    try {
                        xhr = new ActiveXObject(progId);
                    } catch (e) {}

                    if (xhr) {
                        progIds = [progId];  // so faster next time
                        break;
                    }
                }
            }

            if (!xhr) {
                throw new Error("getXhr(): XMLHttpRequest not available");
            }

            return xhr;
        };

        fetchText = function (url, callback) {
            var xhr = getXhr();
            xhr.open('GET', url, true);
            // XXX FOR DEVELOPMENT
            xhr.setRequestHeader('Cache-Control', 'no-cache');
            xhr.setRequestHeader('Pragma', 'no-cache');
            // XXX END DEVELOPMENT
            xhr.onreadystatechange = function (evt) {
                //Do not explicitly handle errors, those should be
                //visible via console output in the browser.
                if (xhr.readyState === 4) {
                    callback(xhr.responseText);
                }
            };
            xhr.send(null);
        };
        // end browser.js adapters
    } else if (typeof process !== "undefined" &&
               process.versions &&
               !!process.versions.node) {
        //Using special require.nodeRequire, something added by r.js.
        fs = require.nodeRequire('fs');
        fetchText = function (path, callback) {
            callback(fs.readFileSync(path, 'utf8'));
        };
    }

    define(['parse','jcompile','top-level'], function(parse, jcompile, top_level) {
        if (!Object.Throw) {
            Object.Throw = function(obj) { throw obj; };
        }
        function TurtleScript(text, config) {
            tree = parse(text, top_level);
            // find top-level call(s) to 'define()' and hack the dependencies
            // to also use the ts! loader.
            tree.forEach(function(stmt) {
                if (stmt.arity==="binary" && stmt.value === '(' &&
                    stmt.first.arity==="name" && stmt.first.value==="define") {
                    var i, deps;
                    for (i=0; i<stmt.second.length; i++) {
                        if (stmt.second[i].arity==="unary" &&
                            stmt.second[i].value==="[") {
                            deps = stmt.second[i];
                            break;
                        }
                    }
                    if (!deps) { return; }
                    deps.first.forEach(function(dname) {
                        if (dname.arity !== 'literal') { return; }
                        if (dname.value.indexOf('!') !== -1) { return; }
                        dname.value = "ts!" + dname.value;
                    });
                }
            });
            return jcompile(tree);
        };
        return {
        version: '0.1.0',

        load: function (name, parentRequire, load, config) {
            var path = parentRequire.toUrl(name + '.js');// XXX could be .ts?
            fetchText(path, function (text) {

                //Do TurtleScript transform.
                var origText = text;
                try {
                  text = TurtleScript(origText, config.TurtleScript);
                } catch (e) {
                    if (e.from && e.to) {
                        // find newline before 'from'
                        var fromNL = origText.lastIndexOf('\n', e.from);
                        var toNL = origText.indexOf('\n', e.to);
                        if (fromNL === -1) fromNL = 0; else fromNL++;
                        if (toNL === -1) toNL = e.to;
                        var line = origText.substring(fromNL, toNL);
                        console.log("Syntax Error: "+JSON.stringify(e));
                        console.log(line);
                    }
                    throw new Error("Could not compile: "+path);
                }

                //Hold on to the transformed text if a build.
                if (config.isBuild) {
                    buildMap[name] = text;
                }

                //IE with conditional comments on cannot handle the
                //sourceURL trick, so skip it if enabled.
                /*@if (@_jscript) @else @*/
                if (!config.isBuild) {
                    text += "\r\n//@ sourceURL=" + path;
                }
                /*@end@*/

                load.fromText(name, text);

                //Give result to load. Need to wait until the module
                //is fully parse, which will happen after this
                //execution.
                parentRequire([name], function (value) {
                    load(value);
                });
            });

        },

        write: function (pluginName, name, write) {
            if (name in buildMap) {
                var text = buildMap[name];
                write.asModule(pluginName + "!" + name, text);
            }
        }
        };
    });

}());
