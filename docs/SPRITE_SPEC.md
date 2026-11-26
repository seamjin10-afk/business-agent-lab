# 도트 제작 규격 (GPT 작업용)

## 1. 정해진 것

| 항목 | 내용 |
|---|---|
| 시점 | 탑다운 3/4 (위에서 비스듬히 내려다본 전신) |
| 포즈 | 동작마다 1장. 흔들림·돌진·검격 궤적·투사체·마법 효과는 게임에서 코드로 그립니다 |
| 방향 | **오른쪽을 보는 그림만** 먼저 만듭니다. 왼쪽은 게임이 자동으로 뒤집습니다. 위·아래 방향은 GPT로 시험해 본 뒤 정합니다 |
| 바닥 타일 | 32×32 |

## 2. 크기

캔버스는 "점유 칸 수 × 64px"입니다. 이 규칙이면 개요의 제안값(일반 64, 대형 128)과 맞습니다.

| 크기 분류 | 점유 칸 | 캔버스 |
|---|---|---|
| 일반 (Small·Average) | 1×1 | 64×64 |
| Large | 2×2 | 128×128 |
| Enormous | 3×3 | 192×192 |
| Monstrous | 4×4 | 256×256 |

같은 캔버스 안에서도 키 차이가 보이도록, 변환할 때 캐릭터 키를 따로 맞춥니다. 아래는 **제안값**이며 바꿔도 됩니다.

| 대상 | 캐릭터 키(px, 64 캔버스 기준) |
|---|---|
| 하이엘프·우드엘프 | 58 |
| 인간 · 오크 | 56 |
| 드워프 | 46 |
| 고블린 | 40 |
| 하플링 | 38 |

## 3. 포즈 목록과 파일 이름

| 파일 이름 | 동작 | 필요한 유닛 |
|---|---|---|
| `idle.png` | 무기를 든 대기 자세 | 전부 (필수) |
| `move.png` | 걷는 중간 동작 | 전부 (필수) |
| `melee.png` | 무기를 앞으로 휘두르는 순간 | 전부 (필수) |
| `hit.png` | 맞고 뒤로 젖혀지는 자세 | 전부 (필수) |
| `death.png` | 바닥에 쓰러진 자세 | 전부 (필수) |
| `ranged.png` | 활·쇠뇌·총을 겨누거나 던지는 자세 | 원거리 무기가 있는 유닛만 |
| `cast.png` | 양손을 들어 주문을 거는 자세 | 시전자만 |

포즈 그림이 없으면 게임은 `idle.png`로 대신 표시합니다. 그러니 `idle.png` 한 장만 있어도 전투에 나옵니다.

## 4. 올리는 위치

GPT 원본을 크기 그대로 아래 위치에 올려 주세요. 변환은 제가 합니다(`tools/pixelize.py`).

```
art_src/<유닛 id>/idle.png
art_src/<유닛 id>/melee.png
...
```

변환 결과는 `game/src/assets/sprites/<유닛 id>/<포즈>.png`에 들어가고, 게임이 자동으로 찾아 씁니다(파일이 없는 포즈는 `idle`로 대체).

## 5. GPT에 요청할 때 지킬 것

1. **배경은 단색 마젠타 `#FF00FF`.** 변환 도구가 이 색만 지웁니다. 흰 배경이면 흰 수염·흰 로브와 구분할 수 없어서 다리 사이 같은 틈의 배경이 남습니다.
2. 한 장에 캐릭터 1명, 포즈 1개만 그립니다.
3. 발끝까지 전신을 그리고, 머리·무기 끝이 잘리지 않게 합니다.
4. 오른쪽을 바라보게 합니다.
5. 바닥 그림자, 배경 소품, 글자, 테두리는 넣지 않습니다(그림자는 게임이 그립니다).
6. 같은 캐릭터의 포즈들은 **한 대화 안에서 이어서** 요청하고, 처음 만든 `idle`을 매번 첨부해 "이 캐릭터와 똑같은 옷·색·비율로"라고 덧붙입니다. 그래야 포즈끼리 일관성이 유지됩니다.

### 프롬프트 템플릿 (복사해서 [ ]만 바꾸기)

```
16-bit pixel art game sprite, [캐릭터 묘사],
full body from head to feet, 3/4 top-down view like a classic SNES RPG,
facing right, [포즈 묘사],
solid flat magenta background (#FF00FF), no ground shadow, no text, no border,
crisp hard pixel edges, limited palette, dark 1-pixel outline,
the character fills most of the image height
```

포즈 묘사:

| 포즈 | 영어 문구 |
|---|---|
| idle | standing ready in a combat stance, weapon held |
| move | mid-stride walking pose |
| melee | swinging the weapon forward, mid-swing |
| ranged | aiming the [bow / crossbow / handgun] forward |
| cast | both hands raised casting a spell, faintly glowing hands |
| hit | recoiling backward from a blow, flinching |
| death | collapsed lying on the ground, defeated |

두 번째 포즈부터는 템플릿 앞에 이렇게 덧붙입니다.

```
Same character as the attached image, identical outfit, colours and proportions.
```

## 6. 첫 묶음 (개요 1단계)

| 유닛 id | 내용 | 참고 일러스트 (`docs/art/`) | 필요한 포즈 |
|---|---|---|---|
| `human-swordsman` | 인간 검사 (병사 커리어, 한손검·가죽 흉갑) | `careers/96-soldier.webp`, `Human.webp` | 필수 5종 |
| `dwarf-warrior` | 드워프 전사 (도끼 병사) | `careers/dwarf-dwarf-soldier-axefighter.webp`, `Dwarf.webp` | 필수 5종 |
| `elf-mage` | 하이엘프 마법사 | `careers/elf-mage.webp`, `High-Elf.webp` | 필수 5종 + `cast` |
| `orc` | 오크 | `combatants/orc.webp` | 필수 5종 |
| `goblin` | 고블린 | `combatants/goblin.webp` | 필수 5종 |

GPT 도트가 오기 전까지는 위 참고 일러스트를 자동으로 줄인 임시 도트로 전투를 보여 줍니다.

## 7. 세력별 배색 (사용자 지정)

흑백 레퍼런스는 아래 기준으로 색을 정합니다. 기준 이미지는 `docs/art/web/user/`에 있습니다.

| 대상 | 기준 이미지 | 배색 |
|---|---|---|
| 고트렉 | `gotrek-miniature.jpg` (공식 미니어처) | 주황색 모히칸 머리와 땋은 수염, 맨살 상체(문신), 청회색 바지, 검은 부츠, 금빛 허리 갑주, 사슬 달린 팔찌, 금빛 룬 도끼 |
| 하이엘프 전부 | `high-elf-palette.jpg` | 흰색 로브·망토를 바탕으로 하늘색·푸른색 천, 은색 금속, 금색 장식(팔찌·띠), 붉은 보석 포인트 |
| 제국(인간) 전부 | `empire-palette.webp` | 붉은색·흰색 줄무늬 천과 소매, 은색 판금 흉갑·투구, 흰 깃털 장식, 갈색 가죽 |

GPT 프롬프트에 넣을 문구:

- 하이엘프: `white robes with sky-blue and deep blue cloth, silver armour, gold trim, small red gems`
- 제국: `Empire soldier colours: red and white striped puffed sleeves, polished steel breastplate and helmet, white plume, brown leather`
- 고트렉: `bright orange crested mohawk and long braided orange beard, bare tattooed torso, blue-grey trousers, black boots, gold armoured belt, chained wrist cuffs, golden rune axe`
