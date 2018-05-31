
const os = require('os');
const fs = require('fs');
const path = require('path');
const http = require('http');

const request = require('request');
const zipper = require('zip-local');

process.stdin.setEncoding('utf8');
process.stdout.setEncoding('utf8');

//GLOBAL src
const src = process.argv.pop().split('/').filter(x => {
  return(x.length);
}).join('/');

const couchLog = require('./couchLog')(src);
couchLog.info('*** couchnode daemon starting ', src);

function die() {
  couchLog.info('exiting...');
  setTimeout(() => {
    process.exit(0);
  }, 1000);
}

function dd(fun) {
  return ((err, res) => {
    if (err) {
      couchLog.error(err);
      return(die());
    }
    return(fun(res));
  });
}

function getPort(cb) {
  process.stdin.once('data', (data) => {
    cb(parseInt(data.replace(/[^0-9]/g, ''), 10));
  });
  process.stdout.write(JSON.stringify(['get', 'chttpd', 'port']) + '\n');
}

function getTempDir(cb) {
  let dirname = src.replace(/\//g, '_').split('_').filter(x=>{return(x.length)}).join('_');
  fs.mkdtemp(path.resolve(os.tmpdir(), dirname + '-'), dd(cb));
}

function getServiceDoc(port, cb) {
  couchLog.info(`fetching service info at http://localhost:${port}/${src}`);
  request({
    uri: `http://localhost:${port}/${src}`,
    json: true
  }, (err, res, serviceDoc) => {
    if (res && res.statusCode && res.statusCode == 200 && serviceDoc && serviceDoc.service) {
      return(cb(serviceDoc.service));
    }
    if (err) {
      return(dd(cb)(err, null));
    }
    return(dd(cb)(new Error(`couchdb returned statuscode ${res.statusCode}`), null));
  });
}

function getPackage(port, tmpdir, cb) {
  let tmpfile = path.resolve(tmpdir, 'package.zip');
  couchLog.info(`fetching http://localhost:${port}/${src}/package.zip to ${tmpdir}`);
  request(`http://localhost:${port}/${src}/package.zip`)
  .on('error', dd(() => {}))
  .pipe(fs.createWriteStream(tmpfile))
  .on('error', dd(() => {}))
  .on('finish', () => {
    cb(tmpfile);
  });
}

function unzip(archive, cb) {
  zipper.unzip(archive, dd(blob => {
    blob.save(path.dirname(archive), dd(cb));
  }));
}

function watch(port) {
  let parts = src.split('/');
  let dbname = parts.shift();
  let docID = parts.join('/');
  couchLog.info(`starting watch for http://localhost:${port}/${dbname}/_changes`);
  request({
    uri: `http://localhost:${port}/${dbname}/_changes`,
    json: true,
    qs: {
      feed: 'longpoll',
      since: 'now',
      filter: '_doc_ids',
      doc_ids: `["${docID}"]`
    }
  }, (err, res, changes) => {
    if (changes && changes.results && changes.results.length) {
      couchLog.info('code change detected');
      return(die());
    }
    setImmediate(() => {
      couchLog.info('no change');
      watch(port);
    });
  });
}

function startapp(appdir, serviceInfo) {
  try {
    let handler = require(appdir)(couchLog.info, serviceInfo);
    http.createServer(handler).listen(serviceInfo.apiPort);
  } catch (e) {
    couchLog.info(e);
    couchLog.error(e);
    return(die());
  }
}


//main
let stdin = process.openStdin();
stdin.on('end', () => {
  couchLog.info('CouchDB is stopping operation');
  return(die());
});
getPort(port => {
  couchLog.info(`got port number ${port}`);
  getTempDir(tmpdir => {
    couchLog.info(`going to ${tmpdir}`);
    getServiceDoc(port, (service) => {
      getPackage(port, tmpdir, (tmpfile) => {
        couchLog.info(`got package ${tmpfile}`);
        unzip(tmpfile, () => {
          couchLog.info(`unpacking ${tmpfile} ok`);
          watch(port);
          startapp(tmpdir, service);
        });
      });
    });
  });
});
