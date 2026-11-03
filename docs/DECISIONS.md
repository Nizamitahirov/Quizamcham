# Qərarlar

- TypeScript 6.0.3 seçildi (7.x typescript-eslint tərəfindən hələ dəstəklənmir); `@dicebear/core` 9.4.3 (`@dicebear/collection` 9.x ilə uyğun).
- Avatar üslubları: `fun-emoji`, `adventurer` (CC BY 4.0), `bottts` (pulsuz istifadə) — atribut “Haqqında” pəncərəsindədir.
- Plitə rəngləri C/D/F kontrast ≥ 4.5:1 üçün tündləşdirildi: `#B45309`, `#047857`, `#BE185D`.
- Çox seçim xalı: hər düzgün variant `basePoints × sürət / düzgünlərin sayı`, hər səhv eyni qədər azaldır, min 0; “düzgün” (seriya üçün) yalnız tam uyğunluqda.
- “Cavabı yaz”: həm az-AZ (I→ı), həm en-US (I→i) kiçik hərf qaydası ilə müqayisə; durğu işarələri nəzərə alınmır.
- `questionStartedAt` serverTimestamp ilə yazılır, sonra serverdən oxunub `questionEndsAt` əlavə edilir (ikinci yazı); bu arada cavab plitələri deaktivdir.
- Host vaxt bitdikdən 1,5 s sonra (Rules +2 s icazə verir) və ya hamı cavab verəndə xalları hesablayır.
- Pauza zamanı `questionEndsAt = null` → Rules cavabları rədd edir.
- Variantlar oyunçuya görə (uid+sual) qarışdırılır, rəng/forma isə variantın özünə bağlıdır — host ekranı ilə uyğun gəlsin.
- `answeredCount` hər cavabda yox, yalnız reveal-da yazılır (oxuma kvotasına qənaət); host canlı sayı `answers` dinləyicisindən alır.
- Oyun bitəndə suallar + düzgün cavablar `games/{id}.review`-a yazılır ki, oyunçular “Cavablarıma bax” edə bilsin.
- `self` (öz tempində) rejimi, power-ups və komanda rejimi hələ edilməyib (M6, istəyə bağlı).
- Sessiya branch qaydasına görə iş `claude/quirky-galileo-mk297c` branch-ində aparılır; `main`-ə merge istifadəçinin təsdiqi ilə.
- Firebase web config koda standart dəyər kimi yazıldı (ictimai məlumatdır, Rules qoruyur); env dəyişənləri varsa, onlar üstünlük alır. Səbəb: Vercel-də env olmadan da işləsin.
