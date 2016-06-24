var hyperlog = require('hyperlog')
var hindex = require('hyperlog-index')
var memdb = require('memdb')

module.exports = HyperString

function HyperString (db, opts) {
  if (!(this instanceof HyperString)) { return new HyperString(db, opts) }

  opts = opts || {}
  opts.valueEncoding = 'json'

  this.log = hyperlog(db, opts)

  // Representation of the string's current state, as a DAG.
  // This makes traversal from the beginning of the document quick!
  var stringDag = {}
  this.index = hindex({
    log: this.log,
    db: memdb(),  // for now, separate in-memory
    map: function (row, next) {
      if (row.value.op === 'insert') {
        // add character
        var character = {
          chr: row.value.chr,
          links: []
        }
        stringDag[row.key] = character

        // add links
        if (row.value.prev) {
          var prev = stringDag[row.value.prev]
          if (!prev) throw new Error('woah, this should never happen!')
          prev.links.push(row.key)
        }
      } else {
        throw new Error('unsupported operation: ' + row.value.op)
      }
      next()
    }
  })

  this.index.ready(function () {
//    console.log('READY', stringDag)
  })
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
