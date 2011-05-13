// tokens.js
// 2009-05-17

// (c) 2006 Douglas Crockford

// Produce an array of simple token objects from a string.
// A simple token object contains these members:
//      type: 'name', 'string', 'number', 'operator'
//      value: string or number value of the token
//      from: index of first character of the token
//      to: index of the last character + 1

// Comments of the // type are ignored.

// Operators are by default single characters. Multicharacter
// operators can be made by supplying a string of prefix and
// suffix characters.
// characters. For example,
//      '<>+-&', '=>&:'
// will match any of these:
//      <=  >>  >>>  <>  >=  +: -: &: &&: &&

var tokenize = function (_this_, prefix, suffix, DEBUG) {
    var c;                      // The current character.
    var from;                   // The index of the start of the token.
    var i = 0;                  // The index of the current character.
    var length = _this_.length;
    var n;                      // The number value.
    var q;                      // The quote character.
    var str;                    // The string value.

    var result = [];            // An array to hold the results.

    var make = function (type, value) {

// Make a token object.

        return {
            type: type,
            value: value,
            from: from,
            to: i
        };
    };

// Begin tokenization. If the source string is empty, return nothing.

    if (!_this_) {
        return;
    }

// If prefix and suffix strings are not provided, supply defaults.

    if (typeof prefix !== 'string') {
        prefix = '<>+-&';
    }
    if (typeof suffix !== 'string') {
        suffix = '=>&:';
    }


// Loop through this text, one character at a time.

    c = _this_.charAt(i);
    while (c) {
        from = i;

// Ignore whitespace.

        if (c <= ' ') {
            i += 1;
            c = _this_.charAt(i);

// name.

        } else if (c >= 'a' && c <= 'z' || c >= 'A' && c <= 'Z' || c === '$' || c === '_') {
            str = c;
            i += 1;
            while (true) {
                c = _this_.charAt(i);
                if ((c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') ||
                        (c >= '0' && c <= '9') || c === '_' || c === '$') {
                    str += c;
                    i += 1;
                } else {
                    break;
                }
            }
            result.push(make('name', str));

// number.

// A number cannot start with a decimal point. It must start with a digit,
// possibly '0'.

        } else if (c >= '0' && c <= '9') {
            str = c;
            i += 1;

// Look for more digits.

            while (true) {
                c = _this_.charAt(i);
                if (c < '0' || c > '9') {
                    break;
                }
                i += 1;
                str += c;
            }

// Look for a decimal fraction part.

            if (c === '.') {
                i += 1;
                str += c;
                while (true) {
                    c = _this_.charAt(i);
                    if (c < '0' || c > '9') {
                        break;
                    }
                    i += 1;
                    str += c;
                }
            }

// Look for an exponent part.

            if (c === 'e' || c === 'E') {
                i += 1;
                str += c;
                c = _this_.charAt(i);
                if (c === '-' || c === '+') {
                    i += 1;
                    str += c;
                    c = _this_.charAt(i);
                }
                if (c < '0' || c > '9') {
                    make('number', str).error("Bad exponent");
                }
                while (true) {
                    i += 1;
                    str += c;
                    c = _this_.charAt(i);
                    if (! (c >= '0' && c <= '9')) {
                        break;
                    }
                }
            }

// Make sure the next character is not a letter.

            if (c >= 'a' && c <= 'z') {
                str += c;
                i += 1;
                make('number', str).error("Bad number");
            }

// Convert the string value to a number. If it is finite, then it is a good
// token.

            n = 1 * str;
            if (isFinite(n)) {
                result.push(make('number', n));
            } else {
                make('number', str).error("Bad number");
            }

// string

        } else if (c === '\'' || c === '"') {
            str = '';
            q = c;
            i += 1;
            while (true) {
                c = _this_.charAt(i);
                if (c < ' ') {
                    make('string', str).error(c === '\n' || c === '\r' || c === '' ?
                        "Unterminated string." :
                        "Control character in string.", make('', str));
                }

// Look for the closing quote.

                if (c === q) {
                    break;
                }

// Look for escapement.

                if (c === '\\') {
                    i += 1;
                    if (i >= length) {
                        make('string', str).error("Unterminated string");
                    }
                    c = _this_.charAt(i);
                    if (c === 'b') {
                        c = '\b';
                    } else if (c === 'f') {
                        c = '\f';
                    } else if (c === 'n') {
                        c = '\n';
                    } else if (c === 'r') {
                        c = '\r';
                    } else if (c === 't') {
                        c = '\t';
                    } else if (c === 'u') {
                        if (i >= length) {
                            make('string', str).error("Unterminated string");
                        }
                        c = parseInt(_this_.substr(i + 1, 4), 16);
                        if (!isFinite(c) || c < 0) {
                            make('string', str).error("Unterminated string");
                        }
                        c = String.fromCharCode(c);
                        i += 4;
                    }
                }
                str += c;
                i += 1;
            }
            i += 1;
            result.push(make('string', str));
            c = _this_.charAt(i);

// comment.

        } else if (c === '/' && _this_.charAt(i + 1) === '/') {
            i += 1;
            while (true) {
                c = _this_.charAt(i);
                if (c === '\n' || c === '\r' || c === '') {
                    break;
                }
                i += 1;
            }

// block comment.

        } else if (c === '/' && _this_.charAt(i + 1) === '*') {
            i += 3;
            while (true) {
                c = _this_.charAt(i);
                if (c === '' || (c === '/' && _this_.charAt(i - 1) === '*')) {
                    i += 1;
                    c = _this_.charAt(i);
                    break;
                }
                i += 1;
            }

// combining

        } else if (prefix.indexOf(c) >= 0) {
            str = c;
            i += 1;
            while (i < length) {
                c = _this_.charAt(i);
                if (suffix.indexOf(c) < 0) {
                    break;
                }
                str += c;
                i += 1;
            }
            result.push(make('operator', str));

// single-character operator

        } else {
            i += 1;
            result.push(make('operator', c));
            c = _this_.charAt(i);
        }
    }
    return result;
};
