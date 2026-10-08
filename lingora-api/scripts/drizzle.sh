#!/usr/bin/env sh
set -eu

ROOT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$ROOT_DIR"

CONFIG_FILE="drizzle.config.ts"

usage() {
  cat <<'EOF'
Usage:
  sh scripts/drizzle.sh generate [migration-name]
  sh scripts/drizzle.sh drop
  sh scripts/drizzle.sh migrate

Examples:
  sh scripts/drizzle.sh generate init
  sh scripts/drizzle.sh generate add-countries
  sh scripts/drizzle.sh drop
  sh scripts/drizzle.sh migrate
EOF
}

if [ ! -f "$CONFIG_FILE" ]; then
  echo "Error: $CONFIG_FILE was not found in $ROOT_DIR" >&2
  exit 1
fi

if [ ! -f ".env" ]; then
  echo "Error: .env was not found in $ROOT_DIR" >&2
  echo "Create it from .env.example and set DATABASE_URL first." >&2
  exit 1
fi

COMMAND=${1:-}

case "$COMMAND" in
  generate)
    MIGRATION_NAME=${2:-}

    # drizzle-kit generate may need an interactive TTY to resolve
    # rename-vs-create column conflicts. This script is already invoked
    # through RTK (for example: rtk bun run db:generate), so avoid wrapping
    # drizzle-kit in a second proxy layer that strips the terminal TTY.
    if [ -n "$MIGRATION_NAME" ]; then
      echo "Generating Drizzle migration: $MIGRATION_NAME"
      bunx drizzle-kit generate --config="$CONFIG_FILE" --name="$MIGRATION_NAME"
    else
      echo "Generating Drizzle migration"
      bunx drizzle-kit generate --config="$CONFIG_FILE"
    fi
    ;;

  drop)
    echo "Dropping the latest generated Drizzle migration"
    # drizzle-kit drop is interactive, so keep the real terminal TTY.
    bunx drizzle-kit drop --config="$CONFIG_FILE"
    ;;

  migrate)
    echo "Applying pending Drizzle migrations"
    rtk proxy bunx drizzle-kit migrate --config="$CONFIG_FILE"
    ;;

  -h|--help|help|"")
    usage
    ;;

  *)
    echo "Error: unknown command '$COMMAND'" >&2
    echo >&2
    usage >&2
    exit 1
    ;;
esac
