#!/bin/bash
# Ambiente de QA pronto: sobe banco de teste, API (jar do commit fixado, verificado) e site,
# a partir de um arquivo de configuração. Genérico: nada aqui é de um projeto específico.
# Uso: ambiente-qa.sh {subir|parar|status} CONFIG.env
set -u

uso() { echo "Uso: $0 {subir|parar|status} CONFIG.env" >&2; exit 2; }
[ $# -eq 2 ] || uso
ACAO=$1; CFG=$2
[ -f "$CFG" ] || { echo "Configuração não encontrada: $CFG" >&2; exit 2; }

# Padrões; a configuração sobrescreve.
PORTAS_PROIBIDAS="3000 8080"
BUILD_CMD="./mvnw -o -q -DskipTests package"
JAR_GLOB="target/*.jar"
DB_IMAGEM="postgres:16"; DB_USER="test_user"
HEAP_API="512m"; PRIORIDADE="nice -n 15"
# shellcheck disable=SC1090
. "$CFG"

falha() { echo "ERRO: $*" >&2; exit 1; }
for v in NOME REPO_API REF DB_CONTAINER DB_PORT DB_NAME DB_SENHA API_PORT; do
  [ -n "${!v:-}" ] || falha "variável $v ausente em $CFG"
done
WORK="${WORK:-$HOME/.cache/ambiente-qa/$NOME}"; mkdir -p "$WORK"

# Travas: só alvos de teste e nunca as portas do ambiente do Gestor.
case "$DB_CONTAINER" in test_*) ;; *) falha "DB_CONTAINER deve começar com test_ ($DB_CONTAINER)";; esac
case "$DB_NAME" in test_*) ;; *) falha "DB_NAME deve começar com test_ ($DB_NAME)";; esac
for p in $DB_PORT $API_PORT ${FRONT_PORT:-}; do
  for x in $PORTAS_PROIBIDAS; do [ "$p" = "$x" ] && falha "porta $p é proibida"; done
done

pid_vivo() { [ -f "$1" ] && kill -0 "$(cat "$1")" 2>/dev/null; }
http() { curl -s -o /dev/null -w '%{http_code}' -m 3 "$1" 2>/dev/null; }

parar() {
  for f in api front; do
    if pid_vivo "$WORK/$f.pid"; then kill "$(cat "$WORK/$f.pid")" 2>/dev/null; echo "parado: $f"; fi
    rm -f "$WORK/$f.pid"
  done
  if docker inspect "$DB_CONTAINER" >/dev/null 2>&1; then docker stop "$DB_CONTAINER" >/dev/null && echo "parado: $DB_CONTAINER"; fi
}

status() {
  printf "banco %s | api %s | site %s\n" \
    "$(docker inspect -f '{{.State.Status}}' "$DB_CONTAINER" 2>/dev/null || echo ausente)" \
    "$(http "localhost:$API_PORT${API_SAUDE:-/}")" \
    "$( [ -n "${FRONT_PORT:-}" ] && http "localhost:$FRONT_PORT/" || echo n/a )"
  [ -f "$WORK/jar.sha256" ] && echo "jar: $(cat "$WORK/jar.sha256")"
}

subir() {
  # 1. Banco de teste (cria se não existir).
  if docker inspect "$DB_CONTAINER" >/dev/null 2>&1; then
    docker start "$DB_CONTAINER" >/dev/null
  else
    docker run -d --name "$DB_CONTAINER" -e POSTGRES_USER="$DB_USER" -e POSTGRES_PASSWORD="$DB_SENHA" \
      -e POSTGRES_DB="$DB_NAME" -p "127.0.0.1:$DB_PORT:5432" "$DB_IMAGEM" >/dev/null || falha "não subiu o banco"
  fi
  for _ in $(seq 1 30); do docker exec "$DB_CONTAINER" pg_isready -U "$DB_USER" >/dev/null 2>&1 && break; sleep 1; done

  # 2. Jar do commit fixado, em worktree própria (nunca reaproveita target/ de outra árvore).
  WT="$WORK/wt"
  git -C "$REPO_API" worktree prune
  [ -d "$WT" ] || git -C "$REPO_API" worktree add --detach "$WT" "$REF" >/dev/null 2>&1 || falha "worktree de $REF"
  git -C "$WT" checkout -q --detach "$REF" || falha "checkout de $REF"
  COMMIT=$(git -C "$WT" rev-parse --short HEAD)
  (cd "$WT" && $PRIORIDADE bash -c "$BUILD_CMD" > "$WORK/build.log" 2>&1) || falha "build falhou (veja $WORK/build.log)"
  JAR=$(ls "$WT"/$JAR_GLOB 2>/dev/null | grep -v original | head -1); [ -n "$JAR" ] || falha "jar não encontrado"
  cp "$JAR" "$WORK/app.jar"

  # 3. Verifica que o jar tem o que o commit deve ter (evita jar velho).
  if [ -n "${VERIFICA_CLASSE:-}" ] && [ -n "${VERIFICA_TEXTO:-}" ]; then
    n=$(unzip -p "$WORK/app.jar" "$VERIFICA_CLASSE" 2>/dev/null | strings | grep -c "$VERIFICA_TEXTO")
    [ "$n" -ge 1 ] || falha "jar sem '$VERIFICA_TEXTO' em $VERIFICA_CLASSE"
  fi
  echo "$COMMIT $(sha256sum "$WORK/app.jar" | cut -c1-20)" > "$WORK/jar.sha256"

  # 4. API (variáveis de API_ENV_FILE; segredos ficam fora deste script).
  pid_vivo "$WORK/api.pid" && { kill "$(cat "$WORK/api.pid")"; sleep 2; }
  [ -n "${API_ENV_FILE:-}" ] && { set -a; . "$API_ENV_FILE"; set +a; }
  SPRING_DATASOURCE_URL="jdbc:postgresql://localhost:$DB_PORT/$DB_NAME" SPRING_DATASOURCE_USERNAME="$DB_USER" \
    SPRING_DATASOURCE_PASSWORD="$DB_SENHA" SERVER_PORT="$API_PORT" \
    nohup $PRIORIDADE java -Xmx"$HEAP_API" -jar "$WORK/app.jar" > "$WORK/api.log" 2>&1 &
  echo $! > "$WORK/api.pid"
  for _ in $(seq 1 90); do [ "$(http "localhost:$API_PORT${API_SAUDE:-/}")" != "000" ] && break; sleep 2; done

  # 5. Site (opcional).
  if [ -n "${FRONT_DIR:-}" ] && [ -n "${FRONT_PORT:-}" ]; then
    pid_vivo "$WORK/front.pid" && kill "$(cat "$WORK/front.pid")"
    (cd "$FRONT_DIR" && FRONT_PORT=$FRONT_PORT API_PORT=$API_PORT nohup $PRIORIDADE bash -c "${FRONT_CMD:?FRONT_CMD ausente}" > "$WORK/front.log" 2>&1 & echo $! > "$WORK/front.pid")
    for _ in $(seq 1 30); do [ "$(http "localhost:$FRONT_PORT/")" = "200" ] && break; sleep 1; done
  fi
  [ -n "${POS_SUBIR:-}" ] && bash -c "$POS_SUBIR"
  status
}

case "$ACAO" in subir) subir;; parar) parar;; status) status;; *) uso;; esac
