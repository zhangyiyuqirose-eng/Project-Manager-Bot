print("Starting minimal server...")

try:
    import tornado.ioloop
    import tornado.web
    print("Tornado imported successfully")
    
    class MainHandler(tornado.web.RequestHandler):
        def get(self):
            self.write("Hello, World!")
    
    def make_app():
        print("Creating application...")
        return tornado.web.Application([
            (r"/", MainHandler),
        ])
    
    print("Setting up event loop...")
    import asyncio
    asyncio.set_event_loop(asyncio.new_event_loop())
    
    print("Creating app instance...")
    app = make_app()
    
    print("Listening on port 8000...")
    app.listen(8000)
    
    print("Server started successfully!")
    print("Press Ctrl+C to stop")
    
    print("Starting IOLoop...")
    tornado.ioloop.IOLoop.current().start()
except Exception as e:
    print(f"Error: {e}")
    import traceback
    traceback.print_exc()