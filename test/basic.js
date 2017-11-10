/* eslint-disable handle-callback-err */

var test = require('tape')
var hstring = require('../')
var memdb = require('memdb')
var concat = require('concat-stream')

test('insertions', function (t) {
  t.plan(12)

  var str = hstring(memdb())

  str.insert(null, null, 'H', function (err, chars) {
    t.notOk(err)
    t.deepEqual(chars, ['afbbcabffe1f75c9d010286669e75ec7149e47471462c69ca1f2bb56a9117524@0'])
    str.insert(chars[0], null, 'e', function (err, chars2) {
      t.notOk(err)
      t.deepEqual(chars2, ['4723f92bbe631f53f5cdf4bb49cb226cb4f6bdda12a15d694c1201e76458b483@0'])
      str.insert(chars2[0], null, 'y', function (err, chars3) {
        t.notOk(err)
        t.deepEqual(chars3, ['0a81237d1d6a4baf4832ec9375d67a554725fb8fad6427503ff26518d2082104@0'])

        str.createReadStream().pipe(concat(function (ops) {
          t.equal(ops.length, 3)
          t.equal(ops[0].value.txt, 'H')
          t.equal(ops[1].value.txt, 'e')
          t.equal(ops[1].value.prev, ops[0].key + '@0')
          t.equal(ops[2].value.txt, 'y')
          t.equal(ops[2].value.prev, ops[1].key + '@0')
        }))
      })
    })
  })
})

test('insert with same prev twice', function (t) {
  t.plan(1)
  var str = hstring(memdb())

  str.insert(null, null, 'Hello', function (err, ops) {
    str.insert(ops[0], ops[1], 'ey', function (err, _) {
      str.insert(ops[0], ops[1], 'ola', function (err, _) {
        str.text(function (err, text) {
          t.equal(text, 'Holaeyello')
        })
      })
    })
  })
})

test('deletions', function (t) {
  t.plan(4)

  var str = hstring(memdb())

  str.insert(null, null, 'beep boop', function (err, ops) {
    t.error(err)
    str.delete(ops[1], ops[7], function (err) {
      t.error(err)
      str.text(function (err, text) {
        t.error(err)
        t.equals(text, 'bp')
      })
    })
  })
})

test('insert: invalid input errors', function (t) {
  t.plan(1)
  var str = hstring(memdb())

  t.throws(function () {
    str.insert(null, null)
  })
})

test('delete: invalid input errors', function (t) {
  t.plan(3)
  var str = hstring(memdb())

  t.throws(function () {
    str.delete(null)
  })
  t.throws(function () {
    str.delete(null, '1')
  })
  t.throws(function () {
    str.delete(null, -1)
  })
})

test('multiple roots', function (t) {
  t.plan(6)

  var str1 = hstring(memdb())
  var str2 = hstring(memdb())

  str1.insert(null, null, 'Hello', function (err) {
    t.error(err)
    str2.insert(null, null, 'Heya', function (err) {
      t.error(err)
      replicate(str1, str2, function (err) {
        t.error(err)
        str1.text(function (err, txt1) {
          t.error(err)
          str2.text(function (err, txt2) {
            t.error(err)
            t.equal(txt1, txt2)
          })
        })
      })
    })
  })
})

function replicate (a, b, cb) {
  var r1 = a.log.replicate()
  var r2 = b.log.replicate()

  r1.once('end', done)
  r2.once('end', done)

  r1.pipe(r2).pipe(r1)

  var pending = 2
  function done (err) {
    if (err) throw err
    if (!--pending) cb()
  }
}
