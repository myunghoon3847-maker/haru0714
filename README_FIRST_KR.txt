하루니혼 Lite Android 재정리판 v1.0.1

이 압축파일은 GitHub에 다시 업로드하기 쉽게 만든 '깨끗한 Android Studio 프로젝트'입니다.
HTML 파일을 GitHub 첫 화면에 따로 올리지 않아도 됩니다.
앱 화면 HTML은 app/src/main/assets/index.html 안에 들어 있습니다.

[가장 중요한 업로드 기준]
GitHub 저장소 첫 화면에 아래 파일/폴더가 바로 보여야 합니다.

app
build.gradle
settings.gradle
.github
.gitignore
play-store

[GitHub 업로드 방법]
1. 이 ZIP 파일을 압축 해제합니다.
2. 압축 해제된 폴더 안으로 들어갑니다.
3. 그 안의 파일과 폴더를 모두 선택합니다.
4. GitHub 저장소 > Add file > Upload files에 드래그합니다.
5. Commit changes를 누릅니다.

주의:
압축 해제된 폴더 자체를 통째로 한 번 더 안에 넣지 마세요.
즉, GitHub 첫 화면이 harunihon_lite_android_clean_v1_0_1 폴더 하나만 보이면 잘못 올린 것입니다.
그 폴더 안의 app, build.gradle, settings.gradle이 첫 화면에 보여야 합니다.

[Actions 실행]
1. GitHub 저장소 상단의 Actions 클릭
2. Android Build Check 클릭
3. Run workflow 클릭
4. 성공하면 Artifacts에서 harunihon-build-files 다운로드

[현재 포함된 기능]
- 히라가나/가타카나 보기
- 기초 단어 화면
- 생활회화 화면
- 일본어 음성 듣기
- 랜덤 퀴즈
- 블루 계열 하루니혼 스타일

[중요]
이 버전은 GitHub 업로드와 Android 빌드 흐름을 다시 잡기 위한 Lite 재정리판입니다.
Play 스토어에 실제 업로드하기 전에는 다음 작업이 필요합니다.
1. 앱 서명용 upload key 설정
2. 스토어용 아이콘/스크린샷/설명문 준비
3. 개인정보처리방침 URL 준비
4. 단어/회화 데이터 최종 검수
