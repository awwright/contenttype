# Content-Type parsing

*note: forked from [here](https://github.com/Acubed/contenttype)*

## new MediaType(type, [parameters])

The MediaType represents a parsed Media Type. For use in HTTP, the first (but only the first) `q` parameter will be parsed as a float.
Other parameters are available through the `params` object.
The first argument is the full media type, the second argument, if provided, is strictly a list of parameters.

The `toString` method converts the object back into a Media type.

```javascript
var p = new MediaType('text/html;level=1;q=0.5');
p.q === 0.5;
p.params.level === "1"

var q = new MediaType('application/json', {profile: 'http://example.com/schema.json'});
q.type === "application/json";
q.params.profile === "http://example.com/schema.json";

q.q = 1;
q.toString() === 'application/json;q=1;profile="http://example.com/schema.json"';
```

## parseMedia(type)
Returns a new instance of MediaType.

## splitQuotedString(str, delimiter, quote)
Splits a string by a delimiter character (default: semicolon), ignoring quoted sections (default: double quote).


## splitContentTypes(str)
Splits an Accept (or similar) header into an Array of strings of content-types.

```javascript
splitContentType('application/json, text/html').map(parseMedia)
```

## select(reps, accept)
Pick an ideal representation to send, given an Array of representations to choose from, and the client-preferred list as an Array.

See example.js for an example.

## mediaCmp(a, b)

Accepts two MediaType instances and tests them for being a subset/superset.

If a is a superset of b (b is smaller than a), return 1.
If b is a superset of a, return -1.
If they are the exact same, return 0.
If they are disjoint, return null.

The q-value, if any, is ignored.

```javascript
mediaCmp(parseMedia('text/html'), parseMedia('text/html')) === 0
mediaCmp(parseMedia('*/*'), parseMedia('text/html')) === 1
mediaCmp(parseMedia('text/html;level=1'), parseMedia('text/html')) === -1
mediaCmp(parseMedia('application/json;profile="v1.json"'), parseMedia('application/json;profile="v2.json"')) === null
```
