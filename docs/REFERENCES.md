# 도트 레퍼런스 자료

GPT로 도트를 만들 때 첨부할 참고 그림 목록입니다. 개인·지인용 프로젝트라는 전제로 공식 아트를 레퍼런스로 씁니다.

| 위치 | 내용 |
|---|---|
| `docs/art/` | 공방 HTML에 들어 있던 일러스트 251장 (`tools/extract_art.py`) |
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

## 6. 그림이 없는 인물 — 웹 검색 결과

엔진에 프로필은 있는데 일러스트가 없는 인물과 벨레가르입니다.

이 개발 환경에서는 네트워크 정책 때문에 아래 사이트의 이미지를 내려받을 수 없습니다. 그래서 링크만 모았습니다. PC에서 열어 그림을 GPT에 직접 첨부하시면 됩니다.

검색에서 공식 일러스트가 직접 잡힌 경우는 벨레가르 아트 프린트뿐이었습니다. 나머지는 위키·미니어처 사진입니다.

| 인물 | 링크 | 메모 |
|---|---|---|
| 벨레가르 아이언해머 (카락 여덟 봉우리의 왕) | [Lexicanum](https://whfb.lexicanum.com/wiki/Belegar) · [공식 아트 프린트 (Mark Holmes)](https://www.warhammerart.com/products/belegar-ironhammer) · [Giant Bomb](https://giantbomb.com/wiki/Characters/Belegar_Ironhammer) · [도색 미니어처 (Tale of Painters)](https://taleofpainters.com/?p=19243) | PDF에는 이름만 나오고 그림은 없음: 돌과 강철의 군주들 9·23·68·69쪽, 드워프 PG 15·37·47쪽 |
| 퀵 헤드테이커 (스케이븐 모르스 씨족 대군벌) | [Total War: Warhammer 2 소개 (PC Invasion)](https://www.pcinvasion.com/?p=155933) · [AoS 스케이븐 워스크롤 PDF](https://www.blacklibrary.com/Downloads/Product/PDF/aos/compendiums/ENG/warhammer-aos-skaven-en.pdf) · [도색 미니어처 (Dakka)](https://www.dakkadakka.com/gallery/78707-queek%20headtaker.html) | 워스크롤 기준 장비: 한 손에 Dwarf Gouger, 다른 손에 가시 검, War-shard 갑옷. 공식 일러스트 페이지는 찾지 못함 |
| 스카스닉 (나이트 고블린, 여덟 봉우리의 군벌) | [Lexicanum](https://whfb.lexicanum.com/wiki/Skarsnik) · [Villains Wiki](https://villains.fandom.com/wiki/Skarsniik) · [미니어처 (CoolMiniOrNot)](https://www.coolminiornot.com/458179) | 거대 동굴 스퀴그 '고블라'와 함께 다님. 돌과 강철의 군주들 69쪽에 언급 |
| 플레이그베어러 (너글 하급 데몬) | [Lexicanum (AoS)](https://ageofsigmar.lexicanum.com/wiki/Plaguebearer) · [미니어처 변천 (azazelx)](https://azazelx.com/2018/01/25/realm-of-chaos-nurgles-children-2018-2-3rd-wave-plaguebearers-2001/) | 녹색·갈색으로 곪은 시체 같은 피부 |
| 블루 호러 (젠취 하급 데몬) | [Bell of Lost Souls](https://belloflostsouls.net/?p=167010) · [AoS 키트](https://www.hobbycraft.co.uk/warhammer-age-of-sigmar-disciples-of-tzeentch-blue-horrors/6806381000.html) | 가슴에 얼굴이 있는 팔다리 덩어리. 핑크 호러가 죽으면 둘로 갈라져 생김. 공방에 `pink-horror` 그림 있음 |
| 클랜랫 (스케이븐 일반병) | [Warhammer Community 'Eavy Metal 도색 기사](https://www.warhammer-community.com/en-gb/articles/rW9n7R76/mustering-the-great-clans-find-out-how-eavy-metal-painted-the-hordes-of-skaven/) · [Lexicanum: Children of the Horned Rat](https://whfb.lexicanum.com/wiki/Children_of_the_Horned_Rat) | — |

이미지를 이 환경에서 직접 받아 오게 하려면, 클라우드 환경 설정의 네트워크 허용 도메인에 아래 도메인을 추가하면 됩니다.

- `whfb.lexicanum.com`, `ageofsigmar.lexicanum.com`
- `*.fandom.com`, `static.wikia.nocookie.net`
- `www.warhammerart.com`
