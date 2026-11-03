# Quizamcham — Canlı İnteraktiv Quiz Platforması

> **Spesifikasiya (SPEC.md) · versiya 1.0 · 3 noyabr 2026**
> Repo: `https://github.com/Nizamitahirov/Quizamcham`
> Məqsəd: AmCham Azərbaycan “NextGen HR Leaders” proqramında süni intellekt təlimi üçün Kahoot / Wayground (keçmiş Quizizz) tipli, real vaxtda işləyən, mobil-öncəlikli quiz platforması.

Bu fayl **Claude Code** üçün yazılıb. Claude Code bu faylı əvvəldən sonadək oxumalı, aşağıdakı iş qaydalarına əməl etməli və tətbiqi mərhələ-mərhələ (bölmə 22) qurmalıdır.

---

## 0. Claude Code üçün iş qaydaları (ƏVVƏL BUNU OXU)

1. **Mənbə həqiqət bu fayldır.** Qeyri-müəyyən bir şey olarsa, ən sadə və bu sənədin ruhuna uyğun həlli seç, qərarı `docs/DECISIONS.md` faylına bir sətirlə yaz.
2. **Branch → main axını.** Hər mərhələni ayrıca branch-də et (`feat/m1-skeleton`, `feat/m2-admin` …). Mərhələ bitəndə:
   - `npm run build` və `npm run lint` xətasız keçməlidir;
   - `CHANGELOG.md`-ə qısa qeyd əlavə et;
   - branch-i **`main`-ə merge et və push et**. Vercel `main`-dən avtomatik deploy edir. Hər tamamlanmış dəyişiklik main-ə düşməlidir — istifadəçi bunu açıq şəkildə istəyib.
3. **Commit mesajları** azərbaycan və ya ingilis dilində, qısa və mənalı: `feat(admin): sual redaktoru`, `fix(player): taymer sinxronu`.
4. **Sirlər repoya düşmür.** Firebase konfiqurasiyası `.env.local`-da saxlanır (git-ə daxil edilmir). Repoda yalnız `.env.example` olur.
5. **Firebase məlumatlarını istifadəçidən istə.** M1-in sonunda istifadəçidən Firebase web config dəyərlərini (apiKey, authDomain, projectId, storageBucket, messagingSenderId, appId) soruş, `.env.local`-a yaz və istifadəçiyə eyni dəyərləri Vercel → Project → Settings → Environment Variables bölməsinə necə əlavə edəcəyini izah et.
6. **Firebase Console-da edilməli addımları** (Auth aktivləşdirmə, Rules publish, admin istifadəçi) özün edə bilmirsənsə, istifadəçiyə addım-addım, sadə dillə yaz (bölmə 21).
7. **Dil:** bütün interfeys mətnləri azərbaycan dilindədir və `src/i18n/az.ts` faylında saxlanır. Kodda hardcode mətn olmasın.
8. **Mobil-öncəlikli.** Oyunçu ekranları 360px enində mükəmməl işləməlidir. Host (proyektor) ekranı 1920×1080 üçün optimallaşdırılır.
9. **Asılılıqlar:** quraşdırma zamanı ən son sabit versiyaları quraşdır və `package.json`-da dəqiq versiyaları sabitlə (`^` yox). Lazımsız paket əlavə etmə.
10. **Hər mərhələnin sonunda** istifadəçiyə 3–5 sətirlik xülasə ver: nə hazırdır, necə yoxlamaq olar, növbəti addım.

---

## 1. Məhsulun qısa təsviri

Təlimçi (admin) admin panelində quiz və sualları hazırlayır, “Oyunu başlat” düyməsini sıxır və proyektorda böyük **QR kod + 6 rəqəmli PIN** görünür. İştirakçılar telefonla QR-ı skan edir, **ad və soyadını** yazır, **avatar seçir** və lobbiyə daxil olur. Lobbidə **arxa fonda musiqi** səslənir, hamı kimin qoşulduğunu **real vaxtda** görür (avatarlar ekrana “atılaraq” daxil olur). Təlimçi **Start** düyməsini sıxanda oyun **hamı üçün eyni anda** başlayır. Hər sualın öz vaxtı var (standart 45 saniyə). Cavabdan sonra animasiyalı rəy (stiker, xal, seriya), suallar arasında reytinq, sonda isə **podium + şəxsi nəticə ekranı** göstərilir.

Suallar Firestore-da saxlanır: admin panelində sualı redaktə edib **Yadda saxla** düyməsini sıxdıqda dəyişiklik **dərhal** tətbiqdə görünür — yeni deploy və ya kod dəyişikliyi lazım deyil.

---

## 2. Rollar

| Rol | Kimdir | Giriş | Edə bilər |
|---|---|---|---|
| **Admin / Host** | Təlimçi | E-poçt + şifrə (Firebase Auth) və `admins/{uid}` sənədi | Quiz yaratmaq, redaktə, oyun başlatmaq, idarə etmək, nəticələri görmək, CSV ixrac |
| **Oyunçu** | Təlim iştirakçısı | Anonim Firebase Auth (avtomatik) | PIN ilə qoşulmaq, profil, cavab vermək, öz nəticəsini görmək |
| **Ekran (Presenter)** | Proyektordakı host görünüşü | Admin hesabı ilə eyni | Lobbi, sual, statistika, reytinq, podium göstərmək |

---

## 3. Texnologiya steki

| Sahə | Seçim | Səbəb |
|---|---|---|
| Framework | **Vite + React + TypeScript** | Sürətli, Vercel-ə birbaşa uyğun |
| Stil | **Tailwind CSS** | Sürətli, ardıcıl dizayn |
| Animasiya | **Framer Motion** | Hərəkətli, canlı interfeys |
| Marşrutlaşdırma | **React Router** | SPA səhifələri |
| Vəziyyət | **Zustand** (yüngül) | Oyun vəziyyəti üçün |
| Backend | **Firebase Auth + Cloud Firestore** (JS SDK modular API) | Real vaxt, pulsuz Spark planı kifayətdir |
| QR | **qrcode.react** | QR kod generasiyası |
| Konfetti | **canvas-confetti** | Qələbə effektləri |
| Avatarlar | **@dicebear/core + @dicebear/collection** (lokal SVG generasiyası) | Şəbəkəsiz, sürətli, saysız variant |
| Səs | **Web Audio API** (öz `AudioEngine` modulu) | Lisenziya problemi olmayan, kodla yaradılan musiqi və effektlər |
| Drag & drop | **@dnd-kit** | Sualları sıralamaq, “puzzle” sual tipi |
| Hosting | **Vercel** | `main` branch-dən avtomatik deploy |

> Qeyd: Cloud Functions və Firebase Storage **istifadə olunmur**, çünki bunlar ödənişli (Blaze) plan tələb edir. Bütün məntiq klientdə və Firestore Security Rules-da həll olunur. Xalları **yalnız host klienti** hesablayır (bölmə 10.4).

---

## 4. Arxitektura

```
 ┌──────────────┐  QR / PIN   ┌──────────────────┐
 │ Oyunçu (tel.)│────────────▶│  Vercel (SPA)    │◀── git push main ── GitHub repo
 └──────┬───────┘             └────────┬─────────┘
        │ anonim auth, onSnapshot       │
        ▼                               ▼
 ┌────────────────────────────────────────────────┐
 │            Firebase (Spark planı)              │
 │  Auth: Anonymous + Email/Password              │
 │  Firestore: quizzes, games, players, answers   │
 │  Security Rules: kim nəyi oxuya/yaza bilər     │
 └────────────────────────────────────────────────┘
        ▲                               ▲
        │ admin auth, onSnapshot        │
 ┌──────┴───────┐              ┌────────┴─────────┐
 │ Admin panel  │              │ Host / Proyektor │
 └──────────────┘              └──────────────────┘
```

**Əsas prinsip:** host oyunun “dirijorudur”. Oyunun vəziyyəti (`phase`, cari sual, taymer) `games/{gameId}` sənədindədir. Host bu sənədi dəyişir, bütün oyunçular onu `onSnapshot` ilə dinləyir və ekranları avtomatik dəyişir.

---

## 5. İstifadəçi axınları

### 5.1 Admin: hazırlıq
1. `/admin/login` → e-poçt və şifrə ilə giriş.
2. `/admin` → quiz siyahısı → **Yeni quiz** və ya mövcud quizi aç.
3. `/admin/quiz/:quizId` → sualları əlavə et / redaktə et / sırala → **Yadda saxla** (avtomatik yadda saxlama da var).
4. **Oyunu başlat** → yeni `game` sənədi və 6 rəqəmli PIN yaranır → `/host/:gameId` açılır (proyektora çıxarılır).

### 5.2 Canlı oyun
```
LOBBY ──Start──▶ COUNTDOWN(3-2-1) ──▶ QUESTION(taymer) ──vaxt bitdi / hamı cavab verdi──▶ REVEAL
  ▲                                                                                          │
  │                                         ┌──── növbəti sual ◀── LEADERBOARD ◀────────────┘
  │                                         ▼
  └── (yeni oyun)                    ... son sualdan sonra ──▶ PODIUM ──▶ FINISHED (nəticələr)
```

### 5.3 Oyunçu
1. QR-ı skan edir → `/join?pin=123456` (PIN avtomatik doldurulur). QR olmadan: `/join` səhifəsində PIN-i əl ilə yazır.
2. **Ad** və **Soyad** yazır (hər biri 2–20 simvol; tam ad ekranda “Ad S.” formasında da göstərilə bilər).
3. **Avatar seçir** (şəbəkə şəklində 24 variant + “🎲 Təsadüfi” düyməsi + aksesuar/stiker seçimi).
4. **Qoşul** → lobbi: musiqi başlayır, öz avatarı və digərləri görünür, emoji reaksiyaları göndərə bilər.
5. Oyun başlayır → suallar → rəy → reytinq → final nəticə ekranı.

---

## 6. Ekranlar (ətraflı)

### 6.1 Oyunçu ekranları (mobil)

| Ekran | Marşrut / faza | Məzmun və davranış |
|---|---|---|
| **Qoşulma** | `/join` | Böyük loqo, PIN sahəsi (6 rəqəm, rəqəm klaviaturası), “Davam” düyməsi. Yanlış PIN → titrəmə animasiyası + “Bu PIN ilə oyun tapılmadı”. Oyun artıq başlayıbsa və gec qoşulma bağlıdırsa → “Oyun artıq başlayıb”. |
| **Profil** | `/join` addım 2 | Ad, Soyad sahələri; avatar şəbəkəsi (seçiləndə “boing” animasiyası və parıltı); “🎲 Təsadüfi”; aksesuar (papaq, eynək, tac, qulaqcıq — DiceBear seçimləri və ya avatarın küncündə emoji stiker). Böyük “Qoşul 🚀” düyməsi. |
| **Lobbi** | `phase=lobby` | Öz avatarı ortada “nəfəs alan” animasiya ilə; aşağıda digər qoşulanların avatar balonları (yeni gələn kənardan uçaraq daxil olur); qoşulanların sayı; dönən ipucu mətnləri (“Hazırlaşın! Sürətli cavab daha çox xal gətirir ⚡”); emoji reaksiya paneli (👏 🔥 😂 😎 🎉 💡) — basılan emoji yuxarı uçur və host ekranında da görünür; səs düyməsi 🔊/🔇. |
| **Geri sayım** | `phase=countdown` | Tam ekran 3-2-1 animasiyası (hər rəqəm böyüyüb partlayır), sual nömrəsi “Sual 3 / 10”. |
| **Sual** | `phase=question` | Yuxarıda dairəvi taymer halqası (son 5 saniyədə qırmızı, titrəyir, “tik” səsi); sual mətni; şəkil (varsa); cavab plitələri — 2×2 şəbəkə, hər birinin öz rəngi **və** öz forması (rəng korluğu üçün). Toxunanda plitə basılır, digərləri solğunlaşır. Göndəriləndən sonra “Cavab qəbul edildi ✓ Digərlərini gözləyirik…” + əyləncəli gözləmə animasiyası. |
| **Rəy** | `phase=reveal` | Düzdürsə: yaşıl fon, böyük animasiyalı stiker (🎉/🔥/🚀), “+873 xal”, seriya göstəricisi “🔥 3 ardıcıl”, qısa konfetti. Səhvdirsə: dəstəkləyici mesaj (“Az qaldı! 💪”), düzgün cavab göstərilir. Cavab verməyibsə: “Vaxt bitdi ⏰”. Sualın **izahı** (varsa) göstərilir. Cari yeri: “Siz 5-cisiniz”. |
| **Reytinq arası** | `phase=leaderboard` | Top 5 + öz yeri; yer dəyişikliyi oxla (▲2 / ▼1). |
| **Final / Nəticələr** | `phase=finished` | Böyük yer kartı (1-ci → tac 👑 və güclü konfetti), ümumi xal, düzgün cavab sayı, dəqiqlik %, ən uzun seriya, orta cavab vaxtı. Altda **“Cavablarıma bax”**: hər sual üçün öz cavabı, düzgün cavab, izah. “Paylaş” (ekran görüntüsü üçün səliqəli kart). |

**Sual tiplərinə görə oyunçu interfeysi:**
- Tək seçim / Doğru-Yanlış: plitələr, bir toxunuş = göndərmə.
- Çox seçim: plitələr seçilir (✓ işarəsi), aşağıda “Göndər” düyməsi.
- Cavabı yaz: mətn sahəsi + “Göndər”, simvol limiti.
- Sıralama (puzzle): sürüşdürülən kartlar (@dnd-kit), “Göndər”.
- Slayder: böyük slayder, cari dəyər böyük şriftlə, “Göndər”.
- Sorğu (poll): plitələr, xal yoxdur, nəticədə faiz qrafiki.
- Söz buludu / Açıq cavab: mətn sahəsi.

### 6.2 Host / Proyektor ekranları (`/host/:gameId`, 1920×1080)

| Faza | Məzmun |
|---|---|
| **Lobbi** | Solda nəhəng **QR kod** (min. 420px) və altında qoşulma ünvanı + **PIN** iri rəqəmlərlə; sağda/ortada qoşulan oyunçuların avatar “buludu” (yeni oyunçu animasiya ilə düşür, adı göstərilir); sayğac “👥 27 nəfər qoşulub”; uçan emoji reaksiyaları; idarə paneli: **▶ Başla**, 🔒 Lobbini kilidlə, 🔊 Musiqi, ⛶ Tam ekran, oyunçunu çıxarmaq (avatarın üstündə ✕). |
| **Sual** | Sual mətni çox iri, şəkil, cavab variantları rəngli plitələr kimi; böyük taymer; “Cavab verənlər: 18 / 27” canlı sayğac (avatarlar balaca ikon kimi dolur); düymələr: ⏸ Pauza, ⏭ Vaxtı bitir, Ötür. |
| **Açılış (Reveal)** | Düzgün cavab vurğulanır, digərləri solğunlaşır; hər variant üçün animasiyalı sütun qrafiki (neçə nəfər seçib); sualın izahı; “Növbəti ▶”. |
| **Reytinq** | Top 10, xallar sayğac kimi artır, yerlər animasiya ilə dəyişir. |
| **Podium** | 3-2-1 podiumu, avatarlar yuxarıdan düşür, fanfar səsi, güclü konfetti; sonra tam siyahı. |
| **Bitdi** | Ümumi statistika: iştirakçı sayı, orta dəqiqlik, ən çətin sual, ən asan sual; **CSV ixrac**, **Yeni oyun**. |

Klaviatura qısayolları (host): `Space` = növbəti, `P` = pauza, `M` = musiqi, `F` = tam ekran.

### 6.3 Admin paneli

| Səhifə | Marşrut | Məzmun |
|---|---|---|
| Giriş | `/admin/login` | E-poçt, şifrə. Admin deyilsə: “Bu hesabın admin hüququ yoxdur”. |
| Quizlər | `/admin` | Kartlar: ad, sual sayı, son redaktə, düymələr: Redaktə, Dublikat, Oyunu başlat, Sil (təsdiqlə). “+ Yeni quiz”. JSON idxal. |
| Quiz redaktoru | `/admin/quiz/:quizId` | Solda sual siyahısı (miniatür, sürüşdürərək sıralama, dublikat, sil); ortada seçilmiş sualın redaktoru; sağda sual ayarları paneli; yuxarıda quiz ayarları (bölmə 8.1), **Önizləmə** (oyunçu ekranının telefon çərçivəsində görünüşü), **Yadda saxla** + avtomatik yadda saxlama statusu (“Yadda saxlanıldı ✓ 12:04”). |
| Oyunlar tarixçəsi | `/admin/games` | Keçmiş oyunlar: tarix, quiz, iştirakçı sayı → hesabat səhifəsi. |
| Oyun hesabatı | `/admin/games/:gameId` | Oyunçu × sual cədvəli, hər sual üçün dəqiqlik %, orta cavab vaxtı, cavab paylanması; CSV ixrac. |
| Ayarlar | `/admin/settings` | Standart vaxt, standart xal, musiqi səviyyəsi, tema rəngi, loqo mətni, adlar üçün qadağan sözlər siyahısı. |

**Redaktor tələbləri:**
- Sual mətni (maks. 200 simvol, sayğac), şəkil URL-i (önizləmə ilə), izah (maks. 300 simvol).
- Variantlar: 2–6 (tipə görə), hər birinin yanında “düzgün” keçidi; variant əlavə et / sil.
- Validasiya: düzgün cavab seçilməyibsə, boş variant varsa — qırmızı xəbərdarlıq və “Başlat” bloklanır.
- **Avtomatik yadda saxlama:** dəyişiklikdən 1,5 saniyə sonra (debounce) Firestore-a yazılır. Redaktə **aktiv oyuna təsir etmir**: oyun başlayanda quizin surəti (snapshot) götürülür (bölmə 10.3).
- **JSON idxal/ixrac:** bütün quizi JSON kimi yüklə/endir. Format bölmə 23-dədir. Bu, AI ilə (məs. Claude) sual yaradıb bir kliklə yükləməyə imkan verir.
- Geri al (Undo) — son 20 dəyişiklik, sessiya daxilində.

---

## 7. Sual tipləri

| Tip (`type`) | Təsvir | Variant sayı | Standart vaxt | Xal | Mərhələ |
|---|---|---|---|---|---|
| `single` | Tək düzgün cavablı seçim | 2–6 | 30 s | Bəli | MVP |
| `multi` | Bir neçə düzgün cavab | 2–6 | 45 s | Bəli (bölmə 9) | MVP |
| `truefalse` | Doğru / Yanlış | 2 (sabit) | 20 s | Bəli | MVP |
| `type` | Cavabı yaz; 1–4 qəbul olunan cavab, böyük-kiçik hərf və boşluqlar nəzərə alınmır, `ə/e`, `ı/i` kimi fərqlər üçün “yumşaq müqayisə” seçimi | — | 45 s | Bəli | MVP |
| `poll` | Sorğu, düzgün cavab yoxdur | 2–6 | 20 s | Xeyr | MVP |
| `order` | Sıralama (puzzle): kartları düzgün ardıcıllığa düz | 3–5 | 45 s | Bəli (tam düzgün) | Mərhələ 2 |
| `slider` | Rəqəm seç: min, max, addım, düzgün dəyər, qəbul olunan fərq (±) | — | 30 s | Bəli | Mərhələ 2 |
| `wordcloud` | Qısa cavablar söz buludu kimi göstərilir | — | 45 s | Xeyr | Mərhələ 2 |
| `open` | Açıq cavab, host ekranında “divar” kimi | — | 60 s | Xeyr | Mərhələ 2 |
| `slide` | Sual deyil — məlumat/izah slaydı (başlıq + mətn + şəkil) | — | host keçir | Xeyr | Mərhələ 2 |

Vaxt seçimləri: 5, 10, 15, 20, 30, **45 (istifadəçinin standartı)**, 60, 90, 120, 180, 240 saniyə.

---

## 8. Ayarlar

### 8.1 Quiz səviyyəsində
| Ayar | Dəyərlər | Standart |
|---|---|---|
| Ad, təsvir, örtük rəngi/emoji | — | — |
| Standart vaxt | bölmə 7 siyahısı | 45 s |
| Oyun rejimi | `host` (hamı eyni sualı eyni anda görür, host idarə edir) / `self` (hər kəs öz tempində, ümumi vaxt limiti ilə) | `host` |
| Xal rejimi | `speed` (sürət + düzgünlük) / `accuracy` (yalnız düzgünlük, sabit xal) | `speed` |
| Seriya bonusu | açıq / bağlı | açıq |
| Sualları qarışdır | açıq / bağlı | bağlı |
| Variantları qarışdır | açıq / bağlı (hər oyunçu üçün ayrıca) | açıq |
| Hər sualdan sonra düzgün cavabı göstər | açıq / bağlı | açıq |
| Suallar arası reytinq | hər sualdan sonra / hər 3 sualdan bir / yalnız sonda | hər sualdan sonra |
| Gec qoşulma | icazə ver / qadağan et | icazə ver (növbəti sualdan qoşulur) |
| Musiqi | açıq / bağlı, səviyyə 0–100, mövzu (`energetic`, `chill`, `retro`) | açıq, 60, energetic |
| Ad filtri | qadağan sözlər siyahısı | açıq |
| Maks. oyunçu | 10–200 | 100 |

### 8.2 Sual səviyyəsində
| Ayar | Dəyərlər |
|---|---|
| Vaxt | bölmə 7 |
| Xal | `standard` (1000) / `double` (2000) / `none` (0) |
| Şəkil | URL (https), mövqe: yuxarıda / arxa fon |
| İzah | Reveal-da göstərilən mətn |
| Variantları qarışdır | quiz ayarını əvəz edir |

### 8.3 Wayground tipli əlavə imkanlar (Mərhələ 3, istəyə bağlı)
- **Güc artırıcılar (power-ups):** `50/50` (iki səhv variantı gizlədir), `2x` (növbəti sual ikiqat xal), `+10 s` (öz vaxtına 10 saniyə). Hər oyunçuya oyunda 2 təsadüfi güc artırıcı.
- **Mem/stiker rəyi:** cavabdan sonra təsadüfi animasiyalı stiker + qısa zarafat mətni (azərbaycan dilində, `src/content/feedback.ts`).
- **Komanda rejimi:** oyunçular rənglərə görə komandalara bölünür, komanda xalı = üzvlərin ortalaması.

---

## 9. Xal sistemi

**Sürət rejimi (`speed`) — tək seçim, doğru/yanlış, cavabı yaz, slayder, sıralama:**

```
points = round( basePoints × (1 − (responseTime / timeLimit) / 2) )
```
- `basePoints` = 1000 (`double` → 2000, `none` → 0).
- Düzgün cavab ən azı `basePoints/2`, ən çoxu `basePoints` qazandırır. Səhv və ya cavabsız = 0.
- Nümunə: 30 saniyəlik sualda 2-ci saniyədə düzgün cavab → `round(1000 × (1 − (2/30)/2)) = 967`.
- (Bu düstur Kahoot-un rəsmi açıqladığı qaydaya uyğundur.)

**Çox seçim (`multi`):** hər düzgün seçilmiş variant `basePoints/2 × sürət əmsalı`; hər səhv seçilmiş variant cəmi bir variant qədər azaldır; nəticə 0-dan aşağı düşmür.

**Dəqiqlik rejimi (`accuracy`):** düzgün = `basePoints`, sürət nəzərə alınmır.

**Seriya bonusu:** ardıcıl düzgün cavablarda: 2-ci → +100, 3-cü → +200, 4-cü və sonra → +300 (maks.). Səhv cavab seriyanı sıfırlayır. Poll seriyaya təsir etmir.

**Bərabər xal:** ümumi xal bərabərdirsə, düzgün cavabların ümumi cavab vaxtı az olan önə keçir.

---

## 10. Real vaxt mexanizmi və məlumat modeli (Firestore)

### 10.1 Kolleksiyalar

```
admins/{uid}
  email: string
  createdAt: timestamp

quizzes/{quizId}                       // yalnız admin oxuyur/yazır
  title, description, coverEmoji, coverColor
  settings: { ...bölmə 8.1 }
  questionOrder: string[]              // sual id-lərinin sırası
  ownerUid, createdAt, updatedAt

quizzes/{quizId}/questions/{questionId} // düzgün cavablar BURADADIR — oyunçular oxuya bilməz
  type, text, imageUrl?, explanation?
  timeLimit, points: 'standard'|'double'|'none'
  options: [{ id, text }]              // single, multi, truefalse, poll, order
  correct: string[]                    // düzgün variant id-ləri (order üçün düzgün sıra)
  accepted?: string[]                  // type üçün
  slider?: { min, max, step, answer, tolerance }
  shuffleOptions?: boolean

pins/{pin}                             // 6 rəqəmli PIN → oyun
  gameId, active: boolean, createdAt

games/{gameId}                         // HAMI oxuyur, yalnız host yazır
  pin, quizId, hostUid
  title
  settings: {...}                      // oyun başlayanda quizdən kopyalanır
  phase: 'lobby'|'countdown'|'question'|'reveal'|'leaderboard'|'podium'|'finished'
  locked: boolean
  questionIndex: number                // -1 lobbidə
  totalQuestions: number
  currentQuestion: {                   // YALNIZ ictimai hissə, düzgün cavab YOXDUR
    id, type, text, imageUrl?, options:[{id,text}], timeLimit, points,
    slider?: {min,max,step}
  } | null
  questionStartedAt: timestamp | null  // serverTimestamp()
  questionEndsAt: timestamp | null     // startedAt + timeLimit
  pausedRemainingMs: number | null
  reveal: {                            // phase=reveal-da doldurulur
    correct: string[], explanation?, distribution: {optionId: count}, answeredCount
  } | null
  lobby: [{ uid, firstName, lastName, avatar }]   // host tərəfindən denormalizə edilir (kvota qənaəti)
  leaderboard: [{ uid, name, avatar, score, rank, delta }] // top 10
  playerCount: number
  answeredCount: number
  createdAt, startedAt?, finishedAt?

games/{gameId}/secret/key              // yalnız admin: quizin tam surəti (düzgün cavablarla)
  questions: [...]

games/{gameId}/players/{uid}
  firstName, lastName, avatar: { style, seed, accessory? }
  joinedAt, lastSeen                   // lastSeen = heartbeat
  kicked: boolean
  // aşağıdakıları YALNIZ host yazır:
  score, correctCount, streak, bestStreak, totalCorrectTimeMs
  lastResult: { questionIndex, correct, points, streakBonus, rank } | null
  history: [{ q, answer, correct, points, timeMs }]

games/{gameId}/answers/{uid_qIndex}    // sənəd id-si = `${uid}_${questionIndex}` → təkrar cavab mümkün deyil
  uid, questionIndex, value: string[] | string | number
  answeredAt: timestamp                // serverTimestamp()

games/{gameId}/reactions/{autoId}      // Mərhələ 2
  uid, emoji, createdAt
```

### 10.2 Real vaxt axını
- **Oyunçular yalnız iki sənədi dinləyir:** `games/{gameId}` və öz `players/{uid}` sənədi. Lobbidəki digər oyunçuların siyahısı `games/{gameId}.lobby` massivindən gəlir — bu, oxumaları kəskin azaldır.
- **Host** `players` kolleksiyasını və cari sualın `answers`-ini dinləyir, yeni oyunçu qoşulduqda `lobby` massivini yeniləyir.
- **Heartbeat:** oyunçu hər 30 saniyədə `lastSeen`-i yeniləyir (yalnız səhifə açıq olarkən). Host 90 saniyədən çox səssiz qalanları boz göstərir.
- **Bağlantı itəndə:** anonim auth uid-i brauzerdə qalır, `localStorage`-da `gameId` saxlanır → səhifə yenilənəndə oyunçu avtomatik eyni oyuna qayıdır.
- **Host səhifəni yeniləsə** oyun dayanmır — vəziyyət Firestore-dadır, host ekranı oradan bərpa olunur.

### 10.3 Oyunun başladılması (host)
1. Unikal 6 rəqəmli PIN yarat (`pins/{pin}` mövcud deyilsə).
2. Quizin bütün suallarını oxu → `games/{gameId}/secret/key`-ə tam surəti yaz (bundan sonra quiz redaktəsi bu oyuna təsir etmir).
3. `games/{gameId}` sənədini `phase='lobby'` ilə yarat, `pins/{pin}` yaz.

### 10.4 Sual dövrü (host klienti icra edir)
1. `phase='countdown'` (3 s) → `phase='question'`, `currentQuestion` = ictimai hissə, `questionStartedAt = serverTimestamp()`, `questionEndsAt = startedAt + timeLimit`.
2. Oyunçu cavab verir → `answers/{uid_q}` sənədi `answeredAt: serverTimestamp()` ilə yazılır (Rules: yalnız bir dəfə, yalnız `question` fazasında, yalnız `questionEndsAt + 2 s`-dən əvvəl).
3. Vaxt bitəndə **və ya** hamı cavab verəndə host:
   - cavabları oxuyur, `secret/key`-dən düzgün cavabı götürür;
   - hər oyunçunun xalını bölmə 9-a görə hesablayır (`responseTime = answeredAt − questionStartedAt`, server vaxtları ilə);
   - **bir batch yazısı ilə** oyunçu sənədlərini (`score`, `lastResult`, `history`…) və `games/{gameId}` (`phase='reveal'`, `reveal`, `leaderboard`) yeniləyir.
4. Host “Növbəti” sıxır → `leaderboard` fazası (ayarlara görə) → növbəti sual və ya `podium` → `finished`.

### 10.5 Vaxt sinxronu
- Oyunçu qoşulanda saat fərqini ölç: `lastSeen: serverTimestamp()` yaz, dərhal serverdən oxu, `offset = serverTime − (göndərmə + qəbul)/2`. Taymer `questionEndsAt − (Date.now() + offset)` ilə göstərilir.
- Ədalət server vaxtına əsaslanır: xal `answeredAt` (server) ilə hesablanır, klient saatı ilə yox.
- Pauza: host `pausedRemainingMs` yazır; davam edəndə yeni `questionEndsAt` hesablanır.

---

## 11. Firestore Security Rules (`firestore.rules`)

Claude Code bu faylı repoya əlavə etməli və istifadəçiyə Firebase Console → Firestore → **Rules** bölməsinə yapışdırıb **Publish** etməyi izah etməlidir. Aşağıdakı versiya başlanğıc nöqtəsidir; Claude Code onu tam data modelinə uyğunlaşdırmalı və Firebase Emulator ilə test etməlidir (mümkündürsə).

```
rules_version = '2';
service cloud.firestore {
  match /databases/{db}/documents {

    function signedIn() { return request.auth != null; }
    function isAdmin() { return signedIn() && exists(/databases/$(db)/documents/admins/$(request.auth.uid)); }
    function game(gameId) { return get(/databases/$(db)/documents/games/$(gameId)).data; }

    match /admins/{uid} {
      allow read: if signedIn() && request.auth.uid == uid;
      allow write: if false; // yalnız Console-dan
    }

    match /quizzes/{quizId} {
      allow read, write: if isAdmin();
      match /questions/{qid} { allow read, write: if isAdmin(); }
    }

    match /pins/{pin} {
      allow read: if signedIn();
      allow write: if isAdmin();
    }

    match /settings/{doc} {          // settings/current → { activeGameId } (daimi QR üçün)
      allow read: if signedIn();
      allow write: if isAdmin();
    }

    match /games/{gameId} {
      allow read: if signedIn();
      allow write: if isAdmin();

      match /secret/{doc} { allow read, write: if isAdmin(); }

      match /players/{uid} {
        allow read: if isAdmin() || (signedIn() && request.auth.uid == uid);
        allow create: if signedIn() && request.auth.uid == uid
          && game(gameId).locked == false
          && request.resource.data.firstName is string && request.resource.data.firstName.size() >= 2 && request.resource.data.firstName.size() <= 20
          && request.resource.data.lastName is string && request.resource.data.lastName.size() >= 2 && request.resource.data.lastName.size() <= 20
          && request.resource.data.keys().hasOnly(['firstName','lastName','avatar','joinedAt','lastSeen','kicked','score','correctCount','streak','bestStreak','totalCorrectTimeMs','lastResult','history'])
          && request.resource.data.score == 0 && request.resource.data.kicked == false;
        // oyunçu yalnız profil və heartbeat sahələrini dəyişə bilər
        allow update: if isAdmin() || (signedIn() && request.auth.uid == uid
          && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['firstName','lastName','avatar','lastSeen']));
        allow delete: if isAdmin();
      }

      match /answers/{answerId} {
        allow read: if isAdmin();
        allow create: if signedIn()
          && answerId == request.auth.uid + '_' + string(request.resource.data.questionIndex)
          && request.resource.data.uid == request.auth.uid
          && game(gameId).phase == 'question'
          && request.resource.data.questionIndex == game(gameId).questionIndex
          && request.resource.data.answeredAt == request.time
          && request.time <= game(gameId).questionEndsAt + duration.value(2, 's');
        allow update, delete: if false;
      }

      match /reactions/{rid} {
        allow read: if isAdmin();
        allow create: if signedIn() && request.resource.data.uid == request.auth.uid;
      }
    }
  }
}
```

---

## 12. Firebase pulsuz plan (Spark) limitlərinə qənaət

Spark planında Firestore gündəlik limitləri təxminən: 50 000 oxuma, 20 000 yazma, 20 000 silmə (Claude Code cari limitləri Firebase sənədlərində yoxlamalıdır). 50 nəfərlik, 10 suallıq oyun üçün dizayn belə olmalıdır:
- Oyunçular **bütün `players` kolleksiyasını dinləmir** — yalnız `games/{id}` və öz sənədini.
- Reytinq top 10 kimi `games/{id}.leaderboard`-a yazılır.
- Heartbeat 30 saniyədən tez-tez olmur.
- Reaksiyalar oyunçu başına 2 saniyədə 1 ilə məhdudlaşdırılır.
- Admin panelində siyahılar `onSnapshot` əvəzinə lazım olduqda `getDocs` ilə yüklənir (redaktor istisna).

---

## 13. Dizayn sistemi

**Ruh:** enerjili, oyunvari, “şou” hissi; amma səliqəli və korporativ tədbirə uyğun. Kahoot və Wayground-un dinamikasından ilham alır, lakin onların loqosunu, adını, xarakterlərini və ya brend elementlərini **kopyalamır** — bütün vizual elementlər orijinaldır.

**Rənglər (CSS dəyişənləri, `src/styles/tokens.css`):**
| Token | Dəyər | İstifadə |
|---|---|---|
| `--bg-deep` | `#0F1129` | Host ekranı fonu, tünd göy |
| `--bg-grad` | `linear-gradient(135deg, #2B1055 0%, #7597DE 100%)` alternativ: `#E4202E → #FF7A1F` | Lobbi və podium fonları (yavaş hərəkət edən qradiyent + üzən formalar) |
| `--brand` | `#E4202E` | Əsas aksent (AmCham/təlim deck-i ilə uyğun) |
| `--brand-2` | `#FF7A1F` | İkinci aksent |
| `--ink` | `#0F1129` | Açıq fonda mətn |
| `--paper` | `#FFFFFF` | Kartlar |
| `--ok` | `#16A34A` | Düzgün |
| `--bad` | `#DC2626` | Səhv |

**Cavab plitələri** (rəng + forma birlikdə, ağ mətn, kontrast ≥ 4.5:1):
| # | Rəng | Forma |
|---|---|---|
| A | `#E4202E` qırmızı | ▲ üçbucaq |
| B | `#2563EB` göy | ◆ romb |
| C | `#D97706` kəhrəba | ● dairə |
| D | `#059669` yaşıl | ■ kvadrat |
| E | `#7C3AED` bənövşəyi | ★ ulduz |
| F | `#DB2777` çəhrayı | ⬢ altıbucaq |

**Şriftlər:** başlıqlar **Montserrat** (800), mətn **Nunito** (600/700) — Google Fonts. Azərbaycan hərfləri (ə, ğ, ı, ö, ş, ü, ç, İ) mütləq düzgün göstərilməlidir; Claude Code bunu test etməlidir.

**Hərəkət (Framer Motion):**
- Səhifə keçidləri: 250–400 ms, `spring`.
- Avatar lobbiyə daxil olur: kənardan uçub “boing” (scale 0 → 1.2 → 1).
- Düymələr: basılanda `scale 0.95`, hover-də yüngül qalxma.
- Taymer halqası: hamar SVG dairə; son 5 s qırmızı nəbz.
- Reytinq: sətirlər `layout` animasiyası ilə yer dəyişir, xallar sayğac kimi artır.
- Fon: lobbi və podiumda yavaş üzən, yarışəffaf həndəsi formalar və ulduzlar.
- `prefers-reduced-motion` aktivdirsə, animasiyalar sadələşir.

**Avatarlar:**
- `@dicebear/collection`-dan 2–3 əyləncəli üslub (məs. `fun-emoji`, `adventurer`, `bottts-neutral`) — 24 hazır seed + təsadüfi.
- Avatar sənəddə `{ style, seed, accessory }` kimi saxlanır, SVG klientdə yaradılır.
- Claude Code seçdiyi üslubların lisenziyasını DiceBear lisenziya səhifəsində yoxlamalı və tələb olunan atributu “Haqqında” pəncərəsində göstərməlidir.
- **Aksesuar stikerləri:** avatarın küncünə emoji (👑 🎧 🕶️ 🎩 🌟 🔥).

**Stikerlər və rəy mesajları (`src/content/feedback.ts`):**
- Düzgün: “Əla! 🎉”, “Bomba! 💥”, “Sən alovlanırsan! 🔥”, “Dahi! 🧠”, “Super sürət! ⚡”
- Səhv: “Az qaldı! 💪”, “Növbəti səninkidir! 🚀”, “Təslim olmaq yox! 😎”
- Seriya: “3 ardıcıl! 🔥🔥🔥”
- Animasiyalı stiker effekti: emoji böyük ölçüdə, yırğalanma + parıltı (CSS/Framer Motion).

---

## 14. Səs və musiqi

**`src/audio/AudioEngine.ts`** — Web Audio API ilə kodla yaradılan səs (fayl və lisenziya lazım deyil):
- **Lobbi musiqisi:** enerjili, 115–125 BPM, 8 taktlıq dövrə (bas + akkordlar + sadə melodiya + ritm), 3 mövzu: `energetic`, `chill`, `retro` (8-bit).
- **Sual musiqisi:** gərgin, minimal ritm; son 5 saniyədə “tik-tak” sürətlənir.
- **Effektlər:** qoşulma “pop”, cavab göndərmə “klik”, düzgün “ding-ding”, səhv “bumm”, podium fanfarı, geri sayım “bip”.
- **Səviyyə:** ayarlardan; oyunçu və host üçün ayrıca 🔊/🔇 düyməsi; vəziyyət `localStorage`-da yadda qalır.
- **Brauzer qaydası:** brauzerlər istifadəçi toxunuşu olmadan səsi bloklayır. Musiqi oyunçuda “Qoşul 🚀” düyməsinə basılanda, hostda “Lobbini aç” düyməsinə basılanda başlayır.
- **İstəyə bağlı:** `public/audio/` qovluğuna istifadəçi lisenziyası olan MP3 faylları qoya bilər (`lobby.mp3`, `question.mp3`, `podium.mp3`) — fayl varsa, generativ musiqi əvəzinə o işləyir. Hər faylın lisenziyası `public/audio/LICENSES.md`-də qeyd olunur.

---

## 15. QR kod və qoşulma
- Qoşulma URL-i: `${window.location.origin}/join?pin=${pin}`.
- Host lobbisində QR (`qrcode.react`, `level="M"`, ağ fon, kənar boşluğu ilə, min. 420px), altında URL qısa formada və PIN.
- Admin panelində “QR-ı yüklə (PNG)” düyməsi — təqdimata qoymaq üçün.
- **Daimi QR rejimi:** `/play` ünvanı həmişə **ən son aktiv oyuna** yönləndirir (`settings/current` sənədi: `{ activeGameId }`). Beləliklə təqdimatdakı QR kod bir dəfə çap olunur və hər yeni oyunda dəyişmir. Təqdimata `https://<domen>.vercel.app/play` ünvanının QR-ı qoyulur.

---

## 16. Nəticələr və hesabatlar
- **Oyunçu:** bölmə 6.1 “Final” ekranı + “Cavablarıma bax”.
- **Host:** podium → tam reytinq → ümumi statistika.
- **Admin hesabatı:** cədvəl (oyunçu, xal, düzgün sayı, dəqiqlik, orta vaxt), sual analitikası (dəqiqlik %, paylanma, ən çox seçilən səhv variant), **CSV ixrac** (UTF-8 BOM ilə — Excel azərbaycan hərflərini düzgün açsın).

---

## 17. Kənar hallar
| Hal | Davranış |
|---|---|
| Eyni ad | İcazə verilir; reytinqdə avatar fərqləndirir. |
| Uyğunsuz ad | Qadağan sözlər filtri → “Başqa ad seçin”. Host oyunçunu çıxara bilər. |
| Oyunçu çıxarıldı (`kicked`) | Oyunçu ekranı: “Hostu tərəfindən oyundan çıxarıldınız”. |
| Gec qoşulma | Lobbi bağlı deyilsə, növbəti sualdan qoşulur, əvvəlki suallar 0 xal. |
| Səhifə yeniləndi | Avtomatik bərpa (bölmə 10.2). |
| İnternet kəsildi | “Bağlantı bərpa olunur…” banneri; cavab offline-da göndərilməyib-sə xəbərdarlıq. |
| Vaxt bitəndən sonra cavab | Rules rədd edir → “Vaxt bitdi ⏰”. |
| Host oyunu vaxtından əvvəl bitirdi | Hamı `finished` ekranına keçir, mövcud xallar qalır. |
| Oyunçu yoxdur | “Başla” düyməsi deaktivdir (min. 1 oyunçu). |
| Çox uzun sual mətni | Avtomatik şrift kiçilməsi (host ekranında). |

---

## 18. Əlçatanlıq
- Rəng heç vaxt tək məlumat daşımır (forma + mətn + ikon).
- Bütün düymələr klaviatura ilə işləyir, fokus görünür.
- Minimum toxunma sahəsi 48×48 px.
- Mətn kontrastı ≥ 4.5:1.
- Ekran oxuyucular üçün `aria-live` ilə “Düzdür, +873 xal”.

---

## 19. Dil və məzmun
- `src/i18n/az.ts` — bütün mətnlər. Gələcəkdə `en.ts` əlavə etmək mümkün olsun.
- Rəqəm/tarix formatı: `az-AZ`.

---

## 20. Layihə strukturu

```
/
├─ SPEC.md                 ← bu fayl
├─ README.md               ← qurulum, Firebase, Vercel addımları
├─ CHANGELOG.md
├─ docs/DECISIONS.md
├─ firestore.rules
├─ firebase.json           ← emulator üçün (istəyə bağlı)
├─ vercel.json             ← SPA rewrite
├─ .env.example
├─ seed/ai-pretest.json    ← bölmə 23-dəki 10 sual
├─ public/audio/           ← (istəyə bağlı) MP3 + LICENSES.md
└─ src/
   ├─ main.tsx, App.tsx, router.tsx
   ├─ firebase/ (config.ts, auth.ts, db.ts)
   ├─ i18n/az.ts
   ├─ styles/tokens.css
   ├─ audio/AudioEngine.ts
   ├─ content/feedback.ts
   ├─ lib/ (scoring.ts, timeSync.ts, pin.ts, csv.ts, nameFilter.ts, shuffle.ts)
   ├─ store/ (gameStore.ts)
   ├─ components/ (AnswerTile, TimerRing, Avatar, AvatarPicker, Leaderboard, Podium, QRBlock, Confetti, Sticker, ReactionBar, MuteButton …)
   ├─ pages/player/ (Join, Profile, Lobby, PlayerGame, PlayerResults)
   ├─ pages/host/ (HostLobby, HostGame, HostPodium, HostSummary)
   └─ pages/admin/ (Login, QuizList, QuizEditor, Games, GameReport, Settings)
```

`vercel.json`:
```json
{ "rewrites": [ { "source": "/(.*)", "destination": "/index.html" } ] }
```

`.env.example`:
```
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
```

`lib/scoring.ts` üçün **unit testlər** (Vitest) mütləqdir: tək seçim, çox seçim, seriya, bərabər xal, sərhəd halları.

---

## 21. İstifadəçinin edəcəyi addımlar (Claude Code bunları README-də izah etməlidir)

**Firebase:**
1. console.firebase.google.com → **Add project** → ad: `quizamcham` (Google Analytics lazım deyil).
2. Project Overview → **</>** (Web app) → ad ver → **firebaseConfig** dəyərlərini kopyala → Claude Code-a ver.
3. **Build → Authentication → Get started** → Sign-in method: **Anonymous** aktiv et, **Email/Password** aktiv et.
4. Authentication → **Users → Add user** → öz e-poçt və şifrən → yaranan **User UID**-ni kopyala.
5. **Build → Firestore Database → Create database** → yer: `europe-west` (Bakıya yaxın) → **Production mode**.
6. Firestore → **Data** → kolleksiya `admins` → sənəd ID = öz UID-in → sahə `email` (string).
7. Firestore → **Rules** → repodakı `firestore.rules` məzmununu yapışdır → **Publish**.
8. Authentication → Settings → **Authorized domains** → Vercel domenini əlavə et (məs. `quizamcham.vercel.app`).

**Vercel:**
1. vercel.com → **Add New → Project** → GitHub-dan `Quizamcham` reposunu seç.
2. Framework: **Vite** (avtomatik tanınır).
3. **Environment Variables** → `.env.example`-dakı 6 dəyişəni Firebase dəyərləri ilə əlavə et → **Deploy**.
4. Bundan sonra `main`-ə hər push avtomatik yeni deploy edir.

---

## 22. Mərhələlər (hər biri ayrıca branch → build/lint → main-ə merge)

### M1 — Skelet və Firebase (`feat/m1-skeleton`)
- Vite + React + TS + Tailwind + Router + Framer Motion qurulumu, `tokens.css`, şriftlər.
- Firebase init (`.env`), anonim və e-poçt auth köməkçiləri.
- `vercel.json`, `.env.example`, `README.md` (bölmə 21), `firestore.rules`.
- Boş marşrutlar və “Tezliklə” səhifələri.
- **Qəbul:** Vercel-də açılır, `/admin/login` ilə admin giriş edə bilir. İstifadəçidən Firebase config istənilir.

### M2 — Admin paneli və sual redaktoru (`feat/m2-admin`)
- Quiz CRUD, sual redaktoru (MVP tipləri: single, multi, truefalse, type, poll), validasiya, avtomatik yadda saxlama, sıralama, dublikat, JSON idxal/ixrac, önizləmə.
- `seed/ai-pretest.json` idxal edilə bilir.
- **Qəbul:** sualı redaktə edib yadda saxlayanda Firestore-da dərhal yenilənir; səhifəni yeniləyəndə dəyişiklik qalır.

### M3 — Canlı oyun nüvəsi (`feat/m3-live`)
- PIN, `games` sənədi, host lobbisi (QR, sayğac, avatarlar), oyunçu qoşulma + profil + avatar seçimi, lobbi real vaxt siyahısı.
- Start → countdown → sual → cavab → reveal → leaderboard → podium → finished.
- Xal hesablaması (`scoring.ts` + testlər), vaxt sinxronu, bərpa, çıxarma, kilid.
- `/play` daimi QR yönləndirməsi.
- **Qəbul:** 3 ayrı cihazla (və ya pəncərə ilə) tam oyun keçirilir, xallar düzgündür, hamı eyni anda sual görür.

### M4 — “Şou” təcrübəsi (`feat/m4-delight`)
- Bütün animasiyalar, AudioEngine (musiqi + effektlər), konfetti, stikerlər, rəy mesajları, seriya, emoji reaksiyaları, üzən fon formaları.
- **Qəbul:** lobbidə musiqi, cavabda stiker və səs, podiumda fanfar + konfetti; səs söndürülə bilir.

### M5 — Nəticələr və hesabatlar (`feat/m5-results`)
- Oyunçu final ekranı + “Cavablarıma bax”, host statistikası, admin oyun tarixçəsi və hesabatı, CSV ixrac, QR PNG yükləmə.
- **Qəbul:** oyundan sonra hər kəs öz nəticəsini görür, admin CSV-ni Excel-də düzgün açır.

### M6 — Əlavə sual tipləri və Wayground imkanları (`feat/m6-extras`, istəyə bağlı)
- `order`, `slider`, `wordcloud`, `open`, `slide` tipləri; power-ups; komanda rejimi; self-paced rejim.

### M7 — Sınaq və cilalama (`feat/m7-polish`)
- 30+ eyni vaxtlı oyunçu ilə yük sınağı (skript və ya çoxlu brauzer tabı), mobil Safari/Chrome yoxlanışı, əlçatanlıq yoxlanışı, Lighthouse ≥ 90 (performans, əlçatanlıq).

---

## 23. Başlanğıc məlumatı: təlim üçün 10 suallıq ilkin test (`seed/ai-pretest.json`)

Quiz adı: **“Süni İntellekt: Haradan başlayırıq?”** · rejim `host` · xal `speed` · standart vaxt 45 s.

```json
{
  "title": "Süni İntellekt: Haradan başlayırıq?",
  "description": "NextGen HR Leaders · AI təlimi üçün ilkin bilik yoxlaması",
  "coverEmoji": "🤖",
  "settings": { "mode": "host", "scoring": "speed", "defaultTime": 45, "streakBonus": true, "shuffleOptions": true, "showCorrect": true, "leaderboardEvery": 1, "music": { "on": true, "volume": 60, "theme": "energetic" } },
  "questions": [
    { "type": "single", "text": "LLM qısaltması nə deməkdir?", "timeLimit": 20, "points": "standard",
      "options": [ {"id":"a","text":"Large Language Model"}, {"id":"b","text":"Low Latency Machine"}, {"id":"c","text":"Linear Learning Method"}, {"id":"d","text":"Logical Language Module"} ],
      "correct": ["a"], "explanation": "LLM — Böyük Dil Modeli: çox böyük həcmdə mətn üzərində öyrədilmiş və dili anlayıb yaradan model." },

    { "type": "truefalse", "text": "ChatGPT, Claude və Gemini generativ süni intellekt nümunələridir.", "timeLimit": 15, "points": "standard",
      "options": [ {"id":"t","text":"Doğru"}, {"id":"f","text":"Yanlış"} ],
      "correct": ["t"], "explanation": "Hər üçü yeni məzmun (mətn, kod və s.) yaradan generativ AI sistemləridir." },

    { "type": "single", "text": "LLM cavabı əsasən necə yaradır?", "timeLimit": 30, "points": "standard",
      "options": [ {"id":"a","text":"Növbəti söz parçasını (tokeni) ehtimala görə təxmin edərək"}, {"id":"b","text":"İnternetdən hazır cavabı kopyalayaraq"}, {"id":"c","text":"Proqramçıların hər sual üçün yazdığı cavabları seçərək"}, {"id":"d","text":"Verilənlər bazasında açar söz axtararaq"} ],
      "correct": ["a"], "explanation": "Model hər addımda ən uyğun növbəti tokeni ehtimala görə seçir və cavabı token-token qurur." },

    { "type": "single", "text": "AI kontekstində “token” nədir?", "timeLimit": 20, "points": "standard",
      "options": [ {"id":"a","text":"Modelin emal etdiyi mətn parçası (söz və ya söz hissəsi)"}, {"id":"b","text":"Giriş şifrəsi"}, {"id":"c","text":"Kriptovalyuta"}, {"id":"d","text":"Modelin adı"} ],
      "correct": ["a"], "explanation": "Mətn modelə verilməzdən əvvəl tokenlərə bölünür; həm limitlər, həm qiymət tokenlərlə ölçülür." },

    { "type": "single", "text": "AI-da “halüsinasiya” nəyə deyilir?", "timeLimit": 30, "points": "standard",
      "options": [ {"id":"a","text":"Modelin inamla, lakin səhv və ya uydurma məlumat verməsinə"}, {"id":"b","text":"Modelin şəkil yaratmasına"}, {"id":"c","text":"Modelin yavaş işləməsinə"}, {"id":"d","text":"Modelin cavab verməkdən imtina etməsinə"} ],
      "correct": ["a"], "explanation": "Buna görə AI-ın verdiyi fakt, rəqəm və qanun istinadlarını həmişə yoxlamaq lazımdır." },

    { "type": "multi", "text": "Yaxşı promptun elementləri hansılardır? (bir neçə cavab)", "timeLimit": 45, "points": "standard",
      "options": [ {"id":"a","text":"Rol"}, {"id":"b","text":"Kontekst"}, {"id":"c","text":"Nəticənin formatı"}, {"id":"d","text":"Mümkün qədər qısa, bir sözlük sual"} ],
      "correct": ["a","b","c"], "explanation": "Rol, kontekst, tapşırıq, format, nümunə və məhdudiyyətlər nəticəni kəskin yaxşılaşdırır." },

    { "type": "single", "text": "Agentic AI adi çatbotdan nə ilə fərqlənir?", "timeLimit": 30, "points": "standard",
      "options": [ {"id":"a","text":"Məqsədə görə plan qurur, alətlərdən istifadə edir və addımları özü icra edir"}, {"id":"b","text":"Daha sürətli yazır"}, {"id":"c","text":"Yalnız səslə işləyir"}, {"id":"d","text":"İnternetsiz işləyir"} ],
      "correct": ["a"], "explanation": "Agent məqsəd alır, plan qurur, alətləri (axtarış, fayl, e-poçt, GitHub) işlədir və nəticəni yoxlayır." },

    { "type": "truefalse", "text": "İşçilərin fərdi məlumatlarını (FİN, maaş) istənilən pulsuz AI çatbotuna yükləmək təhlükəsizdir.", "timeLimit": 15, "points": "double",
      "options": [ {"id":"t","text":"Doğru"}, {"id":"f","text":"Yanlış"} ],
      "correct": ["f"], "explanation": "Fərdi məlumatlar yalnız şirkətin təsdiqlədiyi, məxfiliyi təmin edən həllərdə və ya anonimləşdirilərək istifadə olunmalıdır." },

    { "type": "single", "text": "Dil modelinin öyrədilmə mərhələlərinin düzgün ardıcıllığı hansıdır?", "timeLimit": 30, "points": "standard",
      "options": [ {"id":"a","text":"Pre-training → Fine-tuning → RLHF"}, {"id":"b","text":"RLHF → Pre-training → Fine-tuning"}, {"id":"c","text":"Fine-tuning → RLHF → Pre-training"}, {"id":"d","text":"Pre-training → RLHF → Fine-tuning"} ],
      "correct": ["a"], "explanation": "Əvvəl geniş mətnlərdən ümumi bilik (pre-training), sonra köməkçi kimi davranış (fine-tuning), sonda insan rəyi ilə tənzimləmə (RLHF)." },

    { "type": "type", "text": "Transformer modelində sözlər arasındakı əlaqəni tapan mexanizmin adı nədir? (bir söz, ingiliscə)", "timeLimit": 45, "points": "standard",
      "accepted": ["attention", "self-attention", "self attention"],
      "correct": [], "explanation": "“Attention” mexanizmi modelə cümlədəki hər sözün digər sözlərlə əlaqəsini “diqqətlə” qiymətləndirməyə imkan verir." }
  ]
}
```

---

## 24. Qəbul yoxlama siyahısı (son)
- [ ] QR skan → ad/soyad → avatar → lobbi: 30 saniyədən az.
- [ ] Host və oyunçular yeni qoşulanı 1 saniyə ərzində görür.
- [ ] Start → hamıda eyni anda countdown (fərq < 500 ms).
- [ ] Taymer hamıda eyni göstərir; vaxt bitəndə cavab qəbul olunmur.
- [ ] Oyunçu düzgün cavabı heç bir yolla (DevTools daxil) əvvəlcədən görə bilmir.
- [ ] Xallar bölmə 9-a uyğundur (unit testlər keçir).
- [ ] Musiqi və səs işləyir, söndürülür.
- [ ] Admin sualı redaktə edir → yadda saxlanılır → növbəti oyunda yeni versiya görünür, deploy lazım olmur.
- [ ] Final ekranında hər kəs öz nəticəsini və cavablarını görür.
- [ ] CSV Excel-də azərbaycan hərfləri ilə düzgün açılır.
- [ ] Mobil Safari və Chrome-da problemsiz.
- [ ] Hər mərhələ `main`-ə merge edilib və Vercel-də canlıdır.

## 25. Bu versiyaya daxil deyil
- Ödənişli Firebase xidmətləri (Cloud Functions, Storage).
- AI ilə avtomatik sual generasiyası tətbiqin içində (əvəzinə: Claude-da JSON yaradıb idxal etmək).
- Çoxlu admin rolları və təşkilatlar.
