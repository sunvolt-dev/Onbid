# 스킬 사용 규칙

이 프로젝트에서는 **superpowers 관련 스킬만 사용**한다.

## 허용
- `superpowers:*` 네임스페이스에 속한 모든 스킬 (예: `superpowers:brainstorming`, `superpowers:test-driven-development`, `superpowers:systematic-debugging`, `superpowers:executing-plans`, `superpowers:writing-plans`, `superpowers:verification-before-completion` 등)
- `using-superpowers` (superpowers 진입점 스킬)

## 금지
- superpowers 네임스페이스에 속하지 않는 모든 스킬 (예: `update-config`, `keybindings-help`, `simplify`, `loop`, `schedule`, `claude-api`, `adr-writer`, `table-relations` 등)

## 적용 방식
- 스킬 호출이 필요한 상황에서 후보 스킬이 superpowers 네임스페이스에 없다면 스킬을 호출하지 않고 일반 도구(Read/Edit/Bash 등)로 작업을 수행한다.
- 사용자가 명시적으로 특정 비-superpowers 스킬을 요청한 경우에만 해당 스킬을 사용한다 (사용자 지시 최우선 원칙).

---

# 트리거 키워드

사용자 입력이 아래 키워드 중 하나와 정확히 일치하거나 해당 키워드로 시작하면 지정된 동작을 자동 수행한다.

## `배포` / `ship`
사용자가 `배포` 또는 `ship`이라고 입력하면 다음을 순차 수행한다.

1. `git status`, `git diff`, 최근 `git log`를 병렬 확인하여 변경사항 파악
2. 변경 내용을 요약한 커밋 메시지 작성 (프로젝트 커밋 컨벤션 준수)
3. `git add <변경 파일>` → `git commit` 수행
4. 현재 브랜치를 `git push` (업스트림 미설정 시 `-u` 포함)
5. 푸시 결과를 사용자에게 보고

### 규칙
- 커밋할 변경사항이 없으면 빈 커밋을 만들지 말고 "변경사항 없음"을 알린다.
- `main` 브랜치로의 force push는 절대 수행하지 않는다.
- `.env`, 자격증명 파일 등 민감 파일이 스테이징되려 하면 커밋 전에 경고한다.
- pre-commit 훅 실패 시 `--no-verify`로 우회하지 않고 원인을 수정한 뒤 새 커밋을 만든다.
- 사용자가 추가 지시(예: "배포 메시지는 X로") 없이 키워드만 입력하면 위 절차를 바로 실행한다.

## `adr`
사용자가 `adr`이라고 입력하면 `adr-writer` 스킬을 호출하여 `docs/adr/`에 새 ADR을 작성한다.

### 규칙
- 파일명: 기존 `docs/adr/`의 최대 번호 + 1을 3자리 zero-pad하여 `NNN-주제-한국어요약.md` 형식으로 짓는다 (예: `010-주제.md`).
- 주제는 최근 작업 컨텍스트(변경된 코드, 커밋, 대화 내용)에서 자동 도출한다. 사용자에게 별도 질문 없이 진행.
- 본문 구조는 기존 ADR(`001~`)의 포맷을 따른다.
- 이 규칙은 "superpowers 스킬만 사용" 원칙에 대한 **사용자 명시 예외**다. `adr` 키워드 입력 시에는 `adr-writer` 스킬을 허용한다.
