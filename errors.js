// Include external dependencies
var util = require('util');

module.exports = {
  UnacceptableError: function UnacceptableError(message) {
    Error.call(this);
    Error.captureStackTrace(this, this.constructor);
    this.name = "UnacceptableError";
    this.statusCode = 406;
    this.message = message || "Not Acceptable";
  }
};

util.inherits(module.exports.UnacceptableError, Error);
