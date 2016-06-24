var hstring = require('./index')
var memdb = require('memdb')

var str = hstring(memdb())

str.insert(null, 'H', function (err, op) {
  console.log('insert', op)
  str.insert(op.key, 'e', function (err, op2) {
    str.insert(op2.key, 'y', function (err, op3) {
      str.insert(op.key, 'i', function (err, op4) {
        // str.createStringStream().pipe(process.stdout)
        // str.createReadStream()
      })
    })
  })
})
