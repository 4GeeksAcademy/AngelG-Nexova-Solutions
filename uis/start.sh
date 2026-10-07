#!/bin/sh
set -eu

cd /app
exec npm run dev -- --hostname 0.0.0.0 --port 3000
