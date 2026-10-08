"""BlobStore: hash checks and failures need no services; the rest runs against Azurite."""

import contextlib
import time
import uuid

import pytest
from azure.core.exceptions import ResourceNotFoundError
from azure.storage.blob import ContainerClient

from app.config import Settings
from app.storage.blobs import BlobStore
from tests.support import azurite_connection_string


def unreachable_store() -> BlobStore:
    return BlobStore.from_connection_string(azurite_connection_string(port=1), "unused")


@pytest.mark.parametrize("name", ["A" * 64, "a" * 63, "g" * 64, "../" + "a" * 61])
def test_rejects_names_that_are_not_sha256_hex(name: str) -> None:
    with pytest.raises(ValueError, match="64 lowercase hex"):
        unreachable_store().exists(name)


def test_unreachable_storage_is_reported_quickly() -> None:
    started = time.monotonic()
    assert unreachable_store().ensure_container() is False
    assert time.monotonic() - started < 5


@pytest.mark.integration
def test_ensure_container_is_idempotent(blob_store: BlobStore) -> None:
    assert blob_store.ensure_container() is True
    assert blob_store.ensure_container() is True


@pytest.mark.integration
def test_ensure_container_creates_a_missing_container(
    blob_store: BlobStore, test_settings: Settings
) -> None:
    connection_string = test_settings.blob_connection_string.get_secret_value()
    name = f"test-{uuid.uuid4().hex[:12]}"
    container = ContainerClient.from_connection_string(connection_string, name)
    try:
        assert BlobStore.from_connection_string(connection_string, name).ensure_container()
        assert container.exists()
    finally:
        with contextlib.suppress(ResourceNotFoundError):
            container.delete_container()


@pytest.mark.integration
def test_put_then_get(blob_store: BlobStore, test_settings: Settings) -> None:
    digest = "0123456789abcdef" * 4
    blob_store.put(digest, b"# Hello\n", "text/markdown")
    assert blob_store.exists(digest) is True
    assert blob_store.get(digest) == b"# Hello\n"
    container = ContainerClient.from_connection_string(
        test_settings.blob_connection_string.get_secret_value(), test_settings.blob_container
    )
    properties = container.get_blob_client(digest).get_blob_properties()
    assert properties.content_settings.content_type == "text/markdown"


@pytest.mark.integration
def test_missing_blob(blob_store: BlobStore) -> None:
    assert blob_store.exists("f" * 64) is False
    assert blob_store.get("f" * 64) is None


@pytest.mark.integration
def test_existing_blob_is_not_replaced(blob_store: BlobStore) -> None:
    digest = "1" * 64
    blob_store.put(digest, b"first", "text/plain")
    blob_store.put(digest, b"second", "text/plain")
    assert blob_store.get(digest) == b"first"
