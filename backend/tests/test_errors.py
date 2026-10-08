"""Every failure has one shape: {"error": {"code", "message"}} (P-052)."""

from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient
from pydantic import BaseModel

from app.errors import install_error_handlers


class Item(BaseModel):
    name: str
    size: int


def make_client() -> TestClient:
    app = FastAPI()
    install_error_handlers(app)

    @app.post("/items")
    def create(item: Item) -> Item:
        return item

    @app.get("/teapot")
    def teapot() -> None:
        raise HTTPException(418, "Short and stout.")

    @app.get("/gone")
    def gone() -> None:
        raise HTTPException(410)

    @app.get("/limited")
    def limited() -> None:
        raise HTTPException(429, "Slow down.", headers={"Retry-After": "5"})

    @app.get("/boom")
    def boom() -> None:
        raise RuntimeError("connection failed for mdit:hunter2@mysql")

    return TestClient(app, raise_server_exceptions=False)


def test_unknown_route() -> None:
    response = make_client().get("/nope")
    assert response.status_code == 404
    assert response.json() == {"error": {"code": "not_found", "message": "Not found."}}


def test_wrong_method_keeps_the_allow_header() -> None:
    response = make_client().get("/items")
    assert response.status_code == 405
    assert response.json() == {
        "error": {"code": "method_not_allowed", "message": "Method not allowed."}
    }
    assert response.headers["allow"] == "POST"


def test_http_exception_with_a_message() -> None:
    response = make_client().get("/teapot")
    assert response.status_code == 418
    assert response.json() == {"error": {"code": "http_418", "message": "Short and stout."}}


def test_http_exception_without_a_message_uses_the_status_phrase() -> None:
    response = make_client().get("/gone")
    assert response.json() == {"error": {"code": "http_410", "message": "Gone."}}


def test_http_exception_headers_are_kept() -> None:
    response = make_client().get("/limited")
    assert response.status_code == 429
    assert response.headers["retry-after"] == "5"


def test_validation_errors_list_each_field() -> None:
    response = make_client().post("/items", json={"size": "big"})
    assert response.status_code == 422
    error = response.json()["error"]
    assert error["code"] == "invalid_request"
    assert error["message"] == "The request is not valid."
    fields = {detail["field"] for detail in error["details"]}
    assert fields == {"body.name", "body.size"}
    assert all(detail["message"] for detail in error["details"])


def test_malformed_json_is_a_validation_error() -> None:
    response = make_client().post(
        "/items", content=b"{bad", headers={"content-type": "application/json"}
    )
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "invalid_request"


def test_unhandled_errors_hide_details() -> None:
    response = make_client().get("/boom")
    assert response.status_code == 500
    assert response.json() == {
        "error": {"code": "internal_error", "message": "Something went wrong."}
    }
    assert "hunter2" not in response.text
