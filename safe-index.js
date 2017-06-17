module.exports = SafeIndex

var hindex = require('hyperlog-index')

function SafeIndex (opts) {
  if (!(this instanceof SafeIndex)) { return new SafeIndex(opts) }

  var mapFn = opts.map

  var indexValues = opts.init()

  opts.map = map
  var index = hindex(opts)

  function map (row, next) {
    mapFn(indexValues, row, next)
  }

  this.ready = function (cb) {
    index.ready(function () {
      cb(indexValues)
    })
  }
}
