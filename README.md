# Jabr.

> Əvvəlki adı: Quizamcham. Repo və Firebase layihəsi adları dəyişməyib.

AmCham Azərbaycan “NextGen HR Leaders” proqramı üçün canlı, mobil-öncəlikli quiz platforması.
**Stek:** React 19 · Vite 8 · TypeScript · Tailwind 4 · Framer Motion · Firebase (Auth + Firestore). Spesifikasiya: [SPEC.md](SPEC.md) · Qərarlar: [docs/DECISIONS.md](docs/DECISIONS.md) · Dəyişikliklər: [CHANGELOG.md](CHANGELOG.md).

## İmkanlar
- **4 oyun rejimi:** Təlimçi idarə edir · Avtomatik (ekranlar özü keçir) · Öz tempində (ümumi vaxt limiti) · Tapşırıq (host olmadan, son tarixli link).
- **10 sual tipi:** tək/çox seçim, doğru-yanlış, cavabı yaz, sorğu, sıralama, slayder, söz buludu, açıq cavab, slayd.
- **Oyun:** QR + PIN, sual önizləməsi, server vaxtı ilə xal, seriya bonusu, güc artırıcılar (50/50, 2x, qalxan), komanda rejimi (2–4), canlı Q&A, emoji reaksiyaları, mükafatlar, podium.
- **İştirakçı:** avatar və stiker, nəticə kartı (PNG), iştirak sertifikatı, “Cavablarıma bax”, rəy sorğusu, titrəmə, AZ/EN dil.
- **Təlimçi:** panel, analitika, quiz redaktoru (avtomatik yadda saxlama, geri al, sıralama, şəkil yükləmə, sualı köçürmə, etiketlər), şablonlar, AI prompt + JSON idxalı, Excel/CSV idxalı, hesabat + CSV, 14 musiqi mövzusu, düz/səhv cavab səs parçası yükləyici, profil, komanda (sahib/təlimçi rolları), məlumatların təmizlənməsi və ehtiyat nüsxəsi, xəta jurnalı.
- **Etibarlılıq:** ekran kilidi (Wake Lock), host gecikməsi xəbərdarlığı, bağlantı itəndə bərpa, PWA (offline qabıq), 40 botla yük testi (0 rədd).

## Marşrutlar
| Ünvan | Kim üçün |
|---|---|
| `/` · `/join?pin=…` | Oyunçu: PIN → profil → lobbi |
| `/play` | Daimi QR: ən son aktiv oyuna aparır |
| `/g/:gameId` | Oyunçu ekranı |
| `/host/:gameId` | Proyektor (host) ekranı |
| `/admin` | Panel · quizlər · oyunlar · analitika · səslər · profil · komanda · ayarlar |
| `/privacy` | Məxfilik bildirişi |

## Lokal işə salma
```bash
npm install
npm run dev
```
Firebase web config kodda standart dəyər kimi var (`src/firebase/config.ts`); başqa layihə üçün `.env.example` → `.env.local`.

## Yoxlamalar
| Əmr | Nə edir |
|---|---|
| `npm run lint` · `npm run build` | ESLint + TypeScript + production build |
| `npm test` | Unit testlər (xal hesablama, Excel/CSV idxalı) |
| `npm run test:rules` | Firestore qayda testləri (emulator, Java 21 tələb edir) |
| `npm run e2e` | Playwright: ictimai səhifələr, əlçatanlıq (axe), tam oyun (`E2E_ADMIN_EMAIL`/`E2E_ADMIN_PASSWORD` ilə) |
| `npm run load-test -- <PIN> 40` | N bot oyunçu ilə yük testi (host ekranı açıq olmalıdır) |

CI (`.github/workflows/ci.yml`) hər push-da build/lint/unit, qayda testləri və e2e işlədir. Tam oyun e2e testi üçün repo sirlərinə `E2E_ADMIN_EMAIL` və `E2E_ADMIN_PASSWORD` əlavə edin (ayrıca test hesabı tövsiyə olunur).

## Firebase (layihə: `birsual`)
Qurulub: Anonymous + Email/Password auth, Firestore (`eur3`), `firestore.rules` publish edilib, admin hesabı (`role: owner`).
```bash
export GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
node scripts/firebase-setup.mjs --rules                          # qaydaları publish et
node scripts/firebase-setup.mjs --admin email@x.az 'Şifrə123!'   # sahib hesabı
node scripts/firebase-setup.mjs --seed                           # ilkin quiz
```
Yeni təlimçiləri **Admin → Komanda** səhifəsindən əlavə edin.

### Əl ilə edilməli addımlar
1. **Authorized domains:** Authentication → Settings → Vercel domenini əlavə edin.
2. **Servis hesabı açarını yeniləyin** (chat-də paylaşıldığı üçün): Project settings → Service accounts → köhnə açarı silin, yenisini yaradın.
3. **App Check (tövsiyə):** Google Cloud → reCAPTCHA → v3 sayt açarı yaradın → Firebase Console → App Check → Web app → reCAPTCHA v3 → Vercel-də `VITE_RECAPTCHA_SITE_KEY` təyin edin → bir neçə gün metrikaya baxıb Firestore üçün **Enforce** edin.
4. **Ehtiyat nüsxə:** Admin → Ayarlar → “Bütün məlumatları ixrac et” (avtomatik planlı backup Blaze planı tələb edir).

## Vercel
1. vercel.com → **Add New → Project** → `Quizamcham`. Framework: **Vite**.
2. Environment Variables lazım deyil (istəyə bağlı: `VITE_RECAPTCHA_SITE_KEY`).
3. `main`-ə hər push avtomatik deploy olunur. `vercel.json` SPA yönləndirməsini edir.

## Təlim günü
1. `/admin` → quiz → **Oyunu başlat** → host ekranını proyektora çıxarın → **Lobbini aç**.
2. İştirakçılar QR-ı skan edir; hamı qoşulanda **Başla** (`Space`).
3. Qısayollar: `Space` növbəti · `P` pauza · `M` musiqi · `F` tam ekran. Q&A paneli alt menyudadır.
4. Host noutbukunu enerji qənaəti/yuxu rejiminə qoymayın — xallar host brauzerində hesablanır.
5. Sonda **CSV ixrac**; rəylər və hesabat **Oyunlar** bölməsindədir.

## Məlum məhdudiyyət
Pulsuz Spark planında Cloud Functions olmadığı üçün xal hesablama host brauzerində işləyir (Tapşırıq rejimində — təlimçi “Qiymətləndir” düyməsini basanda). Server tərəfi qiymətləndirmə üçün Blaze planı + Cloud Functions lazımdır.
