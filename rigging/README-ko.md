# 워해머 v55 리깅 소스

기존 통합 패키지에서 공방 HTML을 제외한 리깅 전용 자료입니다.

- 골격 14종: 범용 5, 기승 5, 하마 4. 각각 12개 동작.
- 각 폴더: 편집용 JSON, 실제 바이너리 skel, atlas, 투명 부위 PNG.
- runtime.js: 브라우저용 바이너리 해석·캔버스 렌더링 소스.
- legacy_export.py: Spine 2.1.27 바이너리 직렬화 소스.
- export_all.py: JSON에서 skel과 뷰어 번들을 재생성합니다. Python 표준 라이브러리만 사용합니다.

## 확인 방법

압축을 풀고 이 폴더에서 다음 명령을 실행합니다.

    python export_all.py
    python -m http.server 8000

브라우저에서 http://localhost:8000 을 엽니다. 첫 명령은 JSON을 수정한 뒤에도 다시 실행할 수 있습니다.

원본 그림 픽셀은 변경하지 않았으며 부위 영역은 JSON의 regions와 atlas에 지정되어 있습니다. IK를 구운 키프레임으로 제공하며, 편집기 전용 프로젝트 파일은 포함하지 않습니다. 실제 다키스트 던전 게임 설치 호환성은 검증하지 않았습니다.
