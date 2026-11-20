# BALANCE — editorial content review (RU/EN)

Date: 2026-11-20. Scope: `content/catalog.json`, 44 poses, 22 exercises, 4 programs, 5 pages.
Result: `pnpm content:validate` → **All 75 file(s) valid**. Files changed: **64 of 76** (75 docs + catalog).
No slugs, document ids, step `key` UUIDs, field names or JSON structure were changed. JSON is canonical
(2-space indent, UTF-8, Cyrillic unescaped, final newline). No URLs, sources, teachers, statistics or video
links were added; `video` stays empty everywhere. Nothing is marked as teacher-approved.

Helper scripts (scratch only): `lib.py`, `dump.py`, `dups.py`, `lint.py`, `refs.py`, `pass_us.py`,
`apply_edits.py`, `apply_edits2.py`, `normalize_names.py` in this folder.

---

## 1. What was checked

| Check | Method | Finding before | After |
|---|---|---|---|
| Names RU/EN/Sanskrit catalog ↔ file | script | consistent; display Sanskrit plain Latin (IAST only in `altNames`) | consistent; 3 EN names improved (see §2) |
| Category/level catalog ↔ file | script + validator | consistent | unchanged (questions in §3) |
| easier/harder/related slugs | script | all valid; 14 poses repeated easier/harder slugs inside `related` (UI hid them, so related blocks were thinner than intended) | 0 overlaps, 0 self/mutual refs, easier ≤ own level ≤ harder everywhere |
| prep → exercise links | script | all slugs exist; **bakasana** prep "Single-foot lift" pointed to the Malasana exercise (wrong content); many titles were shortened/odd-cased versions of the exercise name | fixed; linked preps use the exact exercise name unless they describe a variation |
| Cross-pose duplicate sentences (≥30 chars, exact) | `dups.py` | **100** duplicate sentence groups | **28**, all intentional: 5 exercise names used as prep titles + 23 standardized safety/referral lines |
| Near-duplicates (fuzzy ≥0.85) | difflib scan | copy-paste cues between sibling cards | 13 more rewrites; remaining matches are short functional cues ("place your palms shoulder-width apart") |
| Summary repeated in `about` | difflib | bakasana `about` began with the summary verbatim; ardha-sarvangasana near-verbatim | rewritten |
| US spelling | regex | practise/practising (29), towards (7), centre (2), organise (2), centimetres, stylised, stabilise, favourite | all US |
| Apostrophes | regex | 16 straight `'` mixed with 83 curly `’` | all curly |
| RU typography | regex/reading | « » and — consistent; ё consistent; one typo («Ранее раскрытие ног») | fixed |
| RU register | regex/reading | consistent «вы», imperative; one gendered FAQ question «делал(а)» | fixed |
| RU/EN parity | length/sentence ratio + reading | one parity gap (beginner step "Перенос веса на ладони" vs "…toes down"), one thigh/hip mismatch | fixed |
| Approval / medical-authority / legal claims | regex + reading | about/terms said "each card **is** reviewed by a teacher" (present-tense claim); pages described video lessons as existing | rephrased as process; video wording made conditional |
| URLs, e-mails, socials | regex | none (contact stays `email: null`, `socials: []`) | unchanged |
| Sources | listed all | 30 entries, all B.K.S. Iyengar, *Light on Yoga* (1966), no URLs; each names a pose that is in that book | unchanged (verification note in §3) |

---

## 2. Changes by file

### Global (mechanical)
- **US spelling + curly apostrophes** in English strings: 24 files (11 exercises, 2 pages, 7 poses, 4 programs).
- **Prep titles** normalized to the exact exercise name (79 entries in 40 pose files), e.g. «Чатуранга с колен» → «Опускание в чатурангу с колен», "Seated leg lifts" → "Seated Compression Leg Lifts", «Мост на лопатках» → «Мостик на лопатках», "Hip preparation" → "Pigeon Pose Prep". Variation titles kept on purpose: bhujapidasana (squat with shoulder tuck), mayurasana (wrist warm-up fingers back), eka-pada-bakasana (plank with leg lifted), eka-pada-galavasana (standing-foot weight shift), tittibhasana (bent-knee fold).
- **Program exercise/pose step titles** that were just the item's name now match the catalog name exactly (19 steps in all 4 programs); custom lesson-style titles ("Бакасана: проверка базы") kept.

### catalog.json
- EN names: "Pose Dedicated to **the** Sage Koundinya I / Kasyapa / Visvamitra" (also in the pose files).

### Poses (substantive edits)
- **bakasana** — `about` rewritten (no longer repeats `summary`; clarifies Kakasana vs straight-arm Bakasana); prep[1] Malasana entry fixed (was mislabeled "Single-foot lift"); related: −parsva-bakasana (already harder), +bhujapidasana.
- **eka-pada-bakasana** — unique hand-setup cue (step 0), pose-specific stop instruction (safety 1), specific referral (safety 2), mistake[0].why rewritten.
- **tolasana** — safety[1] specific; step 4 corrected ("change the cross of your legs" → unfold and refold lotus starting with the other leg).
- **eka-hasta-bhujasana** — safety[1] and mistakes[2].why made specific.
- **eka-pada-galavasana** — safety[2], mistakes[2].why rewritten; harder +maksikanagasana (Dragonfly already listed Galavasana as easier).
- **crow-to-chaturanga** — safety[2] specific; anatomy rewritten; related cleaned (+eka-pada-bakasana).
- **straddle-handstand** — steps 3–4 and prerequisite[2] rewritten (no longer identical to tuck handstand).
- **tuck-handstand** — step 4, safety[2], prerequisite[0] rewritten; related cleaned.
- **tuck-press-to-handstand** — steps 0 and 5 rewritten; typo «Ранее» → «Слишком раннее раскрытие ног».
- **kasyapasana** — anatomy, prep[2] body, mistakes[2].fix rewritten; RU `about` cites «Прояснение йоги» (Light on Yoga) like the Chaturanga card; related cleaned (+tolasana).
- **visvamitrasana** — anatomy rewritten; RU book title as above; related cleaned (+eka-pada-koundinyasana-2).
- **vasisthasana-tree** — `about`, anatomy, mistakes[1].why corrected (old text said only this variation has one foot on the floor, which is also true of basic side plank); related cleaned (now empty — everything relevant is already easier/harder).
- **ardha-sarvangasana** — `about` opener, steps 0 and 4, safety[3], mistakes[0].fix and mistakes[1] rewritten (were copies of Salamba Sarvangasana).
- **astavakrasana** — step 4, mistakes[0].fix, mistakes[1].fix rewritten.
- **eka-pada-koundinyasana-2** — prerequisite[0], safety[0], anatomy, prep[1] body, mistake title rewritten (were copies of Astavakrasana).
- **lolasana** — prerequisite[1] and safety[2] specific.
- **bhujapidasana** — step 0, prerequisite[2], safety[2] rewritten.
- **crow-to-tripod-headstand** — prerequisite[0] specific; related cleaned (+urdhva-kukkutasana).
- **dwi-pada-koundinyasana** — `about` opener, prerequisites 0/2, safety[1], prep[0] body, mistakes[1].fix rewritten (were copies of EPK I / Parsva Bakasana).
- **maksikanagasana** — step 0, prerequisite[2], anatomy opener, prep[2] body, mistakes[2].fix rewritten; related cleaned.
- **hamsasana** — steps 1–2 rewritten (were copies of Mayurasana; forearm tilt cue matches the fingers-forward hand position).
- **mayurasana** — safety[1] referral phrased like the rest ("before discussing it with a qualified healthcare professional" instead of "without … approval").
- **handstand-scorpion** — RU subtitle «Вришчикасана II» (same transliteration as the forearm card; old spelling kept in altNames); mistake[0] title made distinct.
- **jump-to-crow** — step 0 rewritten; related cleaned (+eka-pada-bakasana, +lolasana).
- **kukkutasana** — safety[0] specific (threading arms adds knee pressure).
- **tripod-headstand** — `about` ending, prerequisite[0], step 5, anatomy, mistakes[2].why rewritten (were copies of Salamba Sirsasana); altName «Треугольник» removed (search clash with Trikonasana), «Ширшасана с опорой на ладони» added.
- **pincha-mayurasana** — prep[2] (handstand kick-ups) body explains the transfer to forearms; mistakes[0].fix rewritten.
- **eka-hasta-vrksasana** — prep[0] retitled "Wall walk with weight shifts" (was unrelated to the linked exercise name); EN fix "locked" → "fully straight"; related cleaned (+handstand-scorpion).
- **parsva-bakasana** — prep[2] retitled "Weight shift in a twisted squat"; related cleaned.
- **urdhva-kukkutasana** — anatomy opener rewritten.
- **eka-pada-koundinyasana-1**, **side-crow-to-eka-pada-koundinyasana-1**, **tripod-headstand-to-crow**, **vasisthasana** — EN name (EPK I) / related cleanup only.

### Exercises
- **compression-leg-lifts** — safety[1] RU/EN parity (thigh vs hip cramp).
- 10 others: US spelling/apostrophes only.

### Programs
- **beginner** — step 10 title now matches the exercise in both languages (RU was shorter than EN); "favourite" → "favorite"; spelling.
- **intermediate / advanced / expert** — step titles normalized; US spelling ("organise", "practise", "towards"). Step order, durations and texts reviewed: progression is sensible per level, each step text matches its pose/exercise, RU/EN equivalent — no content change needed.

### Pages
- **about** — "How content is reviewed": now describes the process ("a card is marked as reviewed only after a reviewing teacher approves it") instead of stating that each card is reviewed; video section made conditional ("if a pose page has a video lesson…"); "stylised" → "stylized".
- **terms** — same two fixes (sections 5–6); "Practise at your own risk" → "Practice…".
- **privacy** — third-party video section made conditional.
- **faq** — RU q[0] gender-neutral («…если у меня нет опыта балансов на руках?»).
- **contact** — reviewed, unchanged (placeholder, no address/e-mail/socials).

### Deliberately not changed
- Levels and categories (none clearly wrong; see §3).
- Standardized safety/referral sentences (inversion contraindications, menstruation note, "learn with a qualified teacher", "do not turn your head") — kept identical for consistent tone.
- Sources (real book, no URLs), video fields (empty), motion briefs (not published).

---

## 3. Needs review by a qualified yoga teacher

**Levels / categories**
1. **bhujapidasana** is in *Shoulder Balances*; support is on the hands only, so most teachers would file it under *Arm Balances*.
2. **tripod-headstand** is in *Shoulder Balances*, while **salamba-sirsasana** is in *Forearm Balances*. There is no head-balance category; the two headstands should probably be filed the same way.
3. **lolasana** (intermediate): compression demand is high; it may belong in advanced.
4. **hamsasana** (intermediate): the final form (legs lifted) is close to Mayurasana (advanced). Only the toes-down stage is clearly intermediate.
5. **eka-pada-galavasana** (intermediate) and **astavakrasana / tittibhasana** (advanced): schools rate these differently.
6. **niralamba-sarvangasana** (expert): confirm the level, and whether it belongs in a self-study catalog at all given the neck load.
7. **tripod-headstand-to-crow** (expert) vs **crow-to-tripod-headstand** (advanced); **visvamitrasana** (expert); **chaturanga** (beginner, but technically demanding).

**Names**
8. **vasisthasana-tree**: "Vrksa Vasisthasana" looks like a modern, constructed name. Confirm it or drop it.
9. **maksikanagasana**: how the foot hooks varies between schools. Confirm the form described (both legs on the right upper arm).
10. Alternative names to confirm: Tolasana "Utpluthih", Ardha Sarvangasana "Viparita Karani", Eka Pada Bakasana "Flying Crow" (also used for Galavasana).

**Progressions and new cues added in this pass**
11. Weak "harder" links: tittibhasana → visvamitrasana, eka-pada-koundinyasana-2 → visvamitrasana.
12. Cues I added that need checking: index-finger base pressure (eka-pada-bakasana, kasyapasana); shortened Down Dog before jump-to-crow; Hamsasana forearm tilt; Astavakrasana "left elbow drifting out"; tripod-headstand prerequisite (plank + knees-down Chaturanga instead of Dolphin); straddle "cartwheel out without joining the legs".
13. All hold times and reps (e.g. plank 30–60 s, 2–4 sets) are editorial guidelines with no source behind them.

**Safety**
14. Menstruation note on 7 inversion cards: confirm the wording and whether to keep it.
15. Standardized contraindication lists (neck, high blood pressure, glaucoma/eye conditions, pregnancy, recent injury): confirm they are complete for shoulder stands and headstands. Nothing was added without a source.
16. Lotus-based poses (tolasana, kukkutasana, urdhva-kukkutasana, kasyapasana): confirm the knee-safety wording.

**Sources**
17. The 30 *Light on Yoga* references (28 poses, 2 exercises) have no page or plate numbers. Verify each against the book, and check that the "common teaching form" notes are accurate.

**Pages (not teacher work)**
18. The privacy and terms drafts still need a lawyer, as the pages themselves say. Contact details must come from the project owner.
