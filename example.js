var parseMedia = require('./contenttype').parseMedia;
var select = require('./contenttype').select;
var splitQS = require('./contenttype').splitQS;

var representations =
	[ 'text/html'
	, 'text/turtle'
	, 'application/json;q=1;profile="schema.json?x=y"'
	, 'application/json;q=1'
	];
var accept = splitQS('application/json, application/json;profile="a,b;c.json?d=1;f=2";q=0.2 text/turtle, text/html;q=0.50, */*;q=0.01', ',');

console.log('Formats:\n\t'+representations.map(parseMedia).join('\n\t'));
console.log('Accept:\n\t'+accept.map(parseMedia).join('\n\t'));
console.log('Selected:', (select(representations.map(parseMedia), accept.map(parseMedia))||'None').toString());
