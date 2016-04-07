var MediaType = require('./content-type');

var representations = [
  'application/json',
  'text/html',
  'application/json;profile="schema.json"',
  'application/json;profile="different.json"',
  'application/json',
  'text/plain',
  '*/*'
];

var accept = [
  'text/html;q=0.50',
  '*/*;q=0.01',
  'application/json;profile=different.json',
  'application/json;profile="a,b;c.json?d=1;f=2";q=0.2'
];

var selected;
try {
  selected = MediaType.select(representations.map(MediaType.parseMedia), accept.map(MediaType.parseMedia));
} catch (e) {
  if (e.name === "UnacceptableError") {
    console.log("No valid type found");
    // Respond with 406
  } else {
    throw e;
  }
}

console.log('Formats:\n\t' + representations.map(MediaType.parseMedia).join('\n\t'));
// Formats:
//         application/json
//         text/html
//         application/json; profile=schema.json
//         application/json; profile=different.json
//         application/json
//         text/plain
//         */*

console.log('Accept:\n\t' + accept.map(MediaType.parseMedia).join('\n\t'));
// Accept:
//         text/html; q=0.5
//         */*; q=0.01
//         application/json; profile=different.json
//         application/json; profile="a,b;c.json?d=1;f=2"; q=0.2

console.log('Selected:', selected.toString());
// Selected: application/json; profile=different.json
