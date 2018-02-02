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

    if (!from || !to) return

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

    // If no prev, make it a root
    // Case 1: no prev + no next => new root
    if (!row.value.prev && !row.value.next) {
      index.roots.push(chars[0])
      index.roots.sort()
    }
    // Case 2: no prev + valid next => new root (replace old root)
    else if (!row.value.prev) {
      // Find + cull the old root
      for (var i = 0; i < index.roots.length; i++) {
        var root = index.roots[i]
        if (row.value.next === root) {
          index.roots.splice(i, 1)
        }
      }
      // Add the new root
      index.roots.push(chars[0])
      index.roots.sort()
    }
  }

  // mark all affected characters as deleted
  function deleteRow () {
    var visited = {}
    var stack = [row.value.from]

    while (stack.length > 0) {
      var key = stack.pop()

      if (visited[key]) {
        continue
      }

      var dagnode = index.nodes[key]

      // bail if there are other nodes to visit before this one
      var needToBail = false
      for (var i = 0; i < dagnode.incomingLinks.length; i++) {
        if (!visited[dagnode.incomingLinks[i]] && key !== row.value.from) {
          needToBail = true
        }
      }
      if (needToBail) continue

      index.nodes[key].deleted = true
      visited[key] = true

      if (key === row.value.to) {
        break
      }

      stack.push.apply(stack, dagnode.outgoingLinks)
    }
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
  this.index.ready(function (index) {
    var string = indexToCharData(index)
    if (cb) cb(null, string)
  })

  function indexToCharData (index) {
    var string = []
    var visited = {}
    var stack = index.roots.slice()

    while (stack.length > 0) {
      var key = stack.pop()

      if (visited[key]) {
        continue
      }

      var dagnode = index.nodes[key]

      // bail if there are other nodes to visit before this one
      var needToBail = false
      for (var i = 0; i < dagnode.incomingLinks.length; i++) {
        if (!visited[dagnode.incomingLinks[i]]) {
          needToBail = true
        }
      }
      if (needToBail) continue

      if (!dagnode.deleted) {
        var elem = {
          chr: dagnode.chr,
          pos: key
        }
        string.push(elem)
      }
      visited[key] = true
      stack.push.apply(stack, dagnode.outgoingLinks)
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
