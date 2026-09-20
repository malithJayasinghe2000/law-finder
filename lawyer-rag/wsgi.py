"""
WSGI entry point for gunicorn.

    gunicorn -c gunicorn.conf.py wsgi:app

app.run() in main.py is Flask's development server. It is single-threaded,
has no production hardening, and until Stage 0 it was serving on 0.0.0.0 with
the debugger switched on.
"""

from app.main import create_app

app = create_app()
