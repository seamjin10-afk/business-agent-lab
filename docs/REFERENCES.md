# 도트 레퍼런스 자료

GPT로 도트를 만들 때 첨부할 참고 그림 목록입니다. 개인·지인용 프로젝트라는 전제로 공식 아트를 레퍼런스로 씁니다.

| 위치 | 내용 |
|---|---|
| `docs/art/` | 공방 HTML에 들어 있던 일러스트 251장 (`tools/extract_art.py`) |
| `docs/art/web/totalwar/` | 토탈워 워해머 위키 이미지 20장 (색 참고용) |
| `docs/art/pdf/<책>/` | PDF 다섯 권에서 고른 인물·괴물 일러스트 70장 (`tools/extract_pdf_art.py`로 뽑은 뒤 눈으로 고름, 긴 변 1200px) |

파일 이름 `p030-0255.webp`는 "PDF 30쪽, 그 책의 255번째 이미지"라는 뜻입니다.

"확인된 내용"에는 근거가 있는 것만 적었습니다.

- **같은 쪽 NPC**: 그림과 같은 쪽에 실린 NPC 항목(이름 — 직위, 신분)입니다.
- **공방과 같은 그림**: 공방 HTML의 그림과 이미지 비교 유사도가 0.8 이상인 경우입니다.
- **같은 쪽·앞뒤 쪽 커리어**: 그 쪽에 있는 커리어 항목입니다. 그림이 그 커리어라는 보장은 없어서 참고로만 적었습니다.
- **미확인**: 근거가 없는 것입니다.

## 1. 돌과 강철의 군주들 (`docs/art/pdf/lords/`)

| 파일 | 확인된 내용 | 근거 |
|---|---|---|
| `p011-0099` | 카자도르 썬더혼 — 드워프 카락 영주 | 같은 쪽 NPC |
| `p013-0124` | 웅그림 아이언피스트 — 드워프 카락 영주 | 같은 쪽 NPC |
| `p028-0228` | 질라 크라그스도티르 — 드워프 여성 도시민 | 같은 쪽 NPC |
| `p030-0255` | 카즈가르 로그니손 — 드워프 관문지기 | 같은 쪽 NPC, 공방 `combatants/dwarf-gatekeeper`와 같은 그림 |
| `p031-0269` | 헬가 비크람스도티르 — 드워프 장인 | 같은 쪽 NPC |
| `p032-0285` | 브로크 아이언픽 왕 — 드워프 카락 영주 | 같은 쪽 NPC |
| `p033-0297` | 투르마 왕비 — 드워프 카락 여영주 | 같은 쪽 NPC |
| `p041-0357` | 브라드니 브론즈비어드 — 드워프 장인(방어구 장인) | 같은 쪽 NPC |
| `p043-0386` | 바라고르 구트리손 — 드워프 대장간 장인 | 같은 쪽 NPC |
| `p045-0409` | 난나 로간스도티르 — 드워프 화롯가 여주인 | 같은 쪽 NPC |
| `p051-0466` | 카트린 토름스도티르 — 드워프 데몬 슬레이어 | 같은 쪽 NPC |
| `p079-0775` | 고트렉 거니슨 — 드워프 데몬 슬레이어 | 같은 쪽 NPC, 공방 `combatants/gotrek`과 같은 그림 |
| `p081-0794` | 펠릭스 예거 — 인간 무법자 | 같은 쪽 NPC, 공방 `combatants/felix`와 같은 그림 |
| `p085-0832` | 마그마 드래곤 (84쪽 "하그다르, 다크 랜드의 재앙" 항목 다음 쪽) | 공방 `combatants/magma-dragon`과 같은 그림 |
| `p083-0812`, `p087-0857`, `p093-1060` | 미확인 | — |

## 2. 드워프 플레이어 가이드 (`docs/art/pdf/dwarfpg/`)

| 파일 | 확인된 내용 | 근거 |
|---|---|---|
| `p058-1079` | 슬레이어 | 공방 `career-dwarf-dwarf-slayer`와 같은 그림. 같은 쪽 커리어: 그림니르의 형제 / 파멸 추구자 / 전쟁의 애도자 |
| `p073-1306` | 룬 서기관 | 공방 `careers/dwarf-runescribe`와 같은 그림 |
| `p075-1341` | 룬스미스 | 공방 `careers/dwarf-runesmith`와 같은 그림 |
| `p054-1030` | — | 같은 쪽 커리어: 길드 엔지니어 / 추방된 엔지니어 / 비행 조종사 |
| `p056-1055` | — | 같은 쪽 커리어: 카락 광부 / 광맥 탐색자 / 룬 전령 |
| `p059-1090` | — | 같은 쪽 커리어: 쿼렐러 / 썬더러 / 도끼 전사 |
| `p061-1121` | — | 앞쪽(60) 커리어: 양조업자. 그림 쪽 인용문이 맥주 이야기 |
| `p063-1158` | — | 앞뒤 쪽 커리어: 파멸 사제(62) / 대장간 사제(64) |
| `p071-1271` | — | 앞뒤 쪽 커리어: 카락 순찰자(70) / 룬 서기관(72) |
| `p077-1376` | — | 앞쪽(76) 커리어: 후계자 / 세인 / 스롱 지도자 / 카락 군주 |
| `p021-0603`, `p028-0726`, `p083-1435`, `p090-1557`, `p108-1882`, `p118-2053`, `p120-2124`, `p123-2240` | 미확인 | — |

## 3. 하이엘프 플레이어 가이드 (`docs/art/pdf/elfpg/`)

| 파일 | 확인된 내용 | 근거 |
|---|---|---|
| `p064-0515` | 바다 수호자(씨 가드) | 공방 `careers/elf-sea-guard`와 같은 그림, 같은 쪽 커리어 |
| `p074-0628` | 심미주의자 | 공방 `careers/elf-aestheticist`와 같은 그림, 같은 쪽 커리어 |
| `p090-0740` | 마법사 | 공방 `careers/elf-mage`와 같은 그림, 같은 쪽 커리어 |
| `p066-0546` | — | 같은 쪽 커리어: 소드워든 / 소드마스터 / 블레이드마스터 / 블레이드로드 |
| `p035-0257`, `p052-0418`, `p056-0449`, `p058-0472`, `p085-0710` | 미확인 | — |

## 4. 코티크의 바다 수호자들 (`docs/art/pdf/cothique/`)

| 파일 | 확인된 내용 | 근거 |
|---|---|---|
| `p027-0303` | 엘프 영주 | 공방 `combatants/elf-lord`와 같은 그림 |
| `p044-0575` | — | 다음 쪽(45) NPC: 달로스 공후 · 다노르 공후 — 코티크 귀족 |
| `p069-0942` | 레브나 사르비그 — 노스카 첩자 | 같은 쪽 NPC |
| `p074-0989` | 쉐도우블레이드 — 다크엘프 암살자 | 같은 쪽 NPC |
| `p031-0407`, `p039-0499`, `p049-0665`, `p051-0705`, `p054-0756`, `p057-0795`, `p063-0864`, `p067-0893`, `p081-1085`, `p082-1099` | 미확인 | — |

## 5. 잘첸문트 — 영문판 (`docs/art/pdf/salzenmund/`)

이 책은 한국어 번역본이 아니라 영문판입니다. 그림 대부분이 전신이 아닌 흉상이라 도트 전신 참고로는 약합니다.

| 파일 | 확인된 내용 | 근거 |
|---|---|---|
| `p019-0120` | INGRID GAUSSER — NOBLE MAGNATE (GOLD 6) | 같은 쪽 NPC |
| `p022-0150` | WERNER NIKSE — NOBLE MAGNATE (GOLD 6) | 같은 쪽 NPC |
| 나머지 10장 | 미확인 | — |

## 6. 토탈워 워해머 이미지 (`docs/art/web/totalwar/`)

[Total War: WARHAMMER 위키](https://totalwarwarhammer.fandom.com/)에서 받은 이미지 20장입니다. 각 문서의 대표 이미지를 그대로 받았습니다.

- 위키 문서의 대표 이미지가 아이콘뿐인 고트렉, 룬스미스, 하이엘프 마법사·귀족·왕자, 제국군 장교·위치 헌터·전사 사제는 받지 않았습니다.
- Lexicanum은 사이트 쪽 봇 차단 때문에 받을 수 없었습니다.

| 파일 | 위키 문서 | 종류 |
|---|---|---|
| `belegar-ironhammer.png` | [Belegar Ironhammer](https://totalwarwarhammer.fandom.com/wiki/Belegar_Ironhammer) | 인물 초상 |
| `blue-horrors-of-tzeentch.png` | [Blue Horrors of Tzeentch](https://totalwarwarhammer.fandom.com/wiki/Blue_Horrors_of_Tzeentch) | 유닛 카드 (120×260) |
| `clanrats.png` | [Clanrats](https://totalwarwarhammer.fandom.com/wiki/Clanrats) | 유닛 카드 (120×260) |
| `dwarf-warriors.png` | [Dwarf Warriors](https://totalwarwarhammer.fandom.com/wiki/Dwarf_Warriors) | 유닛 카드 (120×260) |
| `engineer.jpg` | [Engineer](https://totalwarwarhammer.fandom.com/wiki/Engineer) | 게임 화면 캡처 |
| `hammerers.png` | [Hammerers](https://totalwarwarhammer.fandom.com/wiki/Hammerers) | 유닛 카드 (120×260) |
| `ironbreakers.jpg` | [Ironbreakers](https://totalwarwarhammer.fandom.com/wiki/Ironbreakers) | 흑백 컨셉 시트 |
| `loremaster-of-hoeth.jpg` | [Loremaster of Hoeth](https://totalwarwarhammer.fandom.com/wiki/Loremaster_of_Hoeth) | 컬러 컨셉 시트 |
| `lothern-sea-guard.png` | [Lothern Sea Guard](https://totalwarwarhammer.fandom.com/wiki/Lothern_Sea_Guard) | 유닛 카드 (120×260) |
| `miners.png` | [Miners](https://totalwarwarhammer.fandom.com/wiki/Miners) | 유닛 카드 (120×260) |
| `night-goblins.png` | [Night Goblins](https://totalwarwarhammer.fandom.com/wiki/Night_Goblins) | 유닛 카드 (120×260) |
| `plaguebearers-of-nurgle.png` | [Plaguebearers of Nurgle](https://totalwarwarhammer.fandom.com/wiki/Plaguebearers_of_Nurgle) | 유닛 카드 (120×260) |
| `princess.jpg` | [Princess](https://totalwarwarhammer.fandom.com/wiki/Princess) | 컬러 컨셉 시트 |
| `quarrellers.png` | [Quarrellers](https://totalwarwarhammer.fandom.com/wiki/Quarrellers) | 유닛 카드 (120×260) |
| `queek-headtaker.png` | [Queek Headtaker](https://totalwarwarhammer.fandom.com/wiki/Queek_Headtaker) | 인물 초상 |
| `shadow-warriors.png` | [Shadow Warriors](https://totalwarwarhammer.fandom.com/wiki/Shadow_Warriors) | 유닛 카드 (120×260) |
| `skarsnik.png` | [Skarsnik](https://totalwarwarhammer.fandom.com/wiki/Skarsnik) | 인물 초상 |
| `slayers.png` | [Slayers](https://totalwarwarhammer.fandom.com/wiki/Slayers) | 유닛 카드 (120×260) |
| `swordmasters-of-hoeth.png` | [Swordmasters of Hoeth](https://totalwarwarhammer.fandom.com/wiki/Swordmasters_of_Hoeth) | 유닛 카드 (120×260) |
| `thane.jpg` | [Thane](https://totalwarwarhammer.fandom.com/wiki/Thane) | 흑백 컨셉 시트 |

### 그림이 없던 인물

- `belegar-ironhammer`: 벨레가르. PDF에는 이름만 나오고 그림은 없습니다(돌과 강철의 군주들 9·23·68·69쪽, 드워프 PG 15·37·47쪽). 공식 아트 프린트도 있습니다: [warhammerart.com](https://www.warhammerart.com/products/belegar-ironhammer).
- `queek-headtaker`: 퀵 헤드테이커.
- `skarsnik`: 스카스닉. 돌과 강철의 군주들 69쪽에 언급됩니다.
- `plaguebearers-of-nurgle`: 플레이그베어러.
- `blue-horrors-of-tzeentch`: 블루 호러.
- `clanrats`: 클랜랫.

## 7. 흑백 그림의 색 참고

**세력 공통 배색은 사용자가 지정했습니다**: 하이엘프는 흰색 바탕에 하늘색·푸른색, 제국은 붉은색·흰색에 은색 판금입니다. 고트렉은 공식 미니어처 도색을 따릅니다. 자세한 내용은 `docs/SPRITE_SPEC.md` 7절에 있습니다. 아래 표는 드워프 등 그 밖의 세력에 대한 유닛별 참고입니다.

흑백 일러스트는 같은 종류의 토탈워 유닛 도색을 참고해 색을 정합니다. 아래 대응은 **외형(장비·복장)이 비슷한 유닛을 고른 것**이고, 같은 인물이라는 뜻은 아닙니다.

| 흑백 그림 (`docs/art/pdf/`) | 무엇 | 색 참고 (`docs/art/web/totalwar/`) |
|---|---|---|
| `lords/p028-0228` | 질라 크라그스도티르 (총을 든 드워프 여성) | `quarrellers` |
| `lords/p030-0255` | 카즈가르 로그니손 (관문지기) | `hammerers`, `ironbreakers` |
| `lords/p031-0269` | 헬가 비크람스도티르 (장인, 짐과 도구) | `miners` |
| `lords/p041-0357` | 브라드니 브론즈비어드 (방어구 장인) | `dwarf-warriors` |
| `lords/p043-0386` | 바라고르 구트리손 (대장간 장인) | `thane` |
| `lords/p045-0409` | 난나 로간스도티르 (두건, 망치) | `miners` |
| `lords/p051-0466` | 카트린 토름스도티르 (데몬 슬레이어) | `slayers` |
| `cothique/p027-0303`, `p044-0575` | 엘프 영주·코티크 귀족 | `swordmasters-of-hoeth`, `princess` |
| `cothique/p039-0499`, `p054-0756` | 창을 든 엘프 | `lothern-sea-guard` |
| `cothique/p049-0665` | 활을 든 엘프 | `shadow-warriors`, `lothern-sea-guard` |
| `cothique/p051-0705`, `p067-0893` | 로브 차림 엘프 | `loremaster-of-hoeth` |
| `cothique/p057-0795`, `p069-0942`, `salzenmund/*` | 인간 | `docs/art/web/user/empire-palette.webp` (제국 배색) |
