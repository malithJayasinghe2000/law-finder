"""
LawyerAI RAG System - Error responses

One rule: the caller gets a reference, the log gets the detail.

Every route used to answer a failure with `str(e)` in the body. Against the
running service that produced, for an anonymous caller:

    {"error": "Failed to open file
      '/Users/…/Developer/law-finder/lawyer-rag/data/uploads/x.pdf'."}

which hands over the absolute install path, the directory layout, and — through
other exceptions — model names and library internals. None of that helps the one
legitimate caller, which is a Next.js route that only ever reports "the
assistant is unavailable" to the user anyway.

The error id is the compromise that keeps the service debuggable: the caller can
quote it, and it appears in the server log next to the traceback.
"""

import logging
import secrets
import traceback

from flask import jsonify
from werkzeug.exceptions import HTTPException

logger = logging.getLogger(__name__)


def error_response(
    exc: BaseException | None,
    message: str,
    status: int = 500,
    *,
    context: str = "",
):
    """
    Log the detail, return the reference.

    Args:
        exc: the exception, logged with its traceback. None for a failure that
             is not an exception.
        message: what the caller is told. Must not embed exception text, a
             path, or anything else derived from the server's internals.
        status: HTTP status.
        context: a short label for the log line, e.g. "upload ingestion".

    Returns:
        A (response, status) tuple ready to return from a Flask view.

    Raises:
        HTTPException: re-raised unchanged when `exc` is one.

        Every route here wraps its body in a broad `except Exception`, which
        also catches the HTTP errors werkzeug raises on its own behalf — and the
        most important of those is RequestEntityTooLarge, raised while parsing a
        body over MAX_CONTENT_LENGTH. Flattening that into a 500 turned "your
        upload is too big" into "something went wrong", which is both wrong and
        unhelpful. Re-raising lets Flask's own error handlers answer, which is
        what they are for.
    """
    if isinstance(exc, HTTPException):
        raise exc

    error_id = secrets.token_hex(8)

    if exc is not None:
        logger.error(
            "[%s] %s failed: %s\n%s",
            error_id,
            context or "request",
            exc,
            "".join(traceback.format_exception(exc)),
        )
    else:
        logger.error("[%s] %s failed: %s", error_id, context or "request", message)

    return jsonify({"error": message, "error_id": error_id}), status
