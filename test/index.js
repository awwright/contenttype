/* global describe, it */

var MediaType = require('..');
require('should');

describe('parsing', function () {
    it('should parse q parameter as Float', function () {
        var mediaType = new MediaType();
        mediaType.parseParameter('q=0.5');
        mediaType.q.should.be.an.instanceOf(Number);
    });

    it('should parse media type', function () {
        var p = new MediaType('text/html;level=1;q=0.5');
        p.type.should.eql('text/html');
        p.q.should.eql(0.5);
        p.params.should.eql({ level: '1' });
    });

    it('should parse media type with spaces', function () {
        var p = new MediaType('text/html; level=1; q=0.5');
        p.type.should.eql('text/html');
        p.q.should.eql(0.5);
        p.params.should.eql({ level: '1' });
    });
});
