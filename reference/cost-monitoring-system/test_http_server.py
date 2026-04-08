import http.server
import socketserver

PORT = 9876

handler = http.server.SimpleHTTPRequestHandler

with socketserver.TCPServer(("", PORT), handler) as httpd:
    print(f"Server started at http://localhost:{PORT}")
    httpd.serve_forever()