VAR met_elder = false
VAR gate_open = false
VAR guard_bribed = false
VAR guard_persuaded = false
VAR has_amulet = false

EXTERNAL check(stat, dc)

=== elder ===
{ not met_elder:
    ~ met_elder = true
    촌장: 오, 여행자여. 마을 북문이 닫힌 지 사흘째라네.
- else:
    촌장: 다시 왔군. 문은 아직 닫혀 있다네.
}
-> elder_talk

= elder_talk
+ [무슨 일이 있었습니까?]
    촌장: 밤마다 북쪽 숲에서 울음소리가 들려. 경비병이 겁을 먹고 문을 걸어 잠갔지.
    -> elder_talk
+ { not has_amulet } [도울 방법이 있을까요?]
    촌장: 이 부적을 가져가게. 문지기가 보면 마음을 열지도 모르지.
    ~ has_amulet = true
    (부적을 얻었다)
    -> elder_talk
+ [(떠난다)]
    촌장: 몸조심하게.
    -> END

=== guard ===
{ gate_open:
    문지기: 이미 열어 줬잖아. 어서 지나가라고.
    -> END
}
문지기: 멈춰! 북문은 통행금지다.
-> guard_talk

= guard_talk
+ [설득한다 (매력 DC 12)]
    { check("cha", 12):
        ~ guard_persuaded = true
        ~ gate_open = true
        문지기: ...좋아, 네 말에도 일리가 있군. 열어 주지.
        -> END
    - else:
        문지기: 말은 번지르르하군. 하지만 안 돼.
        -> guard_talk
    }
+ { has_amulet } [촌장의 부적을 보여 준다]
    ~ gate_open = true
    문지기: 이건 촌장님의 부적... 알았다, 지나가라.
    -> END
+ { not guard_bribed } [금화로 매수한다]
    ~ guard_bribed = true
    ~ gate_open = true
    문지기: 흠흠... 오늘은 아무것도 못 봤다.
    -> END
+ [위협한다 (힘 DC 15)]
    { check("str", 15):
        ~ gate_open = true
        문지기: 히익! 가, 가라!
        -> END
    - else:
        문지기: 웃기는군. 꺼져!
        -> guard_talk
    }
+ [물러난다]
    -> END
