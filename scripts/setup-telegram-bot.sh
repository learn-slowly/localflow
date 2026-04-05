#!/bin/bash
# 텔레그램 봇 웹훅 설정 스크립트
#
# 사전 준비:
# 1. @BotFather에서 봇 생성 → 토큰 받기
# 2. .env.local에 TELEGRAM_BOT_TOKEN 추가
# 3. Vercel에 배포 후 이 스크립트 실행
#
# 사용법:
#   ./scripts/setup-telegram-bot.sh <BOT_TOKEN> <WEBHOOK_URL>
#
# 예시:
#   ./scripts/setup-telegram-bot.sh "123456:ABC-DEF" "https://localflow.vercel.app"

set -e

BOT_TOKEN="${1:?봇 토큰을 입력하세요 (BotFather에서 발급)}"
BASE_URL="${2:?웹훅 URL을 입력하세요 (예: https://localflow.vercel.app)}"

WEBHOOK_URL="${BASE_URL}/api/telegram/webhook"
API="https://api.telegram.org/bot${BOT_TOKEN}"

echo "=== 텔레그램 봇 웹훅 설정 ==="
echo ""

# 1. 웹훅 등록 (리액션 업데이트 포함)
echo "1. 웹훅 등록: ${WEBHOOK_URL}"
curl -s -X POST "${API}/setWebhook" \
  -H "Content-Type: application/json" \
  -d "{
    \"url\": \"${WEBHOOK_URL}\",
    \"allowed_updates\": [\"message\", \"message_reaction\"],
    \"drop_pending_updates\": true
  }" | python3 -m json.tool

echo ""

# 2. 봇 명령어 설정
echo "2. 봇 명령어 설정"
curl -s -X POST "${API}/setMyCommands" \
  -H "Content-Type: application/json" \
  -d '{
    "commands": [
      {"command": "help", "description": "사용법 안내"},
      {"command": "status", "description": "저장된 기록 수 확인"}
    ]
  }' | python3 -m json.tool

echo ""

# 3. 봇 설명 설정
echo "3. 봇 설명 설정"
curl -s -X POST "${API}/setMyDescription" \
  -H "Content-Type: application/json" \
  -d '{
    "description": "선거운동 현장 기록 봇\n\n사용법:\n• 그룹에서 @봇이름 + 메시지/사진\n• 메시지를 봇에게 전달(포워드)\n• 메시지에 📌 리액션"
  }' | python3 -m json.tool

echo ""

# 4. 웹훅 상태 확인
echo "4. 웹훅 상태 확인"
curl -s "${API}/getWebhookInfo" | python3 -m json.tool

echo ""
echo "=== 설정 완료 ==="
echo ""
echo "다음 단계:"
echo "  1. .env.local에 추가: TELEGRAM_BOT_TOKEN=${BOT_TOKEN}"
echo "  2. Vercel 환경변수에도 TELEGRAM_BOT_TOKEN 추가"
echo "  3. 텔레그램 그룹에 봇 추가 (관리자 권한 부여 → 리액션 감지 가능)"
echo "  4. 그룹 설정에서 봇의 '그룹 프라이버시' 비활성화 (BotFather → /setprivacy → Disable)"
