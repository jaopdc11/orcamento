#!/usr/bin/env bash
# Sobe um Postgres 17 descartável, aplica as migrations e roda `bun test`.
# Mesma versão da VPS. O container morre no fim, passe ou falhe.
set -euo pipefail
cd "$(dirname "$0")/.."

NOME="orcamento-teste-$$"
PORTA=$(( 20000 + RANDOM % 10000 ))

docker run -d --rm --name "$NOME" -e POSTGRES_PASSWORD=teste -e POSTGRES_DB=orcamento \
  -p "127.0.0.1:$PORTA:5432" postgres:17 >/dev/null
trap 'docker stop "$NOME" >/dev/null' EXIT

for _ in $(seq 1 60); do
  docker exec "$NOME" pg_isready -U postgres -d orcamento >/dev/null 2>&1 && break
  sleep 0.5
done
sleep 1 # o pg_isready responde antes do initdb terminar o restart

export DATABASE_URL="postgres://postgres:teste@127.0.0.1:$PORTA/orcamento"
export ORIGEM="http://front.teste"
export EMAILS_PERMITIDOS="ana@teste.dev,bia@teste.dev,estranho@teste.dev"
export COOKIE_SEGURO=0

bun src/index.ts migrar
bun test "$@"
