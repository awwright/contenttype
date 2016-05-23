/* global describe, it */

var MediaType = require('../contenttype.js').MediaType;
require('should');

describe('parsing', function testSuite() {
	it('should parse q parameter as Float', function test() {
		var mediaType = new MediaType();
		mediaType.parseParameter('q=0.5');
		mediaType.q.should.be.an.instanceOf(Number);
	});

	it('should parse media type string', function test() {
		var p = new MediaType('text/html;level=1;q=0.5');
		p.type.should.eql('text/html');
		p.q.should.eql(0.5);
		p.params.should.eql({
			level: '1'
		});
	});

	it('should parse media type with spaces', function test() {
		var p = new MediaType('text/html; level=1; q=0.5');
		p.type.should.eql('text/html');
		p.q.should.eql(0.5);
		p.params.should.eql({
			level: '1'
		});
	});

	it('should create MediaType with params override', function test() {
		var p = new MediaType('text/html;level=1', {level: 2});
		p.type.should.eql('text/html');
		p.params.should.eql({
			level: '2' //string, not int
		});
	});

	it('should limit q to 3 decimal places', function test() {
		var p = new MediaType('text/*;q=0.00002');
		p.type.should.eql('text/*');
		p.toString().should.eql('text/*; q=0');
		p.q.should.eql(0); // TODO verify: 0, or 0.00002?
	});
});
