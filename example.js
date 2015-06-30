var parseMedia = require('./contenttype').parseMedia;
var select = require('./contenttype').select;
var splitQuotedString = require('./contenttype').splitQuotedString;

var representations =
	[ 'text/html'
	, 'text/turtle'
	, 'application/json;q=1;profile="base.json"'
	, 'application/json;q=1;profile="schema.json?x=y"'
	, 'application/json;q=1;profile="http://example.com/s.json"'
	, 'application/json;q=1'
	, 'text/plain;q=0.2'
	, 'text/*;q=0.00002' // ABNF limits to three decimal places, this will toString() as "0"
	, '*/*;q=0'
	];
var accept = splitQuotedString('application/json, application/json;profile="a,b;c.json?d=1;f=2";q=0.2 text/turtle, text/html;q=0.50, */*;q=0.01', ',');

console.log('Formats:\n\t'+representations.map(parseMedia).join('\n\t'));
console.log('Accept:\n\t'+accept.map(parseMedia).join('\n\t'));
console.log('Selected:', (select(representations.map(parseMedia), accept.map(parseMedia))||'None').toString());
