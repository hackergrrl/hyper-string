var hyperlog = require('hyperlog')

module.exports = HyperString

function HyperString (opts) {
    if (!(this instanceof HyperString)) { return new HyperString(opts) }
}

HyperString.prototype.insert = function (prev, chr, cb) {
    process.nextTick(function () { cb(null, 'a') })
}

// HyperString.prototype.createStringStream = function () {
// }

HyperString.prototype.createReadStream = function (opts) {
}
