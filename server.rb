require 'webrick'
server = WEBrick::HTTPServer.new(Port: 8080, DocumentRoot: Dir.pwd)
trap('INT') { server.shutdown }
server.start
