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
        nodes: {},
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

  function link (fromKey, toKey) {
    var from = index.nodes[fromKey]
    var to = index.nodes[toKey]

    from.outgoingLinks.push(toKey)
    to.incomingLinks.push(fromKey)
  }

  next()

  function insertRow () {
    var chars = []

    // create individual character entries & link them into the dag
    for (var i = 0; i < row.value.txt.length; i++) {
      var key = row.key + '@' + i
      index.nodes[key] = {
        chr: row.value.txt[i],
        outgoingLinks: [],
        incomingLinks: []
      }
      chars.push(key)

      // link 1st character and 'prev'
      if (i === 0) {
        link(row.value.prev, key)
      }

      // link this character to the previous one
      if (i > 0) {
        link(chars[i - 1], key)
      }

      // link last character to 'next'
      if (i === row.value.txt.length - 1 && row.value.next) {
        link(key, row.value.next)
      }
    }

    // If not prev, make it a root
    if (!row.value.prev) {
      index.roots[chars[0]] = chars[0]
    }
  }

  function deleteRow () {
    throw new Error('haha nowhere close to be implemented')
  }
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
    done(err)
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
