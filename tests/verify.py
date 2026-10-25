from pathlib import Path
import os,socket,subprocess,sys
from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
from functools import partial
import threading
root=Path(__file__).resolve().parents[1]
server=ThreadingHTTPServer(('127.0.0.1',0),partial(SimpleHTTPRequestHandler,directory=str(root)))
threading.Thread(target=server.serve_forever,daemon=True).start()
try:
 env=dict(os.environ,BUILDER_URL='http://127.0.0.1:'+str(server.server_port))
 for name in (sys.argv[1:] or ['browser.cjs','edge.cjs','upgrade.cjs','templates.cjs','source-import.cjs','learning.cjs']):
  result=subprocess.run([os.environ.get('NODE_BINARY','node'),str(root/'tests'/name)],env=env,timeout=65)
  if result.returncode:sys.exit(result.returncode)
finally:server.shutdown();server.server_close()
