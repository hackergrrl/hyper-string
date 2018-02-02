var assert = require('assert')
var hyperlog = require('hyperlog')
var memdb = require('memdb')
var SafeIndex = require('./safe-index')
var fstring = require('fork-string')

function noop () {}

module.exports = HyperString

function HyperString (db, opts) {
  if (!(this instanceof HyperString)) { return new HyperString(db, opts) }

  opts = opts || {}
  opts.valueEncoding = 'json'

  this.log = hyperlog(db, opts)
  this.data = fstring()

  var self = this
  this.index = new SafeIndex({
    log: this.log,
    db: memdb(),  // for now
    init: function () {
      return { data: self.data }
    },
    map: indexMapFn
  })
}

function indexMapFn (index, row, next) {
  if (row.value.op === 'insert') {
    index.data.insert(row.value.prev, row.value.next, row.value.txt, row.key)
  } else if (row.value.op === 'delete') {
    index.data.delete(row.value.from, row.value.to, row.key)
  } else {
    // silently ignore other node types
    // return next(new Error('unsupported operation:', row.value.op))
  }

  next()
}

HyperString.prototype.insert = function (prev, next, string, done) {
  done = done || noop

  assert.equal(typeof done, 'function', 'function done required')
  assert.equal(typeof string, 'string', 'insertion string required')

  // TODO: check that prev and next are valid
  var op = {
    op: 'insert',
    txt: string,
    prev: prev,
    next: next
  }

  this.log.append(op, function (err, node) {
    var chars = string.split('').map(function (chr, i) {
      return {
        pos: node.key + '@' + i,
        chr: string[i]
      }
    })
    done(err, chars)
  })
}

HyperString.prototype.delete = function (from, to, done) {
  done = done || noop

  assert.equal(typeof done, 'function', 'function done required')
  assert.equal(typeof from, 'string', 'string from required')
  assert.equal(typeof to, 'string', 'string to required')

  // TODO: check that from and to are valid
  var op = {
    op: 'delete',
    from: from,
    to: to
  }

  this.log.append(op, function (err, node) {
    done(err)
  })
}

HyperString.prototype.chars = function (cb) {
  var self = this
  this.index.ready(function () {
    cb(null, self.data.chars())
  })
}

// The current state of the hyperstring, serialized to a plain string.
HyperString.prototype.text = function (cb) {
  var self = this
  this.index.ready(function () {
    cb(null, self.data.text())
  })
}

HyperString.prototype.createReadStream = function (opts) {
  return this.log.createReadStream(opts)
}

HyperString.prototype.createReplicationStream = function (opts) {
  return this.log.createReplicationStream(opts)
}
