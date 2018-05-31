# couchdaemon

Write a node.js module, store it as package.zip in the attachments of a couchdb document.
Configure couchdaemon as an os_daemon in couchdb config, giving the db/\_id as an argument:

```
[os_daemon]
my_daemon = /path/to/couchdaemon/start.js dbname/_design_or_doc_id
```

restart couchdb to make it effective:

`curl -X POST 'http://localhost:5986/_restart' -H 'content-type: application/json'`

couchdaemon will download the package and call your module with 2 arguments:
* a logger (to log your messages to the couchdb log) and
* the service-member of the couchdoc itself (useful for options to your module, see below)
and then start watching changes to this couch document, killing and restarting the service should you change the document.

the couchdoc should contain (at the very least)
```
"service": {
  "apiPort": 1234 // the portnumber you want the http server to run on
}
```
Your module should return a plain http handler function:
```
module.exports = (clog, opts) => {
  return((req, res) => {
    clog(req.method, req.url);
    return(res.end('Hello'));
  });
}
```
