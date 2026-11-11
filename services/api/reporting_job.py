"""Run reporting manually or as the weekly scheduler without a second API."""

import database  # noqa: F401 — configures the sibling service import path
from reporting.cli import main


if __name__ == "__main__":
    main()
