import tornado.ioloop
import tornado.web

class MainHandler(tornado.web.RequestHandler):
    def get(self):
        self.write("Hello, World!")

def make_app():
    return tornado.web.Application([
        (r"/", MainHandler),
    ])

if __name__ == "__main__":
    import asyncio
    asyncio.set_event_loop(asyncio.new_event_loop())
    app = make_app()
    app.listen(8506)
    print("Server started on port 8506")
    tornado.ioloop.IOLoop.current().start()