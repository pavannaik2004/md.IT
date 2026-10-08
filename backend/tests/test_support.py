"""Integration tests skip locally but fail in CI when services are down (P-047)."""

import pytest

from tests.support import START_HINT, services_unavailable


def test_services_unavailable_skips_or_fails(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("MDIT_REQUIRE_SERVICES", raising=False)
    with pytest.raises(pytest.skip.Exception, match=START_HINT):
        services_unavailable("MySQL is not reachable")

    monkeypatch.setenv("MDIT_REQUIRE_SERVICES", "1")
    with pytest.raises(pytest.fail.Exception, match="MySQL is not reachable"):
        services_unavailable("MySQL is not reachable")
