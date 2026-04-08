import tornado.ioloop
import tornado.web

class MainHandler(tornado.web.RequestHandler):
    def get(self):
        self.write("Hello, Tornado!")

def make_app():
    return tornado.web.Application([
        (r"/", MainHandler),
    ])

if __name__ == "__main__":
    print("Starting Tornado server...")
    try:
        import asyncio
        print("Setting up event loop...")
        asyncio.set_event_loop(asyncio.new_event_loop())
        print("Creating application...")
        app = make_app()
        print("Listening on port 8080...")
        app.listen(8080)
        print("Server started at http://localhost:8080")
        print("Starting IOLoop...")
        tornado.ioloop.IOLoop.current().start()
    except Exception as e:
        print(f"Error starting server: {e}")
        import traceback
        traceback.print_exc()