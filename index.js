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
    if (!cb) return
    if (err) return cb(err)
    op.pos = node.key
    cb(null, op)
  })
}

HyperString.prototype.delete = function (at, cb) {
  // TODO: support ranges
  var op = {
    op: 'del',
    at: at || null
  }
  this.log.append(op, function (err, node) {
    if (!cb) return
    if (err) return cb(err)
    cb(null, op)
  })
}

// HyperString.prototype.createStringStream = function () {
// }

HyperString.prototype.createReadStream = function (opts) {
  return this.log.createReadStream(opts)
}
