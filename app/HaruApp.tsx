"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { HIRAGANA, KATAKANA, PHRASES, WORDS, type Phrase, type Word } from "./data";

type Screen = "home" | "learn" | "words" | "phrases" | "more" | "kana" | "quiz" | "mistakes" | "settings";
type Review = { due: string; interval: number; level: number };
type Mistake = { count: number; last: string };
type Daily = { words: number; phrases: number; quiz: number };
type AppState = {
  favorites: string[];
  mastered: string[];
  phraseFavorites: string[];
  phraseMastered: string[];
  reviews: Record<string, Review>;
  mistakes: Record<string, Mistake>;
  daily: Record<string, Daily>;
  activity: string[];
  dark: boolean;
  largeText: boolean;
  autoSpeech: boolean;
  dailyGoal: number;
};

type InstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

const DEFAULT_STATE: AppState = {
  favorites: [],
  mastered: [],
  phraseFavorites: [],
  phraseMastered: [],
  reviews: {},
  mistakes: {},
  daily: {},
  activity: [],
  dark: false,
  largeText: false,
  autoSpeech: false,
  dailyGoal: 20,
};

const STORAGE_KEY = "harunihon-lite-v1";
const DAY = 24 * 60 * 60 * 1000;

function todayKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function addDays(days: number) {
  return todayKey(new Date(Date.now() + days * DAY));
}

function shuffle<T>(items: T[]) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function speakJapanese(text: string) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "ja-JP";
  utterance.rate = 0.86;
  const voice = window.speechSynthesis.getVoices().find((item) => item.lang.toLowerCase().startsWith("ja"));
  if (voice) utterance.voice = voice;
  window.speechSynthesis.speak(utterance);
}

function streakCount(activity: string[]) {
  const days = new Set(activity);
  let count = 0;
  const cursor = new Date();
  if (!days.has(todayKey(cursor))) cursor.setDate(cursor.getDate() - 1);
  while (days.has(todayKey(cursor))) {
    count += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return count;
}

function StarButton({ active, onClick, label = "즐겨찾기" }: { active: boolean; onClick: () => void; label?: string }) {
  return (
    <button className={`icon-button ${active ? "is-active" : ""}`} onClick={onClick} aria-label={label} title={label}>
      {active ? "★" : "☆"}
    </button>
  );
}

function SpeakerButton({ text, compact = false }: { text: string; compact?: boolean }) {
  return (
    <button className={compact ? "icon-button" : "soft-button"} onClick={() => speakJapanese(text)} aria-label="일본어 발음 듣기">
      <span aria-hidden="true">♪</span>{compact ? null : " 발음 듣기"}
    </button>
  );
}

export default function HaruApp() {
  const [screen, setScreen] = useState<Screen>("home");
  const [state, setState] = useState<AppState>(DEFAULT_STATE);
  const [ready, setReady] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setState({ ...DEFAULT_STATE, ...JSON.parse(saved) });
    } catch {
      setState(DEFAULT_STATE);
    }
    setReady(true);
    const requested = new URLSearchParams(window.location.search).get("open");
    if (requested && ["learn", "words", "phrases", "more", "kana", "quiz", "mistakes", "settings"].includes(requested)) setScreen(requested as Screen);
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    const capturePrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", capturePrompt);
    return () => window.removeEventListener("beforeinstallprompt", capturePrompt);
  }, []);

  useEffect(() => {
    if (ready) localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [ready, state]);

  const patchState = useCallback((patch: Partial<AppState> | ((current: AppState) => Partial<AppState>)) => {
    setState((current) => ({ ...current, ...(typeof patch === "function" ? patch(current) : patch) }));
  }, []);

  const markActivity = useCallback((kind: keyof Daily, amount = 1) => {
    patchState((current) => {
      const today = todayKey();
      const daily = current.daily[today] || { words: 0, phrases: 0, quiz: 0 };
      return {
        daily: { ...current.daily, [today]: { ...daily, [kind]: daily[kind] + amount } },
        activity: current.activity.includes(today) ? current.activity : [...current.activity, today],
      };
    });
  }, [patchState]);

  const toggleIn = useCallback((field: "favorites" | "mastered" | "phraseFavorites" | "phraseMastered", id: string) => {
    patchState((current) => ({ [field]: current[field].includes(id) ? current[field].filter((item) => item !== id) : [...current[field], id] }));
  }, [patchState]);

  const rateWord = useCallback((word: Word, grade: "again" | "hard" | "good" | "easy") => {
    const settings = { again: { days: 0, level: 0 }, hard: { days: 1, level: 1 }, good: { days: 3, level: 2 }, easy: { days: 7, level: 3 } }[grade];
    patchState((current) => {
      const previous = current.reviews[word.id];
      const multiplier = grade === "again" ? 0 : grade === "hard" ? 1.3 : grade === "good" ? 2 : 3;
      const interval = previous ? Math.max(settings.days, Math.round(previous.interval * multiplier)) : settings.days;
      return {
        reviews: { ...current.reviews, [word.id]: { due: addDays(interval), interval, level: settings.level } },
        mastered: grade === "easy" || (grade === "good" && previous?.level === 3)
          ? Array.from(new Set([...current.mastered, word.id]))
          : current.mastered,
      };
    });
    markActivity("words");
  }, [markActivity, patchState]);

  const addMistake = useCallback((id: string) => {
    patchState((current) => ({
      mistakes: {
        ...current.mistakes,
        [id]: { count: (current.mistakes[id]?.count || 0) + 1, last: todayKey() },
      },
    }));
  }, [patchState]);

  const install = async () => {
    if (installPrompt) {
      await installPrompt.prompt();
      await installPrompt.userChoice;
      setInstallPrompt(null);
    } else {
      alert("브라우저 메뉴에서 ‘홈 화면에 추가’ 또는 ‘앱 설치’를 선택해 주세요.");
    }
  };

  const shared = { state, patchState, markActivity, toggleIn, rateWord, addMistake, go: setScreen, install };

  return (
    <main className={`app-shell ${state.dark ? "theme-dark" : ""} ${state.largeText ? "large-text" : ""}`}>
      <div className="phone-stage">
        {screen === "home" && <HomeScreen {...shared} />}
        {screen === "learn" && <LearnScreen {...shared} />}
        {screen === "words" && <WordsScreen {...shared} />}
        {screen === "phrases" && <PhrasesScreen {...shared} />}
        {screen === "more" && <MoreScreen {...shared} />}
        {screen === "kana" && <KanaScreen {...shared} />}
        {screen === "quiz" && <QuizScreen {...shared} />}
        {screen === "mistakes" && <MistakesScreen {...shared} />}
        {screen === "settings" && <SettingsScreen {...shared} />}
        <BottomNav screen={screen} go={setScreen} />
      </div>
    </main>
  );
}

type SharedProps = {
  state: AppState;
  patchState: (patch: Partial<AppState> | ((current: AppState) => Partial<AppState>)) => void;
  markActivity: (kind: keyof Daily, amount?: number) => void;
  toggleIn: (field: "favorites" | "mastered" | "phraseFavorites" | "phraseMastered", id: string) => void;
  rateWord: (word: Word, grade: "again" | "hard" | "good" | "easy") => void;
  addMistake: (id: string) => void;
  go: (screen: Screen) => void;
  install: () => Promise<void>;
};

function ScreenHeader({ title, subtitle, onBack, action }: { title: string; subtitle?: string; onBack?: () => void; action?: React.ReactNode }) {
  return (
    <header className="screen-header">
      <div className="header-title-row">
        {onBack && <button className="back-button" onClick={onBack} aria-label="뒤로가기">‹</button>}
        <div>
          <h1>{title}</h1>
          {subtitle && <p>{subtitle}</p>}
        </div>
        {action && <div className="header-action">{action}</div>}
      </div>
    </header>
  );
}

function HomeScreen({ state, go, toggleIn }: SharedProps) {
  const today = state.daily[todayKey()] || { words: 0, phrases: 0, quiz: 0 };
  const completed = today.words + today.phrases + today.quiz;
  const progress = Math.min(100, Math.round((completed / state.dailyGoal) * 100));
  const dailyPhrase = PHRASES[Math.floor(Date.now() / DAY) % PHRASES.length];
  const due = Object.entries(state.reviews).filter(([, review]) => review.due <= todayKey()).length;
  const week = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(Date.now() - (6 - index) * DAY);
    return { key: todayKey(date), label: ["일", "월", "화", "수", "목", "금", "토"][date.getDay()] };
  });

  return (
    <section className="screen home-screen">
      <div className="brand-header">
        <div className="brand-lockup">
          <div className="brand-mark" aria-hidden="true">は</div>
          <div><strong>하루니혼</strong><span>매일 가볍게, 일본어 한 걸음</span></div>
        </div>
        <button className="avatar-button" onClick={() => go("settings")} aria-label="설정 열기">⚙</button>
      </div>

      <article className="today-card">
        <div className="today-copy">
          <span className="eyebrow">오늘의 학습</span>
          <h1>{progress === 100 ? "오늘도 해냈어요!" : due ? `복습할 단어가 ${due}개 있어요` : "10분만 함께 공부해요"}</h1>
          <p>{completed} / {state.dailyGoal}개 완료 · {streakCount(state.activity)}일 연속 학습</p>
          <button className="primary-button" onClick={() => go("learn")}>{completed ? "이어서 학습하기" : "오늘 학습 시작"}<span>→</span></button>
        </div>
        <div className="progress-ring" style={{ "--progress": `${progress * 3.6}deg` } as React.CSSProperties}>
          <div><strong>{progress}%</strong><span>완료</span></div>
        </div>
      </article>

      <div className="section-heading"><div><span>오늘의 코스</span><small>짧게 끝내고 오래 기억해요</small></div></div>
      <div className="course-list">
        <button className="course-row" onClick={() => go("learn")}>
          <span className="course-icon blue">復</span><span><strong>복습 카드</strong><small>{due ? `${due}개가 복습을 기다려요` : "지금은 복습할 카드가 없어요"}</small></span><b>{Math.min(today.words, 10)}/10</b>
        </button>
        <button className="course-row" onClick={() => go("phrases")}>
          <span className="course-icon coral">話</span><span><strong>생활회화</strong><small>오늘 바로 쓸 수 있는 표현</small></span><b>{Math.min(today.phrases, 5)}/5</b>
        </button>
        <button className="course-row" onClick={() => go("quiz")}>
          <span className="course-icon mint">問</span><span><strong>마무리 퀴즈</strong><small>배운 내용을 빠르게 확인해요</small></span><b>{Math.min(today.quiz, 5)}/5</b>
        </button>
      </div>

      <article className="phrase-of-day">
        <div className="phrase-top"><span className="eyebrow">오늘의 한 문장</span><StarButton active={state.phraseFavorites.includes(dailyPhrase.id)} onClick={() => toggleIn("phraseFavorites", dailyPhrase.id)} /></div>
        <h2>{dailyPhrase.japanese}</h2>
        <p className="reading">{dailyPhrase.reading}</p>
        <p>{dailyPhrase.korean}</p>
        <SpeakerButton text={dailyPhrase.japanese} />
      </article>

      <article className="weekly-card">
        <div className="section-heading compact"><div><span>이번 주 기록</span><small>{streakCount(state.activity)}일째 이어가는 중</small></div><b>{state.activity.filter((key) => week.some((day) => day.key === key)).length}/7</b></div>
        <div className="week-dots">
          {week.map((day) => <div key={day.key}><span className={state.activity.includes(day.key) ? "done" : ""}>{state.activity.includes(day.key) ? "✓" : ""}</span><small>{day.label}</small></div>)}
        </div>
      </article>
    </section>
  );
}

function LearnScreen({ state, rateWord, go }: SharedProps) {
  const dueWords = useMemo(() => WORDS.filter((word) => state.reviews[word.id]?.due <= todayKey()), [state.reviews]);
  const newWords = useMemo(() => WORDS.filter((word) => !state.reviews[word.id]).slice(0, 20), [state.reviews]);
  const [mode, setMode] = useState<"review" | "new">(dueWords.length ? "review" : "new");
  const cards = mode === "review" && dueWords.length ? dueWords : newWords;
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const current = cards[index];
  const finish = index >= cards.length;

  const rate = (grade: "again" | "hard" | "good" | "easy") => {
    if (!current) return;
    rateWord(current, grade);
    setRevealed(false);
    setIndex((value) => value + 1);
  };

  useEffect(() => {
    if (current && state.autoSpeech) speakJapanese(current.japanese);
  }, [current, state.autoSpeech]);

  return (
    <section className="screen learn-screen">
      <ScreenHeader title="카드 학습" subtitle={finish ? "오늘 학습 완료" : `${index + 1} / ${cards.length}`} action={<button className="text-button" onClick={() => go("home")}>끝내기</button>} />
      <div className="segmented"><button className={mode === "review" ? "active" : ""} onClick={() => { setMode("review"); setIndex(0); setRevealed(false); }}>복습 {dueWords.length}</button><button className={mode === "new" ? "active" : ""} onClick={() => { setMode("new"); setIndex(0); setRevealed(false); }}>새 단어</button></div>
      {!finish && current ? <>
        <div className="session-progress"><span style={{ width: `${((index + 1) / cards.length) * 100}%` }} /></div>
        <article className={`study-card ${revealed ? "revealed" : ""}`} onClick={() => setRevealed(true)}>
          <span className="category-pill">{current.category}</span>
          <SpeakerButton text={current.japanese} compact />
          <div className="study-word"><h2>{current.japanese}</h2><p>{current.reading}</p></div>
          {revealed ? <div className="answer-panel"><strong>{current.korean}</strong>{current.example && <><p>{current.example}</p><small>{current.exampleKo}</small></>}</div> : <div className="tap-hint"><span>뜻 보기</span><small>카드를 눌러 확인하세요</small></div>}
        </article>
        {revealed ? <div className="rating-area"><p>얼마나 잘 기억했나요?</p><div className="rating-grid"><button className="rate-again" onClick={() => rate("again")}><strong>다시</strong><small>오늘</small></button><button onClick={() => rate("hard")}><strong>어려움</strong><small>1일 후</small></button><button onClick={() => rate("good")}><strong>알아요</strong><small>3일 후</small></button><button className="rate-easy" onClick={() => rate("easy")}><strong>쉬워요</strong><small>7일 후</small></button></div></div> : <button className="primary-button full" onClick={() => setRevealed(true)}>뜻 확인하기</button>}
      </> : <article className="completion-card"><div className="celebration">花</div><h2>오늘 학습을 마쳤어요</h2><p>{cards.length}개의 기억을 차곡차곡 쌓았습니다.</p><button className="primary-button full" onClick={() => go("home")}>홈으로 돌아가기</button></article>}
    </section>
  );
}

function WordsScreen({ state, toggleIn, go }: SharedProps) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("전체");
  const categories = ["전체", "즐겨찾기", "미암기", "사람", "음식", "동사", "형용사", "시간·날짜", "세는 말"];
  const filtered = useMemo(() => WORDS.filter((word) => {
    const matchesQuery = !query || `${word.japanese} ${word.reading} ${word.korean}`.toLowerCase().includes(query.toLowerCase());
    const matchesCategory = category === "전체" || (category === "즐겨찾기" ? state.favorites.includes(word.id) : category === "미암기" ? !state.mastered.includes(word.id) : word.category === category);
    return matchesQuery && matchesCategory;
  }), [category, query, state.favorites, state.mastered]);

  return <section className="screen list-screen">
    <ScreenHeader title="기초 단어" subtitle={`${WORDS.length.toLocaleString("ko-KR")}개 · ${state.mastered.length}개 암기`} action={<button className="text-button" onClick={() => go("learn")}>카드 학습</button>} />
    <label className="search-box"><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="일본어·읽기·뜻 검색" aria-label="단어 검색" />{query && <button onClick={() => setQuery("")} aria-label="검색어 지우기">×</button>}</label>
    <div className="chip-row">{categories.map((item) => <button key={item} className={category === item ? "active" : ""} onClick={() => setCategory(item)}>{item}</button>)}</div>
    <div className="result-line"><span>{filtered.length}개의 단어</span><small>눌러서 뜻과 예문 보기</small></div>
    <div className="word-list">{filtered.slice(0, 80).map((word) => <WordRow key={word.id} word={word} state={state} toggleIn={toggleIn} />)}</div>
    {filtered.length > 80 && <p className="list-notice">검색이나 분류를 사용하면 더 빠르게 찾을 수 있어요.</p>}
  </section>;
}

function WordRow({ word, state, toggleIn }: { word: Word; state: AppState; toggleIn: SharedProps["toggleIn"] }) {
  const [open, setOpen] = useState(false);
  return <article className={`word-row ${open ? "open" : ""}`}>
    <button className="word-main" onClick={() => setOpen(!open)}><span><strong>{word.japanese}</strong><small>{word.reading}</small></span><span className="word-meaning">{word.korean}</span><b>{open ? "−" : "+"}</b></button>
    {open && <div className="word-detail">{word.example ? <div className="example-box"><p>{word.example}</p><small>{word.exampleKo}</small></div> : <p className="micro-tip">이 단어를 소리 내어 세 번 읽어 보세요.</p>}<div className="row-actions"><SpeakerButton text={word.japanese} /><StarButton active={state.favorites.includes(word.id)} onClick={() => toggleIn("favorites", word.id)} /><button className={`soft-button ${state.mastered.includes(word.id) ? "is-done" : ""}`} onClick={() => toggleIn("mastered", word.id)}>{state.mastered.includes(word.id) ? "✓ 암기함" : "암기 표시"}</button></div></div>}
  </article>;
}

function PhrasesScreen({ state, toggleIn, markActivity, go }: SharedProps) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("전체");
  const categories = ["전체", ...Array.from(new Set(PHRASES.map((phrase) => phrase.category)))];
  const filtered = PHRASES.filter((phrase) => (category === "전체" || phrase.category === category) && (!query || `${phrase.japanese} ${phrase.reading} ${phrase.korean}`.toLowerCase().includes(query.toLowerCase())));
  return <section className="screen list-screen">
    <ScreenHeader title="생활회화" subtitle="실제로 자주 쓰는 100문장" />
    <label className="search-box"><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="상황이나 표현 검색" aria-label="회화 검색" />{query && <button onClick={() => setQuery("")} aria-label="검색어 지우기">×</button>}</label>
    <div className="chip-row">{categories.map((item) => <button key={item} className={category === item ? "active" : ""} onClick={() => setCategory(item)}>{item}</button>)}</div>
    <div className="phrase-list">{filtered.map((phrase) => <PhraseCard key={phrase.id} phrase={phrase} state={state} toggleIn={toggleIn} onStudy={() => markActivity("phrases")} />)}</div>
    <button className="floating-quiz" onClick={() => go("quiz")}>회화 퀴즈 풀기 <span>→</span></button>
  </section>;
}

function PhraseCard({ phrase, state, toggleIn, onStudy }: { phrase: Phrase; state: AppState; toggleIn: SharedProps["toggleIn"]; onStudy: () => void }) {
  const [showReading, setShowReading] = useState(true);
  return <article className="conversation-card">
    <div className="phrase-top"><span className="category-pill">{phrase.category}</span><StarButton active={state.phraseFavorites.includes(phrase.id)} onClick={() => toggleIn("phraseFavorites", phrase.id)} /></div>
    <button className="phrase-copy" onClick={() => setShowReading(!showReading)}><h2>{phrase.japanese}</h2>{showReading && <p className="reading">{phrase.reading}</p>}<strong>{phrase.korean}</strong></button>
    <div className="note-box"><span>TIP</span><p>{phrase.note}</p></div>
    <div className="row-actions"><button className="soft-button" onClick={() => { speakJapanese(phrase.japanese); onStudy(); }}>♪ 발음 듣기</button><button className={`soft-button ${state.phraseMastered.includes(phrase.id) ? "is-done" : ""}`} onClick={() => { toggleIn("phraseMastered", phrase.id); onStudy(); }}>{state.phraseMastered.includes(phrase.id) ? "✓ 익혔어요" : "학습 완료"}</button></div>
  </article>;
}

function MoreScreen({ state, go, install }: SharedProps) {
  const learned = state.mastered.length + state.phraseMastered.length;
  return <section className="screen more-screen">
    <ScreenHeader title="전체 학습" subtitle="원하는 학습을 골라 시작하세요" />
    <article className="profile-card"><div className="profile-mark">日</div><div><strong>{streakCount(state.activity)}일 연속 학습 중</strong><p>총 {learned}개를 익혔어요</p></div><span>꾸준함 +1</span></article>
    <div className="menu-grid">
      <button onClick={() => go("kana")}><span className="menu-icon blue">あ</span><strong>문자 학습</strong><small>히라가나·가타카나</small></button>
      <button onClick={() => go("quiz")}><span className="menu-icon mint">問</span><strong>퀴즈</strong><small>문자·단어·회화</small></button>
      <button onClick={() => go("mistakes")}><span className="menu-icon coral">!</span><strong>오답노트</strong><small>{Object.keys(state.mistakes).length}개 복습 필요</small></button>
      <button onClick={() => go("settings")}><span className="menu-icon lilac">⚙</span><strong>설정</strong><small>화면·음성·데이터</small></button>
    </div>
    <article className="install-card"><div><span className="eyebrow">스마트폰에 설치</span><h2>하루니혼을 앱처럼 열어보세요</h2><p>홈 화면에서 더 빠르게 시작하고, 인터넷이 불안정해도 학습할 수 있어요.</p></div><button className="primary-button" onClick={install}>앱 설치하기</button></article>
    <p className="version-line">하루니혼 Lite · Version 1.0.0</p>
  </section>;
}

function KanaScreen({ go }: SharedProps) {
  const [type, setType] = useState<"hira" | "kata">("hira");
  const data = type === "hira" ? HIRAGANA : KATAKANA;
  return <section className="screen kana-screen">
    <ScreenHeader title="문자 학습" subtitle="글자를 누르면 발음을 들을 수 있어요" onBack={() => go("more")} />
    <div className="segmented"><button className={type === "hira" ? "active" : ""} onClick={() => setType("hira")}>히라가나</button><button className={type === "kata" ? "active" : ""} onClick={() => setType("kata")}>가타카나</button></div>
    <article className="kana-tip"><span>01</span><div><strong>모양과 소리를 함께 기억하세요</strong><p>한 줄씩 소리 내어 읽으면 더 오래 기억할 수 있어요.</p></div></article>
    <div className="kana-grid">{data.map(([letter, sound]) => <button key={letter} onClick={() => speakJapanese(letter)}><strong>{letter}</strong><small>{sound}</small></button>)}</div>
    <button className="primary-button full" onClick={() => go("quiz")}>문자 퀴즈 시작</button>
  </section>;
}

type QuizQuestion = { id: string; prompt: string; sub?: string; answer: string; options: string[]; speak: string };

function makeQuestion(mode: "mixed" | "word" | "phrase" | "kana"): QuizQuestion {
  const pickedMode = mode === "mixed" ? shuffle(["word", "phrase", "kana"] as const)[0] : mode;
  if (pickedMode === "phrase") {
    const item = PHRASES[Math.floor(Math.random() * PHRASES.length)];
    const wrong = shuffle(PHRASES.filter((value) => value.id !== item.id)).slice(0, 3).map((value) => value.korean);
    return { id: item.id, prompt: item.japanese, sub: item.reading, answer: item.korean, options: shuffle([item.korean, ...wrong]), speak: item.japanese };
  }
  if (pickedMode === "kana") {
    const pool = [...HIRAGANA, ...KATAKANA];
    const item = pool[Math.floor(Math.random() * pool.length)];
    const wrong = shuffle(pool.filter((value) => value[1] !== item[1])).slice(0, 3).map((value) => value[1]);
    return { id: `k-${item[0]}`, prompt: item[0], answer: item[1], options: shuffle([item[1], ...wrong]), speak: item[0] };
  }
  const item = WORDS[Math.floor(Math.random() * WORDS.length)];
  const wrong = shuffle(WORDS.filter((value) => value.id !== item.id)).slice(0, 3).map((value) => value.korean);
  return { id: item.id, prompt: item.japanese, sub: item.reading, answer: item.korean, options: shuffle([item.korean, ...wrong]), speak: item.japanese };
}

function QuizScreen({ go, addMistake, markActivity }: SharedProps) {
  const [mode, setMode] = useState<"mixed" | "word" | "phrase" | "kana">("mixed");
  const [question, setQuestion] = useState<QuizQuestion>(() => makeQuestion("mixed"));
  const [selected, setSelected] = useState<string | null>(null);
  const [count, setCount] = useState(1);
  const [score, setScore] = useState(0);
  const [finished, setFinished] = useState(false);
  const answer = (option: string) => {
    if (selected) return;
    setSelected(option);
    if (option === question.answer) setScore((value) => value + 1); else addMistake(question.id);
    markActivity("quiz");
  };
  const next = () => {
    if (count >= 10) { setFinished(true); return; }
    setCount((value) => value + 1);
    setQuestion(makeQuestion(mode));
    setSelected(null);
  };
  const restart = (nextMode = mode) => {
    setMode(nextMode); setQuestion(makeQuestion(nextMode)); setSelected(null); setCount(1); setScore(0); setFinished(false);
  };
  return <section className="screen quiz-screen">
    <ScreenHeader title="퀴즈" subtitle={finished ? "결과" : `${count} / 10`} onBack={() => go("more")} action={!finished && <span className="score-badge">{score} 정답</span>} />
    {!finished ? <>
      <div className="chip-row quiz-modes">{([['mixed','종합'],['word','단어'],['phrase','회화'],['kana','문자']] as const).map(([value, label]) => <button key={value} className={mode === value ? "active" : ""} onClick={() => restart(value)}>{label}</button>)}</div>
      <div className="session-progress"><span style={{ width: `${count * 10}%` }} /></div>
      <article className="question-card"><span className="eyebrow">알맞은 뜻이나 발음을 고르세요</span><h2>{question.prompt}</h2>{question.sub && <p>{question.sub}</p>}<SpeakerButton text={question.speak} compact /></article>
      <div className="option-list">{question.options.map((option, index) => {
        const className = selected ? option === question.answer ? "correct" : option === selected ? "wrong" : "muted" : "";
        return <button key={`${option}-${index}`} className={className} onClick={() => answer(option)}><span>{index + 1}</span><strong>{option}</strong>{selected && option === question.answer && <b>✓</b>}{selected === option && option !== question.answer && <b>×</b>}</button>;
      })}</div>
      {selected && <div className={`feedback-card ${selected === question.answer ? "correct" : "wrong"}`}><strong>{selected === question.answer ? "정답이에요!" : "괜찮아요, 오답노트에 담았어요."}</strong><p>정답: {question.answer}</p><button className="primary-button full" onClick={next}>{count === 10 ? "결과 보기" : "다음 문제"}</button></div>}
    </> : <article className="completion-card"><div className="result-score"><strong>{score}</strong><span>/ 10</span></div><h2>{score >= 8 ? "아주 잘했어요!" : score >= 5 ? "조금씩 늘고 있어요" : "복습하면 금방 좋아져요"}</h2><p>틀린 문제는 오답노트에서 다시 만날 수 있어요.</p><button className="primary-button full" onClick={() => restart()}>한 번 더 풀기</button><button className="soft-button full" onClick={() => go("mistakes")}>오답노트 보기</button></article>}
  </section>;
}

function MistakesScreen({ state, patchState, go }: SharedProps) {
  const items = Object.entries(state.mistakes).sort((a, b) => b[1].count - a[1].count).map(([id, data]) => ({ id, data, word: WORDS.find((item) => item.id === id), phrase: PHRASES.find((item) => item.id === id), kana: id.startsWith("k-") ? id.slice(2) : null }));
  const remove = (id: string) => patchState((current) => { const mistakes = { ...current.mistakes }; delete mistakes[id]; return { mistakes }; });
  return <section className="screen mistakes-screen">
    <ScreenHeader title="오답노트" subtitle={`${items.length}개를 다시 확인해 보세요`} onBack={() => go("more")} />
    {items.length ? <div className="mistake-list">{items.map((item) => {
      const japanese = item.word?.japanese || item.phrase?.japanese || item.kana || "";
      const reading = item.word?.reading || item.phrase?.reading || "문자 발음 문제";
      const korean = item.word?.korean || item.phrase?.korean || "발음을 다시 확인하세요";
      return <article key={item.id}><div className="mistake-meta"><span>{item.data.count}번 틀림</span><small>최근 {item.data.last}</small></div><h2>{japanese}</h2><p>{reading}</p><strong>{korean}</strong><div className="row-actions"><SpeakerButton text={japanese} /><button className="soft-button is-done" onClick={() => remove(item.id)}>복습 완료</button></div></article>;
    })}</div> : <article className="empty-card"><div>✓</div><h2>아직 오답이 없어요</h2><p>퀴즈에서 틀린 문제는 자동으로 여기에 모아드려요.</p><button className="primary-button" onClick={() => go("quiz")}>퀴즈 시작하기</button></article>}
  </section>;
}

function SettingsScreen({ state, patchState, install, go }: SharedProps) {
  const reset = () => {
    if (confirm("모든 학습 기록을 초기화할까요? 이 작업은 되돌릴 수 없습니다.")) patchState({ ...DEFAULT_STATE });
  };
  return <section className="screen settings-screen">
    <ScreenHeader title="설정" subtitle="나에게 편한 학습 환경을 만들어요" onBack={() => go("more")} />
    <div className="settings-group"><h2>학습</h2><label className="setting-row"><span><strong>하루 학습 목표</strong><small>오늘의 진행률 계산에 사용해요</small></span><select value={state.dailyGoal} onChange={(event) => patchState({ dailyGoal: Number(event.target.value) })}><option value={10}>10개</option><option value={20}>20개</option><option value={30}>30개</option><option value={50}>50개</option></select></label><Toggle label="카드 자동 발음" note="새 카드가 나오면 일본어를 읽어줘요" checked={state.autoSpeech} onChange={(checked) => patchState({ autoSpeech: checked })} /></div>
    <div className="settings-group"><h2>화면</h2><Toggle label="다크 모드" note="어두운 곳에서 눈의 부담을 줄여요" checked={state.dark} onChange={(checked) => patchState({ dark: checked })} /><Toggle label="글자 크게 보기" note="일본어와 설명을 한 단계 크게 표시해요" checked={state.largeText} onChange={(checked) => patchState({ largeText: checked })} /></div>
    <div className="settings-group"><h2>앱</h2><button className="setting-button" onClick={install}><span><strong>스마트폰에 설치</strong><small>홈 화면에서 앱처럼 바로 실행해요</small></span><b>›</b></button><a className="setting-button" href="/privacy.html" target="_blank"><span><strong>개인정보처리방침</strong><small>저장되는 학습 기록을 확인해요</small></span><b>›</b></a></div>
    <button className="danger-button" onClick={reset}>학습 기록 초기화</button><p className="version-line">하루니혼 Lite v1.0.0</p>
  </section>;
}

function Toggle({ label, note, checked, onChange }: { label: string; note: string; checked: boolean; onChange: (value: boolean) => void }) {
  return <label className="setting-row"><span><strong>{label}</strong><small>{note}</small></span><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} /><i aria-hidden="true" /></label>;
}

function BottomNav({ screen, go }: { screen: Screen; go: (screen: Screen) => void }) {
  const normalized = ["kana", "quiz", "mistakes", "settings"].includes(screen) ? "more" : screen;
  const items: { id: Screen; icon: string; label: string }[] = [
    { id: "home", icon: "⌂", label: "홈" }, { id: "learn", icon: "▱", label: "학습" }, { id: "words", icon: "単", label: "단어" }, { id: "phrases", icon: "話", label: "회화" }, { id: "more", icon: "•••", label: "전체" },
  ];
  return <nav className="bottom-nav" aria-label="주 메뉴">{items.map((item) => <button key={item.id} className={normalized === item.id ? "active" : ""} onClick={() => go(item.id)}><span>{item.icon}</span><small>{item.label}</small></button>)}</nav>;
}
