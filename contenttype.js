// Licence: PUBLIC DOMAIN <http://unlicense.org/>
// Author: Austin Wright <http://github.com/Acubed>

/**
 * Constructor, creates new MediaType
 *
 * @example
 * new MediaType('text/html;l=3', { p: 4 });
 * // MediaType { type: 'text/html', params: { l: '3', p: 4 } }
 *
 * @example
 * new MediaType('text/html;l=3', 'p=4;l=5');
 * // MediaType { type: 'text/html', params: { l: '5', p: '4' } }
 *
 * @param {string|MediaType} type   Media type
 * @param {string|object}    params Parameters
 */
var MediaType = module.exports = function MediaType(type, params) {
  this.type = "";
  this.params = {};
  var stringArray,
      i;

  if (typeof type === "string") {
    // Split by ';', first part is type, the rest are params, or q
    stringArray = splitQuotedString(type);
    this.type = stringArray.shift();
    for (i = 0; i < stringArray.length; ++i) {
      this.parseParameter(stringArray[i]);
    }
  } else if (type instanceof MediaType) {
    this.type = type.type;
    this.q = type.q;
    for (i in type.params) {
      this.params[i] = type.params[i];
    }
  }

  // Override parameters (if any) with 2nd arg
  if (typeof params === "string") {
    stringArray = splitQuotedString(params);
    for (i = 0; i < stringArray.length; ++i) {
      this.parseParameter(stringArray[i]);
    }
  } else if (typeof params === "object") {
    for (i in params) {
      if (i === "q") {
        this.q = parseQ(params[i]);
      } else {
        this.params[i] = parseParamValue(params[i]);
      }
    }
  }
  // TODO always add q?
};

/**
 * Parse an Accept or Content-Type string
 *
 * @param {string} str Single content type (not comma separated)
 *
 * @returns {MediaType}
 */
MediaType.parseMedia = function parseMedia(str) {
  return new MediaType(str);
};

/**
 * Parse parameters from a string
 *
 * @param {string} string
 */
MediaType.prototype.parseParameter = function parseParameter(string) {
  var param = string.split("=", 1);
  var name = param[0].trim();
  var value = string.substr(param[0].length + 1).trim();

  if (!value || !name) {
    return;
  }

  if (name === "q") {
    this.q = parseQ(value);
  } else {
    value = parseParamValue(value);
    // Per http://tools.ietf.org/html/rfc7231#section-5.3.2 everything after
    // the q-value is classified as accept-extension (ignore for now)
    if (!this.hasOwnProperty('q')) {
      this.params[name] = value;
    }
  }
};

/**
 * Parse parameter value consistently
 *
 * @param {string} value
 *
 * @returns {string}
 */
function parseParamValue(value) {
  // ?
  if (value[0] === '"' && value[value.length - 1] === '"') {
    value = value.substr(1, value.length - 2).replace(/\\(.)/g, function replace(a, b) {
      return b;
    });
  }
  return value + "";
}

/**
 * Ensure q is between 0 and 1. Limit to 3 decimal places, per ABNF
 *
 * @param {string|number} q
 *
 * @returns {float}
 */
function parseQ(q) {
  var parsed = parseFloat(Math.min(parseFloat(q), 1).toFixed(3));
  return parsed;
}

/**
 * Convert MediaType to its string representation, with alphabetical params
 *
 * @returns {string}
 */
MediaType.prototype.toString = function toString() {
  var str = this.type;
  var params = Object.keys(this.params).sort();

  var paramName;
  var paramValue;
  for (var i = 0; i < params.length; ++i) {
    paramName = params[i];
    paramValue = this.params[paramName];
    str += "; " + paramName + "=";

    // quote paramName value if needed
    if (paramValue.match(/^[!#$%&'*+\-.^_`|~0-9a-zA-Z]+$/)) {
      str += paramValue;
    } else {
      str += '"' + paramValue.replace(/["\\]/g, function replace(a) {
        return '\\' + a;
      }) + '"';
    }
  }
  if (this.hasOwnProperty('q')) {
    str += '; q=' + this.q;
  }

  return str;
};

/*
 * Split a string by character, but ignore quoted parts and backslash-escaped
 * characters
 *
 * @param {string} str
 * @param {string} delim
 * @param {string} quote
 *
 * @returns {string}
 */
var splitQuotedString = MediaType.splitQuotedString = function splitQuotedString(str, delim, quote) {
  if (typeof str !== "string") {
    return [];
  }
  delim = delim || ";";
  quote = quote || '"';

  var res = [];

  var start = 0;
  var offset = 0;

  function findNextChar(v, c, i, a) {
    var p = str.indexOf(c, offset + 1);
    var result;
    if (p < 0) {
      result = v;
    } else {
      result = Math.min(p, v);
    }
    return result;
  }

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

/*
 * Convenience method. Split a list of content types found in an Accept header
 *
 * @example
 * splitContentTypes(request.headers.accept).map(parseMedia)
 *
 * @param {string} str
 *
 * @returns {string}
 */
MediaType.splitContentTypes = function splitContentTypes(str) {
  return MediaType.splitQuotedString(str, ",");
};

function normalizeTypes(types) {
  var normalized = types;
  if (typeof types === "string") {
    normalized = MediaType.splitContentTypes(types);
  }
  if (normalized.length && typeof normalized[0] === "string") {
    normalized = normalized.map(MediaType.parseMedia);
  }
  return normalized;
}

function normalizeAccepts(accepts) {
  var normalized = accepts;
  if (typeof accepts === "string" || typeof accepts === "undefined" || accepts === null) {
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
 * Algorithm: start with most specific Accept, compare all Representations to
 * that, starting with most specific. If match found, disable that Accept from
 * future comparisons. Keep record of candidate with highest multiplication of
 * Accept.q and Representation.q, using this as result when iteration is
 * finished. Remove q and stringify. Throw error if no acceptable type found
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
    if (accept.type === '' || typeof accept.type === "undefined" || accept.type === null) {
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

        // Replace candidate if better match found
        if (typeQ * acceptQ > candidate.q) {
          candidate = {
            accept: accept,
            available: available,
            q: acceptQ * typeQ
          };
        }
      }
    });
  });
  if (candidate.q === 0) {
    return null;
  }
  delete candidate.available.q;
  return candidate.available;
};

/**
 * Compare specificity of two types
 *
 * Useful for content type negotiation, as more specific types have higher
 * priority for being selected.
 * Algorithm: wildcard type is least specific, then wildcard subtype. If type
 *   and subtype match, count the parameters, more parameters = more specific
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

/*
 * Determine if one media type is a subset of another
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
  // Normalize a and b as MediaType
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

  var aParts = (a.type || "").split("/");
  var bParts = (b.type || "").split("/");
  var aType = aParts[0];
  var bType = bParts[0];
  var aSubtype = aParts[1];
  var bSubtype = bParts[1];

  // compare types
  if (aType === "*" && bType !== "*") {
    return 1;
  }

  if (aType !== "*" && bType === "*") {
    return -1;
  }

  // compare subtypes
  if (aType === bType && aSubtype === "*" && bSubtype !== "*") {
    return 1;
  }
  if (aType === bType && aSubtype !== "*" && bSubtype === "*") {
    return -1;
  }

  // If type/subtype does not match, disjoint
  if (a.type !== b.type) {
    return null;
  }

  return paramsCmp(a.params || {}, b.params || {});
};

/*
 * Determine if params for one media type is a subset of another set of params
 *
 * If a is a superset of b (b is smaller than a), return 1
 * If b is a superset of a, return -1
 * If they are the exact same, return 0
 * If they are disjoint, return null
 *
 * @param {object} a
 * @param {object} b
 *
 * @returns {int|null}
 */
function paramsCmp(a, b) {
  var missingAParam = false;
  var missingBParam = false;
  var n;

  // Check if all params in `a` exist in `b`
  for (n in a) {
    if (!b.hasOwnProperty(n)) {
      missingBParam = true;
      continue;
    }
    // If param exists in both but mismatched values, disjoint
    if (a[n] !== b[n]) {
      return null;
    }
  }
  // Check if all params in `b` exist in `a`
  for (n in b) {
    if (!a.hasOwnProperty(n)) {
      missingAParam = true;
      continue;
    }
    // If param exists in both but mismatched values, disjoint
    if (a[n] !== b[n]) {
      return null;
    }
  }
  // If a is missing params from b and vice versa, disjoint
  // e.g. a=text/html;p=1 b=text/html;s=1
  if (missingAParam && missingBParam) {
    return null;
  }
  if (missingAParam) {
    return 1;
  }
  if (missingBParam) {
    return -1;
  }
  return 0;
}
