# Quizamcham

AmCham Azərbaycan “NextGen HR Leaders” proqramı üçün canlı, mobil-öncəlikli quiz platforması (Vite + React + TypeScript + Tailwind + Firebase). Tam spesifikasiya: [SPEC.md](SPEC.md).

## Marşrutlar
| Ünvan | Kim üçün |
|---|---|
| `/join` (`/join?pin=123456`) | Oyunçu: PIN → ad/soyad → avatar → lobbi |
| `/play` | Daimi QR: həmişə ən son aktiv oyuna aparır |
| `/g/:gameId` | Oyunçunun oyun ekranı |
| `/host/:gameId` | Proyektor (host) ekranı |
| `/admin` | Admin paneli: quizlər, redaktor, oyunlar, hesabatlar, ayarlar |

## Lokal işə salma
```bash
npm install
cp .env.example .env.local   # Firebase web config dəyərlərini yazın
npm run dev
```
Yoxlamalar: `npm run build`, `npm run lint`, `npm test` (xal hesablama testləri).

## Firebase (layihə: `birsual`)
Artıq qurulub: Anonymous + Email/Password auth aktivdir, Firestore (`eur3`) yaradılıb, `firestore.rules` publish edilib, admin hesabı və `admins/{uid}` sənədi yazılıb, “Süni İntellekt: Haradan başlayırıq?” quizi idxal edilib.

Təkrar qurmaq / yeniləmək üçün (servis hesabı açarı ilə, açar repoya **düşmür**):
```bash
export GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
node scripts/firebase-setup.mjs --rules                         # rules publish
node scripts/firebase-setup.mjs --admin email@x.az 'Şifrə123!'  # admin yarat
node scripts/firebase-setup.mjs --seed                          # ilkin quiz
```
Servis hesabına əlavə IAM rolları vermək üçün Google Cloud Shell-də bir dəfə: `bash scripts/cloudshell-grant-access.sh`.

Əl ilə edilməli yeganə addım: Vercel domenini **Authentication → Settings → Authorized domains**-ə əlavə etmək (məs. `quizamcham.vercel.app`).

## Vercel
1. vercel.com → **Add New → Project** → `Quizamcham` reposu. Framework: **Vite**.
2. Environment Variables lazım deyil — Firebase config kodda standart dəyər kimi var (istəsəniz `VITE_FIREBASE_*` ilə əvəz edə bilərsiniz).
3. **Deploy**. Bundan sonra `main`-ə hər push avtomatik deploy olunur. `vercel.json` SPA yönləndirməsini edir.

## Təlim günü
1. `/admin` → quiz → **▶ Oyunu başlat** → host ekranını proyektora çıxarın → **Lobbini aç** (musiqi).
2. İştirakçılar QR-ı skan edir; hamı qoşulanda **▶ Başla** (və ya `Space`).
3. Qısayollar: `Space` növbəti · `P` pauza · `M` musiqi · `F` tam ekran.
4. Sonda **CSV ixrac** (Excel-də azərbaycan hərfləri düzgün açılır).

## Sualları AI ilə hazırlamaq
Admin → quiz redaktoru → **⬇ JSON** ilə nümunə formatı endirin (və ya `seed/ai-pretest.json`), Claude-dan eyni formatda suallar istəyin, **⬆ JSON idxal** ilə yükləyin.

## Musiqi
Səslər Web Audio API ilə kodla yaradılır. İstəsəniz `public/audio/lobby.mp3`, `question.mp3`, `podium.mp3` qoya bilərsiniz (lisenziyanı `public/audio/LICENSES.md`-də qeyd edin) — fayl varsa, o çalınır.
