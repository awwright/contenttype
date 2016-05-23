// Licence: PUBLIC DOMAIN <http://unlicense.org/>
// Author: Austin Wright <http://github.com/Acubed>


/**
 * Constructor, creates new MediaType
 *
 * @example
 * new MediaType('text/html;l=3', { p: 4 });
 * // MediaType { type: 'text/html', params: { l: '3', p: '4' } }
 *
 * @example
 * new MediaType('text/html;l=3', 'p=4;l=5');
 * // MediaType { type: 'text/html', params: { l: '5', p: '4' } }
 *
 * @param {string|MediaType} type   Media type
 * @param {string|object}    params Parameters
 */
function MediaType(type, params){
	this.type = '';
	this.params = {};
	var stringArray,
			i;

	if(typeof type=='string'){
		// Split by ';'. First part is type, the rest are params, or q
		stringArray = splitQuotedString(type);
		this.type = stringArray.shift();
		for(i=0; i<stringArray.length; i++){
			this.parseParameter(stringArray[i]);
		}
	}else if(type instanceof MediaType){
		this.type = type.type;
		this.q = type.q;
		for(var i in type.params) this.params[i]=type.params[i];
	}

	// Override parameters (if any) with 2nd arg
	if(typeof params=='string'){
		stringArray = splitQuotedString(params);
		for(i=0; i<stringArray.length; i++){
			this.parseParameter(stringArray[i]);
		}
	}else if(typeof params=='object'){
		for(var i in params){
			if (i === "q") {
				this.q = parseQ(params[i]);
			}else{
				this.params[i] = parseParamValue(params[i]);
			}
		}
	}
}

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
 * Parse parameters from a string
 *
 * @param {string} string
 */
MediaType.prototype.parseParameter = function parseParameter(s){
	var param = s.split('=',1);
	var name = param[0].trim();
	var value = s.substr(param[0].length+1).trim();
	if(!value || !name) return;

	if(name=='q'){
		this.q=parseQ(value);
	}else{
		value = parseParamValue(value);
		// Per http://tools.ietf.org/html/rfc7231#section-5.3.2 everything after the
		// q-value is accept-ext (ignore for now)
		if (!this.hasOwnProperty('q')) {
			this.params[name]=value;
		}
	}
}

MediaType.prototype.toString = function toString(){
	var str = this.type;
	var params = Object.keys(this.params).sort();
	for(var i=0; i<params.length; i++){
		var n = params[i];
		str += ';'+n+'=';
		if(this.params[n].match(/^[!#$%&'*+\-.^_`|~0-9a-zA-Z]+$/)){
			str += this.params[n];
		}else{
			str += '"' + this.params[n].replace(/["\\]/g, function(a){return '\\'+a;}) + '"';
		}
	}
	if(typeof this.q==='number' && this.q>=0){
		var q = Math.min(this.q, 1).toFixed(3).replace(/0*$/, '').replace(/\.$/, '');
		str += '; q=' + q;
	}
	return str;
}
exports.MediaType = MediaType;

// Split a string by character, but ignore quoted parts and backslash-escaped characters
function splitQuotedString(str, delim, quote){
	delim = delim || ';';
	quote = quote || '"';
	var res = [];
	var start = 0;
	var offset = 0;
	function findNextChar(v, c, i, a){
		var p = str.indexOf(c, offset+1);
		return (p<0)?v:Math.min(p,v);
	}
	while(offset>=0){
		offset = [delim,quote].reduce(findNextChar, 1/0);
		if(offset===1/0) break;
		switch(str[offset]){
			case quote:
				// Skip to end of quoted string
				while(1){
					offset=str.indexOf(quote, offset+1);
					if(offset<0) break;
					if(str[offset-1]==='\\') continue;
					break;
				}
				continue;
			case delim:
				res.push(str.substr(start, offset-start).trim());
				start = ++offset;
				break;
		}
	}
	res.push(str.substr(start).trim());
	return res;
}
exports.splitQuotedString = splitQuotedString;

// Split a list of content types found in an Accept header
// Maybe use it like: splitContentTypes(request.headers.accept).map(parseMedia)
function splitContentTypes(str){
	return splitQuotedString(str, ',');
}
exports.splitContentTypes = splitContentTypes;

function parseMedia(str){
	var o = new MediaType(str);
	if(o.q===undefined) o.q=1;
	return o;
}
exports.parseMedia = parseMedia;

// Pick an ideal representation to send given a list of representations to choose from and the client-preferred list
function select(reps, accept){
	var cr = {q:0};
	var ca = {q:0};
	var cq = 0;
	for(var i=0; i<reps.length; i++){
		var r = reps[i];
		var rq = r.q || 1;
		for(var j=0; j<accept.length; j++){
			var a=accept[j];
			var aq = a.q || 1;
			var cmp = mediaCmp(a, r);
			if(cmp!==null && cmp>=0){
				if(aq*rq>cq){
					ca = a;
					cr = r;
					cq = ca.q*cr.q;
					if(cq===1 && cr.type) return cr;
				}
			}
		}
	}
	return cr.type&&cr;
}
exports.select = select;

// Determine if one media type is a subset of another
// If a is a superset of b (b is smaller than a), return 1
// If b is a superset of a, return -1
// If they are the exact same, return 0
// If they are disjoint, return null
function mediaCmp(a, b){
	if(a.type==='*/*' && b.type!=='*/*') return 1;
	else if(a.type!=='*/*' && b.type==='*/*') return -1;
	var ac = (a.type||'').split('/');
	var bc = (b.type||'').split('/');
	if(ac[0]=='*' && bc[0]!='*') return 1;
	if(ac[0]!='*' && bc[0]=='*') return -1;
	if(a.type!==b.type) return null;
	var ap = a.params || {};
	var bp = b.params || {};
	var ak = Object.keys(ap);
	var bk = Object.keys(bp);
	if(ak.length < bk.length) return 1;
	if(ak.length > bk.length) return -1;
	var k = ak.concat(bk).sort();
	var dir = 0;
	for(var n in ap){
		if(ap[n] && !bp[n]){ if(dir<0) return null; else dir=1; }
		if(!ap[n] && bp[n]){ if(dir>0) return null; else dir=-1; }
	}
	return dir;
}
exports.mediaCmp = mediaCmp;

return exports;
