#!/bin/sh
# 호스트 볼륨의 DB 파일을 /app/collector/onbid.db 에 심볼릭 링크.
# 기존 코드는 파일 경로를 상수/상대경로로 쓰므로, 컨테이너 안에서도 같은 경로로
# 접근되도록 호환층을 둔다. /data 는 docker-compose 에서 바인드 마운트.
set -e

mkdir -p /data
if [ ! -e /data/onbid.db ]; then
    # 최초 부팅 시 빈 파일만 생성 — 스키마는 collector가 알아서 초기화
    touch /data/onbid.db
fi

ln -sfn /data/onbid.db /app/collector/onbid.db

exec "$@"
