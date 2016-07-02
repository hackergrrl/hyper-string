var hyperlog = require('hyperlog')
var hindex = require('hyperlog-index')
var memdb = require('memdb')
var through = require('through2')

module.exports = HyperString

function HyperString (db, opts) {
  if (!(this instanceof HyperString)) { return new HyperString(db, opts) }

  opts = opts || {}
  opts.valueEncoding = 'json'

  this.log = hyperlog(db, opts)

  // Representation of the string's current state, as a DAG.
  // This makes traversal from the beginning of the document quick!
  this.stringDag = {}
  this.stringRoots = []
  var self = this
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
        self.stringDag[row.key] = character

        // add links
        if (row.value.prev) {
          var prev = self.stringDag[row.value.prev]
          if (!prev) throw new Error('woah, this should never happen!')
          prev.links.push(row.key)
        }

        // set as a root if no hyperlog links
        if (!row.value.prev) {
          self.stringRoots.push(row.key)
        }
      } else {
        self.stringDag[row.value.at].deleted = true
        // throw new Error('unsupported operation: ' + row.value.op)
      }
      next()
    }
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
    op: 'delete',
    at: at || null
  }
  this.log.append(op, function (err, node) {
    if (!cb) return
    if (err) return cb(err)
    cb(null, op)
  })
}

HyperString.prototype.chars = function (cb) {
  var string = []

  var self = this
  this.index.ready(function () {
    var queue = []
    for (var i=0; i < self.stringRoots.length; i++) {
      queue.push(self.stringRoots[i])
    }

    while (queue.length > 0) {
      var key = queue.pop()
      var dagnode = self.stringDag[key]
      if (!dagnode.deleted) {
        var elem = {
          chr: dagnode.chr,
          pos: key
        }
        string.push(elem)
      }
      queue = queue.concat(dagnode.links)
    }

    if (cb) cb(null, string)
  })
}

HyperString.prototype.text = function (cb) {
  this.chars(function (err, text) {
    cb(null, text.map(function (c) { return c.chr }).join(''))
  })
}

HyperString.prototype.createReadStream = function (opts) {
  return this.log.createReadStream(opts)
}
