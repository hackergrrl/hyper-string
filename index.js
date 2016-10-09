var assert = require('assert')
var hyperlog = require('hyperlog')
var hindex = require('hyperlog-index')
var memdb = require('memdb')
var debug = require('debug')('hyper-string')

function noop () {}

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

        // ensure 'prev' is known, if set
        if (row.value.prev) {
          var prev = self.stringDag[row.value.prev]
          if (!prev) {
            debug('ERR: entry references unknown "prev": "' + row.value.prev + '" -- skipping')
            return next()
          }
        }

        // add character
        var character = {
          chr: row.value.chr,
          links: []
        }
        self.stringDag[row.key] = character
        debug('stringDag['+row.key+'] = ' + character.chr)

        // add links
        if (row.value.prev) {
          var prev = self.stringDag[row.value.prev]
          if (!prev) throw new Error('this should NOT happen')
          prev.links.unshift(row.key)
        }

        // set as a root if no hyperlog links
        if (!row.value.prev) {
          self.stringRoots.unshift(row.key)
        }
      } else if (row.value.op === 'delete') {
        var entry = self.stringDag[row.value.at]
        if (entry) {
          entry.deleted = true
        } else {
          throw new Error('tried to delete non-existent ID: ' + row.value.at)
        }
      } else {
        throw new Error('unsupported operation:', row.value.op)
      }
      next()
    }
  })
}

HyperString.prototype.insert = function (prev, string, done) {
  done = done || noop

  assert.equal(typeof done, 'function', 'function done required')
  assert.equal(typeof string, 'string', 'insertion string required')

  var self = this
  var results = []
  var chars = string.split('')

  // TODO: use hyperlog#batch
  // https://github.com/mafintosh/hyperlog#logbatchdocs-opts-cb

  insertNext()

  function insertNext (error, op) {
    if (error) return done(error, results)
    if (op) results.push(op)
    if (!chars.length) return done(null, results)

    runInsert(chars.shift(), op ? op.pos : prev, insertNext)
  }

  function runInsert (chr, prev, cb) {
    var op = {
      op: 'insert',
      chr: chr,
      prev: prev || null
    }

    self.log.append(op, function (err, node) {
      if (err) return cb(err)
      op.pos = node.key
      cb(null, op)
    })
  }
}

HyperString.prototype.delete = function (at, count, done) {
  done = done || noop

  assert.equal(typeof done, 'function', 'function done required')
  assert.equal(typeof at, 'string', 'string at required')
  assert.equal(typeof count, 'number', 'number count required')
  assert.ok(count >= 0, 'count must be non-negative')

  var self = this
  var removePositions = []
  var results = []

  self.chars(function (err, chars) {
    if (err) return done(err)

    var deleting = false
    for (var i = 0; i < chars.length; i++) {
      if (!count) break

      if (chars[i].pos === at) {
        deleting = true
      }
      if (deleting) {
        removePositions.push(chars[i].pos)
        count -= 1
      }
    }

    deleteNext()
  })

  function deleteNext (error, op) {
    if (error) return done(error, results)
    if (op) results.push(op)
    if (!removePositions.length) return done(null, results)

    runDelete(removePositions.shift(), deleteNext)
  }

  function runDelete (at, cb) {
    // TODO: support ranges
    var op = {
      op: 'delete',
      at: at || null
    }
    self.log.append(op, function (err, node) {
      if (err) return cb(err)
      cb(null, op)
    })
  }
}

HyperString.prototype.chars = function (cb) {
  var string = []

  var self = this
  this.index.ready(function () {
    var queue = []
    for (var i = 0; i < self.stringRoots.length; i++) {
      queue.push(self.stringRoots[i])
    }

    while (queue.length > 0) {
      var key = queue.shift()
      var dagnode = self.stringDag[key]
      if (!dagnode.deleted) {
        var elem = {
          chr: dagnode.chr,
          pos: key
        }
        string.push(elem)
      }
      queue = dagnode.links.concat(queue)
    }

    if (cb) cb(null, string)
  })
}

HyperString.prototype.text = function (cb) {
  this.chars(function (err, text) {
    if (err) return cb(err)
    cb(null, text.map(function (c) { return c.chr }).join(''))
  })
}

HyperString.prototype.createReadStream = function (opts) {
  return this.log.createReadStream(opts)
}

HyperString.prototype.createReplicationStream = function (opts) {
  return this.log.createReplicationStream(opts)
}
