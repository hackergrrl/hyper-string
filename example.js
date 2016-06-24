var hstring = require('./index')
var memdb = require('memdb')

var str = hstring(memdb())

str.insert(null, 'H', function (err, op) {
  console.log('insert', op)
  str.insert(op.pos, 'e', function (err, op2) {
    str.insert(op2.pos, 'y', function (err, op3) {
      str.insert(op.pos, 'i', function (err, op4) {
        // str.createStringStream().pipe(process.stdout)
        // str.createReadStream()
      })
    })
  })
})
