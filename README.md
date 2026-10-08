# business-agent-lab

## Branch Tale (`game/`)

선택지에 따라 이야기가 갈라지는 도트 TRPG 웹 게임 (Phaser + TypeScript + Ink).

```
cd game
npm install
npm run dev      # 개발 서버
npm run build    # 배포 빌드 (dist/ 를 itch.io에 업로드)
```

- 이동: 방향키/WASD, 대화: Space/E, 선택지: 숫자키 1~9
- 시나리오: `game/src/story/main.ink` (Ink 문법, 조건 분기/변수/d20 판정 `check(stat, dc)`)
- 월드/타일맵: `game/src/scenes/WorldScene.ts`, 도트 텍스처는 `game/src/textures.ts`에서 코드로 생성
- 진행 상황은 브라우저 localStorage에 저장됩니다.
