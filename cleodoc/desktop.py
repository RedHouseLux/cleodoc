# cleodoc/desktop.py
import os, threading, time
import webview
from dotenv import load_dotenv

load_dotenv()

def _load_flask_app():
    # Supports either create_app() or app variable
    try:
        import app as appmod
    except Exception:
        import appgraph as appmod  # if your entrypoint is appgraph.py

    if hasattr(appmod, "create_app"):
        return appmod.create_app()
    if hasattr(appmod, "app"):
        return appmod.app
    raise RuntimeError("Could not find Flask 'app' or 'create_app()' in this project.")

def _run():
    flask_app = _load_flask_app()
    flask_app.run(host="127.0.0.1", port=5051, debug=False, use_reloader=False)

if __name__ == "__main__":
    t = threading.Thread(target=_run, daemon=True)
    t.start()
    time.sleep(1.2)
    webview.create_window("CleoDOC", "http://127.0.0.1:5051/")
    webview.start()
