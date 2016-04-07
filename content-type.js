// Licence: PUBLIC DOMAIN <http://unlicense.org/>
// Author: Austin Wright <http://github.com/Acubed>
//var typeIs = require('type-is');
var errors = require('./errors');

var MediaType = module.exports = function MediaType(s, p) {
  this.type = "";
  this.params = {};
  var c,
      i,
      n;

  if (typeof s === "string") {
    c = splitQuotedString(s);

    this.type = c.shift();

    for (i = 0; i < c.length; ++i) {
      this.parseParameter(c[i]);
    }
  } else if (s instanceof MediaType) {
    this.type = s.type;

    this.q = s.q;

    for (n in s.params) {
      this.params[n] = s.params[n];
    }
  }

  if (typeof p === "string") {
    c = splitQuotedString(p);

    for (i = 0; i < c.length; ++i) {
      this.parseParameter(c[i]);
    }
  } else if (typeof p === "object") {
    for (n in p) {
      this.params[n] = p[n];
    }
  }
};

MediaType.prototype.parseParameter = function parseParameter(s) {
  var param = s.split("=", 1);

  var name = param[0].trim();

  var value = s.substr(param[0].length + 1).trim();

  if (!value || !name) {
    return;
  }

  // TODO Per http://tools.ietf.org/html/rfc7231#section-5.3.2 everything
  //   after the q-value is classified as accept-extension
  //if (name === "q" && typeof this.q === "undefined") {
  if (name === "q") {
    // Limit q to 3 decimal places, per ABNF
    this.q = parseFloat(Math.min(parseFloat(value), 1).toFixed(3));
  } else {
    if (value[0] === '"' && value[value.length - 1] === '"') {
      value = value.substr(1, value.length - 2).replace(/\\(.)/g, function replace(a, b) {
        return b;
      });
    }

    this.params[name] = value;
  }
};

MediaType.prototype.toString = function toString() {
  var str = this.type;

  var params = Object.keys(this.params).sort();

  for (var i = 0; i < params.length; ++i) {
    var n = params[i];
    str += "; " + n + "=";

    if (this.params[n].match(/^[!#$%&'*+\-.^_`|~0-9a-zA-Z]+$/)) {
      str += this.params[n];
    } else {
      str += '"' + this.params[n].replace(/["\\]/g, function replace(a) {
        return '\\' + a;
      }) + '"';
    }
  }
  if (typeof this.q === 'number' && this.q >= 0) {
    // q is 1 or less. remove trailing 0's and decimal
    var q = Math.min(this.q, 1).toFixed(3).replace(/0*$/, '').replace(/\.$/, '');
    str += '; q=' + q;
  }

  return str;
};

// Split a string by character, but ignore quoted parts and backslash-escaped
// characters
var splitQuotedString = MediaType.splitQuotedString = function splitQuotedString(str, delim, quote) {
  if (typeof str !== "string") {
    return [];
  }
  delim = delim || ";";
  quote = quote || '"';

  var res = [];

  var start = 0;
  var offset = 0;

  var findNextChar = function findNextChar(v, c, i, a) {
    var p = str.indexOf(c, offset + 1);

    var result;
    if (p < 0) {
      result = v;
    } else {
      result = Math.min(p, v);
    }
    return result;
  };

  while (offset >= 0) {
    offset = [delim, quote].reduce(findNextChar, 1 / 0);

    if (offset === 1 / 0) {
      break;
    }

    switch (str[offset]) {
      case quote:
        // Skip to end of quoted string
        while (1) {
          offset = str.indexOf(quote, offset + 1);
          if (offset < 0) {
            break;
          }
          if (str[offset - 1] === "\\") {
            continue;
          }
          break;
        }
        continue;
      case delim:
        res.push(str.substr(start, offset - start).trim());
        start = ++offset;
        break;
    }
  }

  res.push(str.substr(start).trim());

  return res;
};

// Split a list of content types found in an Accept header
// Maybe use it like: splitContentTypes(request.headers.accept).map(parseMedia)
MediaType.splitContentTypes = function splitContentTypes(str) {
  return MediaType.splitQuotedString(str, ",");
};

MediaType.parseMedia = function parseMedia(str) {
  return new MediaType(str);
};

function normalizeTypes(types) {
  var normalized = types;
  if (types.length && typeof types[0] === "string") {
    normalized = types.map(MediaType.parseMedia);
  }
  return normalized;
}

function normalizeAccepts(accepts) {
  var normalized = accepts;
  if (typeof accepts === "string") {
    normalized = MediaType.splitContentTypes(accepts);
  }
  if (normalized.length && typeof normalized[0] === "string") {
    normalized = normalized.map(MediaType.parseMedia);
  }
  if (!normalized.length) {
    normalized = [MediaType.parseMedia('*/*')];
  }
  return normalized;
}

/**
 * Pick an ideal representation to send, given a list of representations to
 * choose from and the client-preferred list
 *
 * Algorithm: start with most specific accept, compare all representations to
 * that, starting with most specific. if match found, disable that accept from
 * future comparisons. keep record of candidate with highest multiplication of
 * accept.q and representation.q, use this as result when iteration is finished.
 * remove q and stringify. throw error if no acceptable type found
 *
 * @param {string[]|MediaType[]}        representations Available representations
 * @param {string|string[]|MediaType[]} accepts         Client preferences
 *
 * @returns {string}
 */
MediaType.select = function select(representations, accepts) {
  // Normalize to arrays of MediaTypes
  representations = normalizeTypes(representations);
  accepts = normalizeAccepts(accepts);
  representations.sort(MediaType.specificityCmp);
  accepts.sort(MediaType.specificityCmp);

  var is,
      typeQ,
      acceptQ,
      candidate = {
        q: 0
      };
  accepts.map(function iterateTypes(accept) {
    if (accept.type === '' || accept.type === undefined || accept.type === null) {
      accept.type = "*/*";
    }
    representations.map(function iterateAccepts(available) {
      if (available.taken) {
        return;
      }
      is = MediaType.mediaCmp(available, accept);
      if (is !== null && is <= 0) {
        typeQ = Math.max(Math.min(1, available.q || 1), 0);
        acceptQ = Math.max(Math.min(1, accept.q || 1), 0);
        available.taken = true;

        if (typeQ * acceptQ > candidate.q) {
          candidate = {
            accept: accept,
            available: available,
            q: acceptQ * typeQ
          };
          if (available.params) {
            candidate.params = Object.keys(available.params).length;
          }
        }
      }
    });
  });
  if (candidate.q === 0) {
    throw new errors.UnacceptableError();
  }
  delete candidate.available.q;
  return candidate.available.toString();
};

/**
 * Compare specificity of two types
 *
 * @param {MediaType} aArg
 * @param {MediaType} bArg
 *
 * @returns {bool} -1 if `aArg` more specific than `bArg`, 0 if same, -1 if less
 */
MediaType.specificityCmp = function specificityCmp(aArg, bArg) {
  var a = {};
  var parts = bArg.type.split('/');
  a.type = parts[0];
  a.subtype = parts[1];
  a.params = 0;
  if (bArg.params) {
    a.params = Object.keys(bArg.params).length;
  }

  var b = {};
  parts = aArg.type.split('/');
  b.type = parts[0];
  b.subtype = parts[1];
  b.params = 0;
  if (aArg.params) {
    b.params = Object.keys(aArg.params).length;
  }

  if (a.type === "*" && b.type !== "*") {
    return -1;
  }
  if (a.type !== "*" && b.type === "*") {
    return 1;
  }
  if (a.subtype === "*" && b.subtype !== "*") {
    return -1;
  }
  if (a.subtype !== "*" && b.subtype === "*") {
    return 1;
  }
  if (a.params > b.params) {
    return 1;
  }
  if (a.params < b.params) {
    return -1;
  }
  return 0;
};

/* Determine if one media type is a subset of another
 *
 * If a is a superset of b (b is smaller than a), return 1
 * If b is a superset of a, return -1
 * If they are the exact same, return 0
 * If they are disjoint, return null
 *
 * @param {MediaType|string} a
 * @param {MediaType|string} b
 *
 * @returns {int|null}
 */
MediaType.mediaCmp = function mediaCmp(a, b) {
  if (typeof a === "string") {
    a = MediaType.parseMedia(a);
  }
  if (typeof b === "string") {
    b = MediaType.parseMedia(b);
  }
  if (a.type === "*/*" && b.type !== "*/*") {
    return 1;
  } else if (a.type !== "*/*" && b.type === "*/*") {
    return -1;
  }

  var ac = (a.type || "").split("/");
  var bc = (b.type || "").split("/");

  if (ac[0] === "*" && bc[0] !== "*") {
    return 1;
  }

  if (ac[0] !== "*" && bc[0] === "*") {
    return -1;
  }

  // compare subtypes
  if (ac[0] === bc[0]) {
    if (ac[1] === "*" && bc[1] !== "*") {
      return 1;
    }
    if (ac[1] !== "*" && bc[1] === "*") {
      return -1;
    }
  }

  if (a.type !== b.type) {
    return null;
  }

  var ap = a.params || {};
  var bp = b.params || {};

  var ak = Object.keys(ap);
  var bk = Object.keys(bp);

  if (ak.length < bk.length) {
    return 1;
  }

  if (ak.length > bk.length) {
    return -1;
  }

  var dir = 0;

  for (var n in ap) {
    if (ap[n] && typeof bp[n] === "undefined") {
      if (dir < 0) {
        return null;
      }
      dir = 1;
    }

    if (bp[n] && typeof ap[n] === "undefined") {
      if (dir > 0) {
        return null;
      }
      dir = -1;
    }

    if (ap[n] && bp[n] && ap[n] !== bp[n]) {
      return null;
    }
  }

  return dir;
};
