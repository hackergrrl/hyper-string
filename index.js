var hyperlog = require('hyperlog')

module.exports = HyperString

function HyperString (db, opts) {
  if (!(this instanceof HyperString)) { return new HyperString(db, opts) }

  opts = opts || {}
  opts.valueEncoding = 'json'

  this.log = hyperlog(db, opts)
}

HyperString.prototype.insert = function (prev, chr, cb) {
  // TODO: check that it's a single character
  // TODO: support inserting a whole string, and breaking it up into
  // one-char inserts
  var op = {
    op: 'insert',
    chr: chr,
    prev: prev || null
  }
  this.log.append(op, function (err, node) {
    var res = {
      op: op.op,
      chr: op.chr,
      prev: op.prev,
      key: node.key
    }
    if (cb) cb(null, res)
  })
}

HyperString.prototype.delete = function (at, cb) {
  process.nextTick(function () { cb(null) })
}

// HyperString.prototype.createStringStream = function () {
// }

HyperString.prototype.createReadStream = function (opts) {
  return this.log.createReadStream(opts)
}
