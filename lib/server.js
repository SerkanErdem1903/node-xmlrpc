var http             = require('http')
  , https            = require('https')
  , url              = require('url')
  , EventEmitter     = require('events').EventEmitter
  , Serializer       = require('./serializer')
  , Deserializer     = require('./deserializer')

/**
 * Creates a new Server object. Also creates an HTTP server to start listening
 * for XML-RPC method calls. Will emit an event with the XML-RPC call's method
 * name when receiving a method call.
 *
 * @constructor
 * @param {Object|String} options - The HTTP server options. Either a URI string
 *                                  (e.g. 'http://user:password@localhost:9090') 
 *                                  or an object with fields:
 *   - {String} host              - (optional)
 *   - {Number} port
 *   - {String} username
 *   - {String} password
 * @param {Boolean} isSecure      - True if using https for making calls,
 *                                  otherwise false.
 * @return {Server}
 */
function Server(options, isSecure, onListening) {

  if (false === (this instanceof Server)) {
    return new Server(options, isSecure)
  }
  onListening = onListening || function() {}
  var that = this

  // If a string URI is passed in, converts to URI fields
  if (typeof options === 'string') {
    options = url.parse(options)
    options.host = options.hostname
    options.path = options.pathname
    options.user = options.auth.split(/:/)[0]
    options.pass = options.auth.split(/:/)[1]
  }

  function handleMethodCall(request, response) {
    var deserializer = new Deserializer()
    deserializer.deserializeMethodCall(request, function(error, methodName, params) {
    var header = request.headers['authorization']||'',
    token = header.split(/\s+/).pop()||'',
    auth = new Buffer(token, 'base64').toString(),
    usr = auth.split(/:/)[0],
    pwd = auth.split(/:/)[1];
	  
	  if (options.user != usr || options.pass != pwd) {
		that.emit('Forbidden', methodName, params)
        response.writeHead(403)
        response.end()
      }
	  else if (Object.prototype.hasOwnProperty.call(that._events, methodName)) {
        that.emit(methodName, null, params, function(error, value) {
          var xml = null
          if (error !== null) {
            xml = Serializer.serializeFault(error)
          }
          else {
            xml = Serializer.serializeMethodResponse(value)
          }
          response.writeHead(200, {'Content-Type': 'text/xml'})
          response.end(xml)
        })
      }
      else {
        that.emit('NotFound', methodName, params)
        response.writeHead(404)
        response.end()
      }
    })
  }

  this.httpServer = isSecure ? https.createServer(options, handleMethodCall)
                            : http.createServer(handleMethodCall)

  process.nextTick(function() {
    this.httpServer.listen(options.port, options.host, onListening)
  }.bind(this))
  this.close = function(callback) {
    this.httpServer.once('close', callback)
    this.httpServer.close()
  }.bind(this)
}

// Inherit from EventEmitter to emit and listen
Server.prototype.__proto__ = EventEmitter.prototype

module.exports = Server

