/* global describe, it */

var MediaType = require('..');
require('should');
var chai = require('chai');
var expect = chai.expect;

var errors = require('../errors');

describe('parsing', function testSuite() {
  it('should parse q parameter as Float', function test() {
    var mediaType = new MediaType();
    mediaType.parseParameter('q=0.5');
    mediaType.q.should.be.an.instanceOf(Number);
  });

  it('should parse media type', function test() {
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

  it('should limit q to 3 decimal places', function test() {
    var p = new MediaType('text/*;q=0.00002');
    p.type.should.eql('text/*');
    p.toString().should.eql('text/*; q=0');
    p.q.should.eql(0); // TODO verify: 0, or 0.00002?
  });
});

describe('comparison', function tests() {
  it('should recognize wildcard type in comparison', function test() {
    var p = new MediaType('*/*');
    var q = new MediaType('text/plain');
    var r = MediaType.mediaCmp(p, q);
    expect(r).to.equal(1);
  });

  it('should recognize wildcard subtype in comparison', function test() {
    var p = new MediaType('text/*');
    var q = new MediaType('text/plain');
    var r = MediaType.mediaCmp(p, q);
    expect(r).to.equal(1);
  });

  it('should recognize type with params in comparison', function test() {
    var p = new MediaType('text/plain');
    var q = new MediaType('text/plain;p=2');
    var r = MediaType.mediaCmp(p, q);
    expect(r).to.equal(1);
  });

  it('should compare multiple parameters', function test() {
    var p = new MediaType('text/plain;p=2');
    var q = new MediaType('text/plain;p=2;s=8');
    var r = MediaType.mediaCmp(p, q);
    expect(r).to.equal(1);
  });

  it('should compare multiple disjoint parameters', function test() {
    var p = new MediaType('text/plain;p=5;s=8');
    var q = new MediaType('text/plain;p=2');
    var r = MediaType.mediaCmp(p, q);
    expect(r).to.equal(null);
  });
});

describe('specificity', function tests() {
  it('should evaluate * type as less specific', function test() {
    var a = new MediaType('*/*');
    var b = new MediaType('text/*');
    var p = MediaType.specificityCmp(a, b);
    p.should.eql(1);
  });

  it('should evaluate * subtype as less specific', function test() {
    var a = new MediaType('text/html');
    var b = new MediaType('text/*');
    var p = MediaType.specificityCmp(a, b);
    p.should.eql(-1);
  });

  it('should evaluate same types as equal specificity', function test() {
    var a = new MediaType('text/*');
    var b = new MediaType('text/html');
    var p = MediaType.specificityCmp(a, b);
    p.should.eql(1);
  });

  it('should evaluate more parameters as more specific', function test() {
    var a = new MediaType('text/html;p=1');
    var b = new MediaType('text/html');
    var p = MediaType.specificityCmp(a, b);
    p.should.eql(-1);
  });
});

describe('negotiation', function tests() {
  /*
   * from https://tools.ietf.org/html/rfc7231#section-5.3.2
   *
   * Accept: text/plain; q=0.5, text/html, text/x-dvi; q=0.8, text/x-c
   *
   * Verbally, this would be interpreted as "text/html and text/x-c are the
   * preferred media types, but if they do not exist, then send the text/x-dvi
   * entity, and if that does not exist, send the text/plain entity."
   */
  it('should select media type where preferred type is available', function test() {
    var representations = [
      'text/plain',
      'text/html',
      'text/x-dvi'
    ];
    var accept = MediaType.splitContentTypes('text/plain; q=0.5, text/html, text/x-dvi; q=0.8, text/x-c');
    var selected = (MediaType.select(
      representations.map(MediaType.parseMedia),
      accept.map(MediaType.parseMedia)
    )).toString();
    selected.should.equal('text/html');
  });

  it('should select preferred media type when Accept arg is a string and representations arg is an array of strings', function test() {
    var representations = [
      'text/plain',
      'text/html',
      'text/x-dvi'
    ];
    var accept = 'text/plain; q=0.5, text/html, text/x-dvi; q=0.8, text/x-c';
    var selected = (MediaType.select(
      representations,
      accept
    )).toString();
    selected.should.equal('text/html');
  });

  /*
   * from https://tools.ietf.org/html/rfc7231#section-5.3.2
   *
   * Accept: text/plain; q=0.5, text/html, text/x-dvi; q=0.8, text/x-c
   *
   * Verbally, this would be interpreted as "text/html and text/x-c are the
   * preferred media types, but if they do not exist, then send the text/x-dvi
   * entity, and if that does not exist, send the text/plain entity."
   */
  it('should select media type where most preferred type is not available', function test() {
    var representations = [
      'text/plain',
      'text/x-dvi',
      'application/json'
    ];
    var accept = MediaType.splitContentTypes('text/plain; q=0.5, text/html, text/x-dvi; q=0.8, text/x-c');
    var selected = (MediaType.select(
      representations.map(MediaType.parseMedia),
      accept.map(MediaType.parseMedia)
    )).toString();
    selected.should.equal('text/x-dvi');
  });

  /*
   * from https://tools.ietf.org/html/rfc7231#section-5.3.2
   *
   * Media ranges can be overridden by more specific media ranges or specific
   * media types. If more than one media range applies to a given type, the
   * most specific reference has precedence. For example,
   *
   *       Accept: text/*, text/html, text/html;level=1, * /*
   *
   * have the following precedence:
   *
   *       1) text/html;level=1
   *       2) text/html
   *       3) text/*
   *       4) * /*
   */
  it('should select media type where most specific matching type takes precedence', function test() {
    var representations = [
      'application/json',
      'text/plain',
      'text/html',
      'text/html;level=1'
    ];
    var accept = MediaType.splitContentTypes('text/*, text/html, text/html;level=1, */*');
    var selected = (MediaType.select(
      representations.map(MediaType.parseMedia),
      accept.map(MediaType.parseMedia)
    )).toString();
    selected.should.equal('text/html; level=1');
  });

  /*
   * Extension of above, what should happen if more specific representation available than specified in Accept?
   */
  it('should select media type where most specific matching type takes precedence (specific beyond Accept)', function test() {
    var representations = [
      'application/json',
      'text/plain',
      'text/html',
      'text/html;level=1',
      'text/html;level=1;other=4'
    ];
    var accept = MediaType.splitContentTypes('text/*, text/html, text/html;level=1, */*');
    var selected = (MediaType.select(
      representations.map(MediaType.parseMedia),
      accept.map(MediaType.parseMedia)
    )).toString();
    selected.should.equal('text/html; level=1; other=4');
  });

  it('should select preferred type based on matching parameters', function test() {
    var scenarios = [
        {
          representations: [
            "text/html;level=2",
            "text/html;level=3"
          ],
          expected: "text/html; level=3"
        }
    ];
    //var accept = MediaType.splitContentTypes('text/*;q=0.3, text/html;q=0.7, text/html;level=2;q=0.4');
    var accept = MediaType.splitContentTypes('text/html;q=0.7, text/html;level=2;q=0.4');
    var selected;
    var scenario;
    for (var i = 0; i < scenarios.length; i++) {
      scenario = scenarios[i];
      selected = (MediaType.select(
        scenario.representations.map(MediaType.parseMedia),
        accept.map(MediaType.parseMedia)
      )).toString();
      var errorString = "selected media type does not match expected for representations " + scenario.representations.join(',');
      expect(selected, errorString).to.equal(scenario.expected);
    }
  });

  /*
   * from https://tools.ietf.org/html/rfc7231#section-5.3.2
   *
   * The media type quality factor associated with a given type is determined by
   * finding the media range with the highest precedence which matches that
   * type. For example,
   *
   *       Accept: text/*;q=0.3, text/html;q=0.7, text/html;level=1,
   *               text/html;level=2;q=0.4, * /*;q=0.5
   *
   * would cause the following values to be associated:
   *
   *       text/html;level=1         = 1
   *       text/html                 = 0.7
   *       text/plain                = 0.3
   *
   *       image/jpeg                = 0.5
   *       text/html;level=2         = 0.4
   *       text/html;level=3         = 0.7
   */
  it('should return media type with the highest precedence matching the type', function test() {
    var scenarios = [
        {
          representations: [
            "text/html;level=1", //1st
            "text/html", //2nd or 3rd, not clear
            "text/plain", //6th
            "image/jpeg", //4th
            "text/html;level=2", //5th
            "text/html;level=3" //2nd or 3rd, not clear
          ],
          expected: "text/html; level=1"
        },
        {
          representations: [
            "text/html",
            "text/plain",
            "image/jpeg",
            "text/html;level=2",
            "text/html;level=3"
          ],
          expected: "text/html; level=3"
        },
        {
          representations: [
            "text/html",
            "text/plain",
            "image/jpeg",
            "text/html;level=2"
          ],
          expected: "text/html"
        },
        {
          representations: [
            "text/plain",
            "image/jpeg",
            "text/html;level=2"
          ],
          expected: "image/jpeg"
        },
        {
          representations: [
            "text/plain",
            "text/html;level=2"
          ],
          expected: "text/html; level=2"
        },
        {
          representations: [
            "application/json",
            "text/plain"
          ],
          expected: "text/plain"
        }
    ];
    var accept = MediaType.splitContentTypes('text/*;q=0.3, application/json;q=0.1, text/html;q=0.7, text/html;level=1, text/html;level=2;q=0.4, */*;q=0.5');
    var selected;
    var scenario;
    for (var i = 0; i < scenarios.length; i++) {
      scenario = scenarios[i];
      selected = (MediaType.select(
        scenario.representations.map(MediaType.parseMedia),
        accept.map(MediaType.parseMedia)
      )).toString();
      var errorString = "selected media type does not match expected for representations " + scenario.representations.join(',');
      expect(selected, errorString).to.equal(scenario.expected);
    }
  });

  /*
   * in this test, `text/html` and `text/plain` would be equal, but the
   * representation specifies a q factor, which should be used to determine
   * the precedence
   */
  it("should use server q when client preferred q's match", function test() {
    var representations = [
      "text/html; q=.5",
      "text/plain",
      "image/jpeg; q=.75"
    ];
    var accept = MediaType.splitContentTypes('text/html, text/plain, */*;q=0.1');
    var selected = (MediaType.select(
      representations.map(MediaType.parseMedia),
      accept.map(MediaType.parseMedia)
    ) || 'None').toString();
    selected.should.equal('text/plain');
  });
  it("should prefer q=0.9 and q=0.7 to q=1 and q=0.5", function test() {
    var representations = [
      "text/html; q=.9",
      "text/plain; q=.5",
      "image/jpeg; q=.75"
    ];
    var accept = MediaType.splitContentTypes('text/html;q=0.7, text/plain, */*;q=0.1');
    var selected = (MediaType.select(
      representations.map(MediaType.parseMedia),
      accept.map(MediaType.parseMedia)
    ) || 'None').toString();
    selected.should.equal('text/html');
  });
  it("should prefer q=1 and q=0.5 to q=0.7 and q=0.7", function test() {
    var representations = [
      "text/html; q=.7",
      "text/plain; q=.5",
      "image/jpeg"
    ];
    var accept = MediaType.splitContentTypes('text/html;q=0.7, text/plain, */*;q=0.1');
    var selected = (MediaType.select(
      representations.map(MediaType.parseMedia),
      accept.map(MediaType.parseMedia)
    ) || 'None').toString();
    selected.should.equal('text/plain');
  });

  /*
   * from https://tools.ietf.org/html/rfc7231#section-5.3.2
   *
   * If an Accept header field is present, and if the server cannot send a
   * response which is acceptable according to the combined Accept field value,
   * then the server SHOULD send a 406 (not acceptable) response
   */
  it('should throw error if no acceptable type found', function test() {
    var representations = [
      'text/plain',
      'text/x-dvi',
      'application/json'
    ];
    var accept = MediaType.splitContentTypes('text/json; q=0.5, application/xml');
    (MediaType.select.bind(
      MediaType,
      representations.map(MediaType.parseMedia),
      accept.map(MediaType.parseMedia)
    )).should.throw(errors.UnacceptableError);
  });

  it('should throw error if no acceptable type with parameters found', function test() {
    var representations = [
      'text/plain',
      'text/x-dvi',
      'application/json'
    ];
    var accept = MediaType.splitContentTypes('text/plain;level=1');
    (MediaType.select.bind(
      MediaType,
      representations.map(MediaType.parseMedia),
      accept.map(MediaType.parseMedia)
    )).should.throw(errors.UnacceptableError);
  });

  /*
   * from https://tools.ietf.org/html/rfc7231#section-5.3.2
   *
   * If no Accept header field is present, then it is assumed that the client
   * accepts all media types.
   */
  it('should assume "*/*" if Accept string empty', function test() {
    var representations = [
      'text/plain',
      'text/x-dvi',
      'application/json'
    ];
    var accept = MediaType.splitContentTypes('');
    var selected = (MediaType.select(
      representations.map(MediaType.parseMedia),
      accept.map(MediaType.parseMedia)
    )).toString();
    selected.should.equal('text/plain');
  });

  /*
   * from https://tools.ietf.org/html/rfc7231#section-5.3.2
   *
   * If no Accept header field is present, then it is assumed that the client
   * accepts all media types.
   */
  it('should assume "*/*" if Accept string null', function test() {
    var representations = [
      'text/plain',
      'text/x-dvi',
      'application/json'
    ];
    var accept = MediaType.splitContentTypes(null);
    var selected = (MediaType.select(
      representations.map(MediaType.parseMedia),
      accept.map(MediaType.parseMedia)
    )).toString();
    selected.should.equal('text/plain');
  });

  /*
   * from https://tools.ietf.org/html/rfc7231#section-5.3.2
   *
   * If no Accept header field is present, then it is assumed that the client
   * accepts all media types.
   */
  it('should assume "*/*" if Accept string undefined', function test() {
    var representations = [
      'text/plain',
      'text/x-dvi',
      'application/json'
    ];
    var accept = MediaType.splitContentTypes(undefined);
    var selected = (MediaType.select(
      representations.map(MediaType.parseMedia),
      accept.map(MediaType.parseMedia)
    )).toString();
    selected.should.equal('text/plain');
  });
});
