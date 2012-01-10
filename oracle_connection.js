var oracle = require('db-oracle');

var i2b2 = new oracle.Database({
    hostname: '192.168.1.126',
    user: 'i2b2demodata',
    password: 'demouser'
});

i2b2.connect(function(error) {
    if (error) {
      return console.log("CONNECTION ERROR: " + error);
    }
});

module.exports = i2b2;
