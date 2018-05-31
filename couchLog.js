

function writeLog(level, prefix) {
  return(function() {
    let mssg = [prefix].concat(Array.prototype.slice.call(arguments));
    process.stdout.write(JSON.stringify(['log', mssg.toString(), {level: level}]) + '\n');
  });
}

module.exports = function(prefix) {
  return({
    info: writeLog('info', prefix),
    error: writeLog('error', prefix),
    debug: writeLog('debug', prefix)
  });
};
