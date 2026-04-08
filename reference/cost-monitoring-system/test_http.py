import http.server
import socketserver

PORT = 8080

handler = http.server.SimpleHTTPRequestHandler

print(f"Starting HTTP server on port {PORT}...")
try:
    with socketserver.TCPServer(("", PORT), handler) as httpd:
        print(f"Server started at http://localhost:{PORT}")
        httpd.serve_forever()
except Exception as e:
    print(f"Error starting server: {e}")
    import traceback
    traceback.print_exc()