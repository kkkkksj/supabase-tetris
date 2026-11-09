# Block Drop

브라우저에서 즐기는 블록 퍼즐 게임입니다. 점수와 피드백은 Supabase에 저장되고, Vercel로 배포합니다.
자세한 요구사항은 [PRD.md](PRD.md)를 참고하세요.

## 기능
- 10×20 보드, 7종 블록(7-bag), 회전(wall kick), 소프트/하드 드롭, 홀드, 다음 블록 3개 미리보기
- 점수·레벨·줄 수, 레벨이 오를수록 빨라지는 낙하 속도 (고스트 피스 없음)
- 게임 오버 후 닉네임으로 점수 저장, TOP 20 랭킹
- 피드백(닉네임·별점·내용) 작성과 최근 20개 보기
- Web Audio API로 합성한 배경음·효과음, 음소거·볼륨 설정 저장
- 모바일 터치 버튼

## 조작
| 키 | 동작 |
|---|---|
| ← / → | 이동 |
| ↓ | 빠르게 내리기 |
| Space | 바로 떨어뜨리기 |
| ↑ / X | 시계 방향 회전 |
| Z | 반시계 방향 회전 |
| C / Shift | 보관(홀드) |
| P / Esc | 일시정지 |
| M | 음소거 |

## 설정 방법

### 1. Supabase
1. [supabase.com](https://supabase.com)에서 새 프로젝트를 만듭니다.
2. **SQL Editor**에서 [supabase/schema.sql](supabase/schema.sql) 내용을 붙여넣고 실행합니다.
3. **Project Settings → API**에서 `Project URL`과 `anon public` 키를 복사합니다.

### 2. 로컬 실행 (Node.js 18 이상 필요)
```bash
npm install
cp .env.example .env.local   # Windows: copy .env.example .env.local
# .env.local 에 Supabase URL과 anon 키 입력
npm run dev
```

### 3. Vercel 배포
1. 코드를 GitHub 저장소(`https://github.com/kkkkksj/supabase-tetris`)에 푸시합니다.
2. Vercel → **Add New Project** → 저장소 선택. Framework Preset은 **Vite**로 자동 인식됩니다.
3. **Environment Variables**에 `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`를 추가하고 **Deploy**.
4. 이후 `main` 브랜치에 푸시하면 자동으로 다시 배포됩니다.

> service_role 키는 절대 프런트엔드나 저장소에 넣지 마세요. anon 키는 공개되어도 되며, 데이터는 RLS 정책(조회·추가만 허용)으로 보호됩니다.

## 폴더 구조
```
src/
  main.js          화면 전환, 이벤트 연결, 게임 루프
  styles.css
  storage.js       localStorage 래퍼
  game/            board, pieces, randomizer, game, input, renderer
  audio/sound.js   배경음·효과음 합성
  api/             supabase 클라이언트, scores, feedback
supabase/schema.sql
```
