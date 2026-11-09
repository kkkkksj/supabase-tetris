# PRD: 웹 기반 블록 퍼즐 게임 (supabase-tetris)

- 작성일: 2026-11-09
- 저장소: https://github.com/kkkkksj/supabase-tetris.git
- 배포: Vercel
- 백엔드: Supabase (PostgreSQL + REST API)

---

## 1. 개요

브라우저에서 바로 즐길 수 있는 떨어지는 블록 퍼즐 게임(테트리스 장르)을 만든다. 게임이 끝나면 점수를 Supabase에 저장하고 랭킹(리더보드)으로 보여준다. 사용자는 게임에 대한 피드백을 남길 수 있다. 배경음과 효과음을 넣는다.

### 1.1 목표
- 회원가입 없이 접속하자마자 플레이할 수 있다.
- 게임이 끝나면 닉네임과 함께 점수를 저장하고, 전체 순위를 볼 수 있다.
- 사용자가 피드백(의견, 별점)을 남기고, 다른 사람의 피드백도 볼 수 있다.
- 배경음과 효과음으로 손맛을 살리고, 사용자가 켜고 끌 수 있다.
- GitHub에 푸시하면 Vercel이 자동으로 배포한다.

### 1.2 범위에서 제외 (Non-goals)
- **고스트 피스(블록이 떨어질 위치를 미리 보여주는 그림자)는 넣지 않는다.** (요구사항: "그림자 효과는 없어도 됨")
  - 블록이나 UI에 장식용 그림자(box-shadow 등)도 꼭 필요하지 않다.
- 회원가입, 로그인, 소셜 로그인
- 실시간 멀티플레이어 대전
- 관리자 페이지 (피드백과 점수 관리는 Supabase 대시보드에서 직접 한다)
- 네이티브 모바일 앱

---

## 2. 사용자와 시나리오

| 사용자 | 시나리오 |
|---|---|
| 일반 플레이어 | 링크로 접속 → 시작 버튼 → 플레이 → 게임 오버 → 닉네임 입력 후 점수 저장 → 리더보드에서 내 순위 확인 |
| 피드백 작성자 | 피드백 탭 열기 → 닉네임, 별점, 내용 입력 → 제출 → 목록에 내 피드백 표시 |
| 소리를 끄고 싶은 사용자 | 음소거 버튼을 누르거나 배경음과 효과음 볼륨을 따로 조절 → 설정이 다음 방문 때도 유지됨 |

---

## 3. 기능 요구사항

우선순위: **P0** = 꼭 필요(MVP), **P1** = 있으면 좋음, **P2** = 나중에

### 3.1 게임 플레이 (P0)

| ID | 요구사항 |
|---|---|
| G-1 | 보드 크기는 가로 10칸, 세로 20칸이다. (보이지 않는 위쪽 2줄은 블록 생성용으로 둔다) |
| G-2 | 7종 블록(I, O, T, S, Z, J, L)을 쓴다. 블록마다 색이 다르다. |
| G-3 | 블록 순서는 7-bag 방식으로 뽑는다. (7개를 한 묶음으로 섞어 차례로 내보내서 같은 블록이 너무 오래 안 나오는 일을 막는다) |
| G-4 | 블록이 일정 간격으로 한 칸씩 내려오고, 바닥이나 다른 블록에 닿으면 고정된다. 고정 전 짧은 유예 시간(lock delay, 약 0.5초)을 둔다. |
| G-5 | 가로 한 줄이 꽉 차면 그 줄을 지우고 위의 블록을 내린다. 여러 줄을 한 번에 지울 수 있다. |
| G-6 | 회전은 시계 방향과 반시계 방향을 모두 지원한다. 벽이나 블록에 막히면 옆으로 살짝 밀어서 회전을 시도한다(wall kick). |
| G-7 | 다음에 나올 블록을 최소 1개(권장 3개) 미리 보여준다. |
| G-8 | 새 블록이 생성 위치에 놓일 수 없으면 게임 오버다. |
| G-9 | 일시정지와 재개를 할 수 있다. 브라우저 탭을 벗어나면 자동으로 일시정지한다. |
| G-10 | 화면에 현재 점수, 레벨, 지운 줄 수를 표시한다. |
| G-11 | 홀드(블록 하나를 보관했다가 꺼내 쓰기) 기능 — **P1** |

### 3.2 조작 (P0)

| 키 | 동작 |
|---|---|
| ← / → | 좌우 이동 (누르고 있으면 반복 이동) |
| ↓ | 소프트 드롭 (빠르게 내리기) |
| Space | 하드 드롭 (즉시 바닥까지 떨어뜨리고 고정) |
| ↑ 또는 X | 시계 방향 회전 |
| Z | 반시계 방향 회전 |
| C 또는 Shift | 홀드 (P1) |
| P 또는 Esc | 일시정지 / 재개 |
| M | 음소거 켜기 / 끄기 |

- 모바일 터치 조작(화면 버튼 또는 스와이프) — **P1**

### 3.3 점수와 레벨 (P0)

| 동작 | 점수 |
|---|---|
| 1줄 지우기 | 100 × 레벨 |
| 2줄 지우기 | 300 × 레벨 |
| 3줄 지우기 | 500 × 레벨 |
| 4줄 지우기 | 800 × 레벨 |
| 소프트 드롭 | 내려간 칸 수 × 1 |
| 하드 드롭 | 내려간 칸 수 × 2 |

- 레벨 1에서 시작하고, 10줄을 지울 때마다 레벨이 1 오른다.
- 레벨이 오를수록 블록이 빨리 떨어진다. (예: 레벨 1은 1초에 한 칸, 레벨 15 이상은 0.05초 이하)

### 3.4 점수 저장과 리더보드 (P0)

| ID | 요구사항 |
|---|---|
| S-1 | 게임 오버 화면에서 닉네임(2~12자)을 입력하고 "점수 저장"을 누르면 Supabase `scores` 테이블에 저장된다. |
| S-2 | 저장하는 값: 닉네임, 점수, 지운 줄 수, 도달 레벨, 플레이 시간(초), 저장 시각 |
| S-3 | 마지막으로 쓴 닉네임은 브라우저(localStorage)에 기억해 다음에 자동으로 채운다. |
| S-4 | 리더보드는 점수가 높은 순으로 상위 10명(권장 20명)을 보여준다. |
| S-5 | 저장 직후 리더보드를 새로 불러오고, 방금 저장한 기록을 강조 표시한다. |
| S-6 | 같은 기록이 두 번 저장되지 않도록 저장 버튼은 한 번만 누를 수 있다. |
| S-7 | 저장에 실패하면(네트워크 오류 등) 오류 메시지와 "다시 시도" 버튼을 보여준다. |
| S-8 | 점수가 0점이면 저장 버튼을 비활성화한다. |
| S-9 | 기간별 랭킹(오늘 / 이번 주 / 전체) 탭 — **P1** |

### 3.5 피드백 (P0)

| ID | 요구사항 |
|---|---|
| F-1 | 메인 화면이나 게임 오버 화면에서 피드백 창을 열 수 있다. |
| F-2 | 입력 항목: 닉네임(선택, 비우면 "익명"), 별점 1~5(선택), 내용(필수, 1~500자) |
| F-3 | 제출하면 Supabase `feedback` 테이블에 저장되고 "감사합니다" 메시지를 보여준다. |
| F-4 | 최근 피드백 20개를 최신순으로 보여준다. |
| F-5 | 도배를 막기 위해 한 브라우저에서 30초에 한 번만 제출할 수 있다(클라이언트 측 제한). |
| F-6 | 내용은 화면에 넣을 때 반드시 텍스트로만 넣는다(`textContent` 사용, `innerHTML` 금지). 악성 스크립트 삽입(XSS)을 막기 위해서다. |

### 3.6 사운드 (P0)

| ID | 요구사항 |
|---|---|
| A-1 | 게임 중 배경음이 반복 재생된다. 일시정지하면 멈추고, 게임 오버 시 멈춘다. |
| A-2 | 효과음 종류: 이동, 회전, 하드 드롭(착지), 줄 지우기, 4줄 동시 지우기, 레벨 업, 게임 오버 |
| A-3 | 음소거 버튼과 배경음 / 효과음 볼륨 슬라이더를 따로 둔다. |
| A-4 | 사운드 설정은 localStorage에 저장해 다음 방문 때도 유지한다. |
| A-5 | 브라우저 자동재생 정책 때문에 소리는 사용자가 처음 클릭하거나 키를 누른 뒤에 시작한다(시작 버튼 클릭 시점). |
| A-6 | 음원 저작권 문제를 피하기 위해 **Web Audio API로 직접 합성**하거나, 상업적 이용이 가능한 무료 음원(CC0 등)만 쓴다. 기존 게임의 배경음악을 그대로 쓰거나 따라 만들지 않는다. |

### 3.7 화면 구성 (P0)

1. **시작 화면**: 게임 제목, 시작 버튼, 리더보드 미리보기, 피드백 버튼, 사운드 설정
2. **게임 화면**: 가운데 보드, 옆에 다음 블록 / 점수 / 레벨 / 줄 수, 일시정지 버튼, 음소거 버튼
3. **일시정지 화면**: 재개, 다시 시작, 사운드 설정
4. **게임 오버 화면**: 최종 점수, 닉네임 입력과 저장 버튼, 리더보드, 다시 하기, 피드백 쓰기
5. **피드백 창**(모달): 입력 폼과 최근 피드백 목록

- 데스크톱(1280px 이상)과 모바일(375px 이상) 화면 모두에서 보드가 잘리지 않아야 한다.

---

## 4. 비기능 요구사항

| 항목 | 기준 |
|---|---|
| 성능 | 게임 루프는 `requestAnimationFrame`으로 돌리고, 일반 노트북에서 60fps를 유지한다. |
| 로딩 | 첫 화면이 3초 안에 뜬다(일반 4G 기준). 음원은 게임 시작 전에 미리 불러온다. |
| 브라우저 | 최신 Chrome, Edge, Safari, Firefox |
| 보안 | Supabase 공개 키(anon key)만 프런트에 넣고, 데이터 보호는 RLS(행 수준 보안) 정책으로 한다. service_role 키는 절대 프런트 코드나 저장소에 넣지 않는다. |
| 오류 처리 | Supabase에 연결이 안 돼도 게임 자체는 계속 할 수 있어야 한다. (리더보드와 피드백만 "불러올 수 없음" 표시) |
| 접근성 | 버튼에 이해할 수 있는 라벨을 붙이고, 키보드만으로 모든 메뉴를 쓸 수 있다. |

---

## 5. 기술 구성

### 5.1 기술 스택 (권장)

| 영역 | 선택 | 이유 |
|---|---|---|
| 빌드 도구 | Vite | 설정이 단순하고 Vercel이 자동으로 인식한다. |
| 언어 | JavaScript (또는 TypeScript) + HTML + CSS | 게임 하나에는 프레임워크 없이도 충분하다. |
| 렌더링 | HTML5 Canvas | 블록 그리기에 빠르고 단순하다. |
| 사운드 | Web Audio API | 볼륨 조절과 짧은 효과음 재생이 쉽고, 음원 파일 없이 합성도 가능하다. |
| DB 연동 | `@supabase/supabase-js` | 공식 클라이언트 라이브러리 |
| 배포 | Vercel (GitHub 연동) | `main` 브랜치에 푸시하면 자동 배포 |

### 5.2 폴더 구조 (예시)

```
supabase-tetris/
├─ index.html
├─ package.json
├─ vite.config.js
├─ .env.example            # 환경 변수 예시 (실제 키는 넣지 않음)
├─ supabase/
│  └─ schema.sql           # 테이블과 RLS 정책
├─ public/
│  └─ sounds/              # (음원 파일을 쓸 경우)
└─ src/
   ├─ main.js              # 화면 전환, 초기화
   ├─ game/
   │  ├─ board.js          # 보드 상태, 줄 지우기
   │  ├─ pieces.js         # 블록 모양, 회전, wall kick
   │  ├─ randomizer.js     # 7-bag
   │  ├─ game.js           # 게임 루프, 점수, 레벨
   │  └─ input.js          # 키보드/터치 입력
   ├─ audio/
   │  └─ sound.js          # 배경음, 효과음, 볼륨
   ├─ api/
   │  ├─ supabase.js       # 클라이언트 생성
   │  ├─ scores.js         # 점수 저장, 리더보드 조회
   │  └─ feedback.js       # 피드백 저장, 조회
   └─ styles.css
```

### 5.3 환경 변수

| 이름 | 설명 | 설정 위치 |
|---|---|---|
| `VITE_SUPABASE_URL` | Supabase 프로젝트 URL | 로컬 `.env.local`, Vercel 프로젝트 설정 → Environment Variables |
| `VITE_SUPABASE_ANON_KEY` | Supabase 공개(anon) 키 | 위와 같음 |

- `.env.local`은 `.gitignore`에 넣어 저장소에 올라가지 않게 한다.

---

## 6. 데이터 모델 (Supabase)

### 6.1 `scores` 테이블

| 컬럼 | 타입 | 제약 |
|---|---|---|
| `id` | `uuid` | 기본키, `gen_random_uuid()` |
| `nickname` | `text` | 필수, 2~12자 |
| `score` | `integer` | 필수, 0 이상, 상한 예: 9,999,999 |
| `lines` | `integer` | 필수, 0 이상 |
| `level` | `integer` | 필수, 1 이상 |
| `duration_sec` | `integer` | 필수, 0 이상 |
| `created_at` | `timestamptz` | 기본값 `now()` |

- 인덱스: `score desc` (리더보드 조회용)

### 6.2 `feedback` 테이블

| 컬럼 | 타입 | 제약 |
|---|---|---|
| `id` | `uuid` | 기본키, `gen_random_uuid()` |
| `nickname` | `text` | 기본값 `'익명'`, 최대 12자 |
| `rating` | `smallint` | 선택, 1~5 |
| `message` | `text` | 필수, 1~500자 |
| `created_at` | `timestamptz` | 기본값 `now()` |

### 6.3 RLS(행 수준 보안) 정책

두 테이블 모두 RLS를 켜고, 로그인하지 않은 사용자(`anon`)에게 아래 권한만 준다.

| 테이블 | 조회(SELECT) | 추가(INSERT) | 수정(UPDATE) | 삭제(DELETE) |
|---|---|---|---|---|
| `scores` | 허용 | 허용 (위 제약조건 통과 시) | 금지 | 금지 |
| `feedback` | 허용 | 허용 (위 제약조건 통과 시) | 금지 | 금지 |

### 6.4 schema.sql 초안

```sql
create table public.scores (
  id uuid primary key default gen_random_uuid(),
  nickname text not null check (char_length(nickname) between 2 and 12),
  score integer not null check (score between 0 and 9999999),
  lines integer not null check (lines >= 0),
  level integer not null check (level >= 1),
  duration_sec integer not null check (duration_sec >= 0),
  created_at timestamptz not null default now()
);
create index scores_score_idx on public.scores (score desc);

create table public.feedback (
  id uuid primary key default gen_random_uuid(),
  nickname text not null default '익명' check (char_length(nickname) <= 12),
  rating smallint check (rating between 1 and 5),
  message text not null check (char_length(message) between 1 and 500),
  created_at timestamptz not null default now()
);

alter table public.scores enable row level security;
alter table public.feedback enable row level security;

create policy "scores read"   on public.scores   for select to anon using (true);
create policy "scores insert" on public.scores   for insert to anon with check (true);
create policy "feedback read"   on public.feedback for select to anon using (true);
create policy "feedback insert" on public.feedback for insert to anon with check (true);
```

---

## 7. 배포 절차

1. Supabase에서 새 프로젝트를 만들고, SQL Editor에서 `supabase/schema.sql`을 실행한다.
2. Supabase 프로젝트 설정 → API에서 Project URL과 anon key를 복사한다.
3. 코드를 `https://github.com/kkkkksj/supabase-tetris.git`의 `main` 브랜치에 푸시한다.
4. Vercel에서 "New Project" → 위 저장소를 가져온다. Framework Preset은 **Vite**, 빌드 명령은 `npm run build`, 출력 폴더는 `dist`.
5. Vercel 환경 변수에 `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`를 등록하고 배포한다.
6. 이후에는 `main`에 푸시할 때마다 자동으로 배포된다. 다른 브랜치나 PR은 미리보기(Preview) 주소로 배포된다.

---

## 8. 위험 요소와 대응

| 위험 | 설명 | 대응 |
|---|---|---|
| 점수 조작 | 점수 계산이 브라우저에서 이뤄지므로, 마음먹으면 API로 가짜 점수를 넣을 수 있다. | MVP는 DB 제약(점수 상한 등)으로 터무니없는 값만 막는다. 필요하면 P2로 Supabase Edge Function에서 점수와 플레이 시간, 줄 수의 관계를 검증한다(예: 줄 수 대비 점수가 이론상 최대치를 넘으면 거부). |
| 피드백 스팸·욕설 | 로그인이 없어 누구나 쓸 수 있다. | 클라이언트 측 30초 제한, 글자 수 제한. 문제가 생기면 Supabase 대시보드에서 삭제. P2로 금칙어 필터나 Captcha 도입. |
| 자동재생 차단 | 브라우저가 사용자 동작 전 소리 재생을 막는다. | 시작 버튼 클릭 시 AudioContext를 시작한다. |
| 상표·저작권 | "Tetris"는 등록 상표이고, 원작의 음악·디자인은 저작권 보호 대상이다. | 게임 이름은 독자적인 이름으로 정한다(저장소 이름은 그대로 둬도 무방). 원작의 음악, 로고, 화면 디자인을 따라 하지 않는다. |
| Supabase 무료 플랜 일시정지 | 무료 프로젝트는 일정 기간 사용이 없으면 일시정지될 수 있다. | 접속이 없을 때 대비해 오류 처리(4장)를 해 두고, 필요하면 대시보드에서 재개한다. |

---

## 9. 완료 기준 (MVP)

- [ ] 7종 블록이 7-bag으로 나오고, 이동·회전·소프트/하드 드롭·줄 지우기·게임 오버가 정상 동작한다.
- [ ] 고스트 피스가 없다.
- [ ] 점수, 레벨, 줄 수가 3.3의 규칙대로 계산되고, 레벨에 따라 속도가 빨라진다.
- [ ] 다음 블록 미리보기와 일시정지가 동작한다.
- [ ] 게임 오버 후 닉네임과 점수를 저장하면 Supabase `scores`에 기록되고, 리더보드에 반영된다.
- [ ] 피드백을 제출하면 Supabase `feedback`에 기록되고, 목록에 표시된다.
- [ ] 배경음과 7종 효과음이 나오고, 음소거와 볼륨 설정이 유지된다.
- [ ] anon 키로는 점수와 피드백을 수정·삭제할 수 없다(RLS 확인).
- [ ] Supabase 연결이 끊겨도 게임은 할 수 있다.
- [ ] Vercel 배포 주소에서 데스크톱과 모바일 브라우저 모두 정상 동작한다.

---

## 10. 결정이 필요한 사항

| 질문 | 기본안 (따로 정하지 않으면 이대로 진행) |
|---|---|
| 게임 이름 | 독자적인 이름을 정한다 (예: "Block Drop") |
| 피드백을 다른 사용자에게 공개할지 | 공개 (최근 20개 표시) |
| 모바일 터치 조작을 MVP에 넣을지 | P1 (MVP 이후) |
| 홀드 기능을 MVP에 넣을지 | P1 (MVP 이후) |
| 같은 닉네임의 여러 기록을 리더보드에 모두 보여줄지 | 모두 보여준다 (닉네임별 최고 기록만 보여주기는 P1) |
| 음원 | Web Audio API로 직접 합성 |
