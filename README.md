# business-agent-lab

## Old World Tactics (`game/`)

워해머 판타지 5판 룰(기존 캐릭터 공방에서 이식)로 돌아가는 도트 전술 전투 게임입니다.
흐름 목표: 캐릭터 공방 → 출격 준비 → 도트 전투 → 결과. 이후 발더스 게이트식 분기 스토리를 붙입니다.

```
cd game
npm install
npm run dev          # 개발 서버
npm run build        # 배포 빌드 (dist/)
npm run sim          # 헤드리스 자동 전투 1판 (엔진 점검)
npm run demo-party   # 시연용 파티(인간 검사·드워프 전사·엘프 마법사) 재생성
```

| 경로 | 내용 |
|---|---|
| `game/src/rules/engine.js` | 공방 HTML에서 옮긴 룰·전투 엔진 (DOM 없는 모듈 그대로) |
| `game/src/rules/rules.json` | 커리어·기술·재능·주문 데이터 |
| `game/src/rules/builder.js` | 캐릭터 생성 → 전투 참가자 변환 연결부 |
| `game/src/battle/` | 도트 전투판(Phaser), 화면 밖 HUD, 전투 설정 |
| `game/src/assets/sprites/<유닛>/<포즈>.png` | 최종 도트 (없으면 `placeholder/` 임시 도트) |
| `game/src/story/` | Ink 분기 대화 프로토타입 (스토리 단계에서 다시 연결) |
| `docs/SPRITE_SPEC.md` | GPT 도트 제작 규격·프롬프트 |
| `docs/art/` | 공방에서 추출한 레퍼런스 일러스트 (`tools/extract_art.py`) |
| `tools/pixelize.py` | GPT 이미지 → 정확한 크기의 도트 변환 |
