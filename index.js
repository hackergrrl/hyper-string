var assert = require('assert')
var hyperlog = require('hyperlog')
var memdb = require('memdb')
var debug = require('debug')('hyper-string')
var SafeIndex = require('./safe-index')

function noop () {}

module.exports = HyperString

function HyperString (db, opts) {
  if (!(this instanceof HyperString)) { return new HyperString(db, opts) }

  opts = opts || {}
  opts.valueEncoding = 'json'

  this.log = hyperlog(db, opts)

  // Representation of the string's current state, as a DAG.
  // This makes traversal from the beginning of the document quick!
  this.index = new SafeIndex({
    log: this.log,
    db: memdb(),  // for now
    init: function () {
      return {
        dag: {},
        roots: []
      }
    },
    map: indexMapFn
  })
}

function indexMapFn (index, row, next) {
  if (row.value.op === 'insert') {
    insertRow()
    debug('INDEX stringDag[' + row.key + '] = ' + row.value.chr)
  } else if (row.value.op === 'delete') {
    deleteRow()
  } else {
    // silently ignore other node types
    // return next(new Error('unsupported operation:', row.value.op))
  }

  next()

  function insertRow () {
    // add links
    if (row.value.prev) {
      // ensure 'prev' is known, if set
      var prev = index.dag[row.value.prev]
      if (!prev) {
        return next(new Error('ERR: entry references unknown "prev": "' + row.value.prev + '" -- skipping'))
      }
      prev.links.unshift(row.key)
    } else {
      // set as a root if no hyperlog links
      index.roots.unshift(row.key)
      index.roots.sort()
    }

    // add character
    index.dag[row.key] = {
      chr: row.value.chr,
      links: []
    }
  }

  function deleteRow () {
    var entry = index.dag[row.value.at]
    if (entry) {
      entry.deleted = true
    } else {
      return next(new Error('tried to delete non-existent ID: ' + row.value.at))
    }
  }
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

    function runInsert (chr, prev, cb) {
      var op = {
        op: 'insert',
        chr: chr,
        prev: prev || null
      }

      // TODO(noffle): hack to prevent new strings /w no 'prev' from having the
      // same hash. This would trigger a bug in hyperlog-index:
      // https://github.com/substack/hyperlog-index/issues/8
      if (!prev) {
        op.nonce = Math.random().toString(16).substring(2)
      }

      self.log.append(op, function (err, node) {
        if (err) return cb(err)
        op.pos = node.key
        cb(null, op)
      })
    }
  }
}

HyperString.prototype.delete = function (at, count, done) {
  done = done || noop

  assert.equal(typeof done, 'function', 'function done required')
  assert.equal(typeof at, 'string', 'string at required')
  assert.equal(typeof count, 'number', 'number count required')
  assert.ok(count >= 0, 'count must be non-negative')

  var self = this

  self.chars(function (err, chars) {
    if (err) return done(err)

    var removePositions = getRemovePositions(chars, count)

    doDelete(removePositions, done)
  })

  function getRemovePositions (chars, count) {
    var removePositions = []
    var deleting = false
    for (var i = 0; i < chars.length && count > 0; i++) {
      if (chars[i].pos === at) {
        deleting = true
      }
      if (deleting) {
        removePositions.push(chars[i].pos)
        count--
      }
    }
    return removePositions
  }

  function doDelete (removePositions, cb) {
    var results = []
    var n = 0

    function deleteNext (err, op) {
      n++
      if (err) return cb(err, results)
      if (op) results.push(op)
      if (n === removePositions.length) return cb(null, results)
      deleteCharAt(removePositions[n], deleteNext)
    }

    n = -1
    deleteNext(null, null)

    function deleteCharAt (at, cb) {
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
}

HyperString.prototype.chars = function (cb) {
  this.index.ready(function (index) {
    var string = indexToCharData(index)
    if (cb) cb(null, string)
  })

  function indexToCharData (index) {
    var string = []
    var queue = index.roots.slice()

    while (queue.length > 0) {
      var key = queue.shift()
      var dagnode = index.dag[key]
      if (!dagnode.deleted) {
        var elem = {
          chr: dagnode.chr,
          pos: key
        }
        string.push(elem)
      }
      queue = dagnode.links.concat(queue)
    }

    return string
  }
}

// The current state of the hyperstring, serialized to a plain string.
HyperString.prototype.text = function (cb) {
  this.chars(function (err, chars) {
    if (err) return cb(err)

    var text = chars.map(function (c) { return c.chr })
    text = text.join('')

    cb(null, text)
  })
}

HyperString.prototype.createReadStream = function (opts) {
  return this.log.createReadStream(opts)
}

HyperString.prototype.createReplicationStream = function (opts) {
  return this.log.createReplicationStream(opts)
}
