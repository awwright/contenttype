# Content-Type parsing

*note: forked from [here](https://github.com/Acubed/contenttype)*

## Usage

Parse
```
var MediaType = require('content-type');

var type = MediaType.parseMedia('text/html;q=1');
console.log(type);
// MediaType { type: 'text/html', params: {}, q: 1 }

```

Express
```
var MediaType = require('content-type');
var representations = [
  'application/json',
  'text/html'
];

app.use(function (req, res, next) {
  try {
    var representation = MediaType.select(representations, req.headers.accept);
    res.rep = representation;
  } catch (e) {
    if (e.name === "UnacceptableError") {
      res.status(e.statusCode); //406
      res.json({error: "No valid content-type found for specified Accept header"});
    } else {
      throw e;
    }
  }
  next();
});

app.get('/', function (req, res, next) {
  res.set("Content-Type", res.rep);
  if (res.rep === "application/json") {
    res.json({message: "hello"});
  } else if (res.rep === "text/html") {
    res.send("hello");
  }
});
```

#### `new MediaType(type, [parameters])`

The MediaType "class" represents a parsed Media Type. For use in HTTP, the `q` parameter will be parsed as a float.
Other parameters are available through the `params` object.

Example
```
console.log(new MediaType('text/html;l=3;q=0.7', { p: 4 }));
// MediaType { type: 'text/html', params: { l: '3', p: '4' }, q: 0.7 }
```

Example
```
console.log(new MediaType('text/html;l=3', 'p=4;l=5;q=1'));
// MediaType { type: 'text/html', params: { l: '5', p: '4' }, q: 1 }
```

Example
```
var type = new MediaType('text/html;l=3', 'p=4;l=5');
console.log(new MediaType(type, 'p=6;'));
// MediaType { type: 'text/html', params: { l: '5', p: '6' } }
```

#### `toString()`

Convert a MediaType object to a string

Example
```
var type = new MediaType('text/html;l=3;q=0.5');
console.log(type.toString());
// "text/html; l=5; q=0.5"
```

#### parseMedia(type)
Parse a media type. Returns a new instance of MediaType.

Example
```
var type = MediaType.parseMedia('text/html;l=3');
console.log(type);
// MediaType { type: 'text/html', params: { l: '3' } }
```


#### splitQuotedString(str, [delimiter=';'], [quote='"'])
Splits a string by a delimiter character (default: semicolon), ignoring sections enclosed by quotes (default: double quote).

Example
```
var items = MediaType.splitQuotedString("text/html;level=2;q=1");
console.log(items);
// [ 'text/html', 'level=2', 'q=1' ]
```

#### splitContentTypes(str)
Convenience method for `splitQuotedString(str, ',', '"');`. Splits an Accept (or similar) header into an Array of content-types strings

Example
```
var types = MediaType.splitContentTypes("text/html;level=2;q=1,application/json,*/*");
console.log(types);
// [ 'text/html;level=2;q=1', 'application/json', '*/*' ]
```

Example
```javascript
var types = MediaType.splitContentTypes('application/json, text/html').map(MediaType.parseMedia);
console.log(types);
// [ MediaType { type: 'application/json', params: {} }, MediaType { type: 'text/html', params: {} } ]
```

#### select(representations, accept)
Pick an ideal representation to send, given an array of representations (strings or MediaTypes) to choose from, and the client-preferred Accept list (as a string, an array of strings, or an array of MediaTypes). Multiplies client type's quality factor by server type's quality factor

Example
```javascript
var representations = [
  "text/html; q=0.7",
  "text/plain; q=0.5",
  "image/jpeg"
];
var accept = MediaType.splitContentTypes('text/html;q=0.7, text/plain, */*;q=0.1');
var selected = (MediaType.select(representations, accept)).toString();
// text/html gets q=0.49, text/plain gets q=0.5, image/jpeg gets q=0.1
console.log(selected);
// "text/plain"
```

#### mediaCmp(a, b)

Accepts two MediaType instances and tests them for being a subset/superset.

If a is a superset of b (b is smaller than a), return 1.
If b is a superset of a, return -1.
If they are the exact same, return 0.
If they are disjoint, return null.

The q-value, if any, is ignored.

Example
```javascript
mediaCmp(parseMedia('text/html'), parseMedia('text/html')) === 0
mediaCmp(parseMedia('*/*'), parseMedia('text/html')) === 1
mediaCmp(parseMedia('text/html;level=1'), parseMedia('text/html')) === -1
mediaCmp(parseMedia('application/json;profile="v1.json"'), parseMedia('application/json;profile="v2.json"')) === null
```
