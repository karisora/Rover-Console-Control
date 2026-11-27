#!/bin/bash
PACKAGE="$(cd "$(dirname "$0")" && pwd)" || exit 1
exec /bin/bash "$PACKAGE/LumOS1-Console.app/Contents/Resources/launch-console.sh" --foreground
