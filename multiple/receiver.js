var http = require('http');
var querystring = require('querystring');

var serverPort = 8609;

http.createServer(function (request, response) {
	if(request.method==="POST") {
		var body = "";
		request.on('data', function(chunk) {
			body += chunk.toString();
		});
		request.on('end', function() {
			var data = querystring.parse(body);
			console.log("name:"+data.name);
			console.log("path:"+data.path);
			console.log("json:"+data.json.substr(0,100)+"[...]");
		});
		
		response.writeHead(201, {'Content-Type': 'text/plain'});
		response.end('File created.\n');
	} else {
		response.writeHead(405, {'Content-Type': 'text/plain'});
		response.end('Wrong HTTP method: '+request.method+'.\n');
	}
	
}).listen(serverPort);

console.log('Server running at http://localhost:'+serverPort+'/');
