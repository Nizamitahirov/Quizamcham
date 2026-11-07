# Changelog

## 0.8.0 — 2026-11-07 (icazələrin idarə edilməsi)
- **Tənzimlənən icazələr:** super admin Komanda səhifəsində hər rol (Admin, Təlimçi) üçün 8 icazəni açıb-bağlayır: quiz yaratmaq, oyun keçirmək, kitabxananı görmək, kitabxanaya paylaşmaq, bütün məzmun, təlimçiləri idarə etmək, ayarlar və səslər, loglar. "Adminləri idarə etmək" yalnız super admindədir və verilə bilməz.
- **Fərdi icazələr:** hər üzv üçün "Rol üzrə / Ver / Alma" — rol standartından üstündür; sətirdə "N fərdi icazə" nişanı.
- Hər ikisi serverdə (Firestore Rules) tətbiq olunur və açıq sessiyalara dərhal təsir edir; dəyişikliklər audit jurnalına yazılır.
- **Komanda səhifəsi:** göstərici kartları (üzvlər, adminlər, təlimçilər, diqqət tələb edənlər), bərabər hündürlüklü kartlar, boş komanda üçün yönləndirici blok, genişləndirilmiş en; telefonda icazələr kart şəklində.

## 0.7.0 — 2026-11-07 (giriş idarəetməsi)
- **Rollar:** Super admin (nt.nizamitahir@gmail.com — hesab ID-si ilə Rules-da sabitlənib, silinə/məhdudlaşdırıla/rolu dəyişdirilə bilməz) → Admin → Təlimçi. Köhnə "owner" rolu admin sayılır.
- **Təlimçi** yalnız öz quizlərini, kitabxanaya paylaşılan quizləri (baxış + surət), öz oyunlarını və analitikasını görür; komanda, ayarlar, səslər və loglar bağlıdır. Server tərəfində (Firestore Rules) tətbiq olunur.
- **Admin** təlimçiləri idarə edir (əlavə, şifrə sıfırlama linki, məhdudlaşdırma, silmə), bütün məzmunu görür; adminləri yalnız super admin idarə edir.
- **İlk giriş:** yeni üzv müvəqqəti şifrə ilə daxil olur və bağlana bilməyən pəncərədə öz şifrəsini təyin edir (≥10 simvol, böyük/kiçik hərf, rəqəm). Yeni şifrəni heç kim görmür; admin yalnız sıfırlama linki göndərə bilər.
- **Məhdudlaşdırma:** hesab silinmir, açıq sessiya dərhal "məhdudlaşdırılıb" ekranına keçir.
- **Loglar (yalnız super admin):** audit jurnalı (giriş, şifrə dəyişmə/sıfırlama, üzv əməliyyatları, quiz/oyun silmə, paylaşma, ayarlar, səslər, ixrac/təmizləmə) — dəyişdirilə və silinə bilməz; xəta jurnalı Ayarlardan bura köçdü.
- **Kitabxana:** quiz redaktorunda "Kitabxanaya paylaş".

## 0.6.0 — 2026-11-06 (performans və ədalət)
**Qoşulma**
- Yeni telefonda eyni anda iki anonim giriş yaranırdı; səhifə köhnə uid ilə yazırdı və qoşulma "Lobbi bağlıdır" ilə rədd olunurdu. İndi bütün çağırışlar tək girişi paylaşır.
- Oyun ekranı uid gələn ilk anda iştirakçını "yoxdur" sayıb qoşulma səhifəsinə qaytarırdı (join ↔ oyun dövrəsi, "çox gec qoşulur"). Yüklənmə vəziyyəti indi hər sənəd yolu üçün ayrıca izlənir; keşdən gələn "yoxdur" server təsdiqi sayılmır.
- Qoşulma bir şəbəkə gedişidir və təkrara davamlıdır; rədd olunanda səbəb oyunun hazırkı vəziyyətindən dəqiq göstərilir (başlayıb / bağlıdır / doludur / ad uyğun deyil). 6 s-dən uzun çəkəndə "bağlantı zəifdir, gözləyin" bildirişi.
- İştirakçı telefonlarında Firestore yaddaş keşi (IndexedDB + çox-tab koordinasiyası yalnız admin/host ekranlarında).

**Sualın açılması**
- Sualın cavabları, başlama və bitmə vaxtı oxuma mərhələsində yazılır; telefon cavabları server saatı ilə özü açır, hostun ikinci yazısını gözləmir. Şəbəkə gecikməsi oxuma vaxtının içində "əriyir".
- Sual telefona yenə də gec çatarsa, an server vaxtı ilə qeyd olunur və sürət xalı o andan hesablanır (ən çox 5 s güzəşt).

**Öz tempində rejimi**
- "Hər iştirakçıya fərqli ardıcıllıq" (standart açıq; tapşırıq rejimində də): yanaşı oturanlar eyni anda fərqli suallar görür.
- "Hər sualdan sonra nəticəni göstər" söndürülə bilər: iştirakçı dayanmadan sona qədər cavablayır, bitirəndə "Bitirənlər X/N" ekranında gözləyir; proyektorda xal gizlidir.
- Növbəti sual cavab gələn kimi göndərilir (qiymətləndirməni gözləmir). Hamı bitirəndə və ya vaxt dolanda nəticələr podiumda açıqlanır.

## 0.5.2 — 2026-11-04
- **Loqo şrifti:** Petrov Sans-a bənzər pulsuz (OFL) **Figtree 800** — yumşaq keçidli həndəsi forma. Nöqtə yenə brend qradiyentindədir (qırmızı→narıncı). İkonlar, OG şəkli, sertifikat və paylaşım kartı yeniləndi.

## 0.5.1 — 2026-11-04
- **Loqo şrifti:** "Jabr." loqosu artıq Lexend Giga 700 (sıx hərf aralığı) ilə, nöqtə kəhrəba (#FEA606) — verilən nümunəyə uyğun. Yalnız loqo bu şriftdədir, interfeys Montserrat-da qalır. İkonlar, OG şəkli, sertifikat və paylaşım kartı yeniləndi.

## 0.5.0 — 2026-11-04
- **Ad dəyişdi: Jabr.** Yeni loqo — "Jabr" sözü + brend qradiyentli nöqtə; yığcam "J." nişanı (favicon, tətbiq ikonları, maskable), yeni Open Graph şəkli; sertifikat və paylaşım kartında yeni loqo.
- **Yer nişanları:** 1-ci (qızıl), 2-ci (gümüş), 3-cü (bürünc) yer üçün rozet + medal + dəfnə + lent dizaynlı nişan — sertifikatda (imzaların arasında), paylaşım kartında və nəticə ekranında.
- **Təlimçi profili düzülüşü:** önizləmə kartı sağ sütunla bərabər hündürlükdə; standart ayarlar tam enli bölmələrə keçdi (xal/vaxt 2 sütunlu şəbəkə, 9 açar 3×3, iştirakçı ayarları yan-yana) — boş sahələr qalmır. Eyni forma quiz redaktorunda da istifadə olunur.
- **Musiqi seçicisi:** 14 mövzu genişdə 7×2, telefonda 2×7 — boş xana yoxdur.
- **Tarix formatı:** az-AZ lokalında ay adları olmadığı üçün ("2026 M11 4") öz formatlayıcı — "4 noyabr 2026".

## 0.4.1 — 2026-11-04 (audit düzəlişləri)
**Məxfilik:** oyunları və PIN-ləri yalnız adminlər siyahılaya bilir; bitmiş oyun yalnız iştirakçılarına açıqdır; düzgün cavablı icmal ayrıca qorunan sənəddədir (`games/{id}/results/review`); Q&A və reaksiyalar yalnız iştirakçılara, Q&A 10 saniyədə 1 sual; təlimçi profilləri yalnız adminlərə; qlobal ayarlar və səslər yalnız sahibə; maks. oyunçu və qadağan adlar Rules-da da yoxlanır.
**Məntiq:** iştirakçı bitmiş oyuna QR/PIN ilə qayıdanda öz nəticəsini görür (tapşırıq daxil); hər təlimçinin şəxsi daimi QR-ı (`/play?t=…`), tapşırıq QR-ı dəyişmir, bitmiş oyun QR-dan çıxır; komandaları host bölüşdürür (eyni anda qoşulma balansı pozmur); öz tempində rejimdə host gecikməsi xəbərdarlığı; xal hesablaması təkrarlananda ikiqat yazılmır; təlimçi rolu: başqasının quizi “yalnız baxış” + surət yarat, silmə xətaları göstərilir, yalnız öz oyunları/analitikası, Ayarlar və Səslər yalnız sahibə, başqasının host ekranı bağlıdır.
**Etibarlılıq:** sualın bitmə vaxtı yazısı 3 dəfə təkrar edilir və host tərəfindən təmir olunur; oyunçu plitələri bitmə vaxtı cihaza çatmamış da aktivdir, cavab yazısı avtomatik təkrar edilir; oyunçu ekranında “watchdog” — canlı bağlantı donanda Firestore şəbəkəsi yenidən qurulur.
**Kiçik:** son tarixi keçmiş tapşırıqlar və 12 saatdan köhnə yarımçıq oyunlar avtomatik yekunlaşır; tarix/rəqəm formatı dilə uyğun; CSV başlıqları tərcümə olunub və komanda sütunu əlavə edilib; ingiliscə AI prompt; analitikada eyni adlı fərqli insanlar ayrılır; PIN sahəsi dar ekranda kəsilmir; cavab səsləri versiya ilə keşlənir.
**Testlər:** Firestore qayda testləri 24 → 33.

## 0.4.0 — 2026-11-04
**Etibarlılıq:** Wake Lock (host və oyunçu), host gecikməsi xəbərdarlığı, tab bağlama qoruması, oflayn banneri, lobbi massivinin limiti, 40 botla yük testi skripti (400 cavab, 0 rədd, p95 252 ms).
**Təhlükəsizlik:** sahib/təlimçi rolları və Komanda səhifəsi; quiz və oyun sahibliyi; cavab ölçüsü, reaksiya tezliyi, adı yalnız lobbidə dəyişmək qaydaları; öz tempində rejimdə suallar hər oyunçuya ayrıca göndərilir; istəyə bağlı App Check; məxfilik bildirişi; köhnə oyunların silinməsi, JSON ehtiyat nüsxə; Firestore xəta jurnalı.
**Keyfiyyət:** 24 Firestore qayda testi (emulator), Playwright e2e + axe əlçatanlıq testləri, GitHub Actions CI, PWA (manifest, ikonlar, service worker, offline səhifə), Open Graph şəkli, avatar üslublarının tənbəl yüklənməsi, Firebase Analytics, səhifə səviyyəsində xəta sərhədləri, `useSelfEngine` refaktoru.
**Funksiyalar:** Tapşırıq rejimi, komanda rejimi, canlı Q&A, rəy sorğusu, iştirak sertifikatı, şablon qalereyası (3 şablon), Excel/CSV idxalı, şəkil yükləmə (sıxılma ilə), sualı başqa quizə köçürmə, quiz etiketləri, Analitika səhifəsi, ingilis dili (AZ/EN), titrəmə.

## 0.3.0 — 2026-11-03
- 3 oyun rejimi: Təlimçi idarə edir, Avtomatik (ekranlar özü keçir), Öz tempində (hər oyunçu öz sürəti ilə, ümumi vaxt limiti; host canlı irəliləyişi izləyir).
- Quiz ayarları pəncərədən çıxarıldı → redaktorda “Suallar / Ayarlar” tabları, seçim kartları, seqment düymələr, vahid bölmə kartları.
- 14 generativ musiqi mövzusu, hər biri 8 saniyəlik dinləmə ilə.
- Yeni orijinal qələbə və məyus səsləri; Admin → Səslər: istənilən audio fayldan seçilmiş hissəni (≤ 8 s) kəsib düz/səhv cavab səsi kimi təyin etmək.
- Təlimçi profili: ad, vəzifə, təşkilat, bio, foto/avatar, şifrə dəyişmə, yeni quizlər üçün standart ayarlar; profil lobbidə göstərilir.
- CSS komponent sinifləri Tailwind qatlarına köçürüldü (utility sinifləri düzgün işləyir).

## 0.2.0 — 2026-11-03
- Dizayn yenidən quruldu: yalnız Montserrat, Birbank üslubunda qırmızı → narıncı qradiyent, lucide ikonları.
- Futuristik giriş səhifəsi (PIN birbaşa ana səhifədə, işıq parıltıları, perspektiv tor); “Haqqında” girişdən çıxarıldı.
- Admin paneli TaxIQ üslubunda: yan menyu, mobil alt menyu, Panel (KPI-lar, son oyunlar, tez əməliyyatlar), bölünmüş giriş səhifəsi.
- Yeni: güc artırıcılar (50/50, 2x xal, seriya qalxanı), sualın cavablardan əvvəl göstərilməsi (oxuma vaxtı), “Ən sürətli” oyunçu, oyun sonu mükafatları, paylaşıla bilən PNG nəticə kartı.
- Yeni: AI ilə sual yaratma (prompt qurucu + JSON yapışdırma), quiz axtarışı, oyunun irəliləmə zolağı, düzgün cavab faizi.

## 0.1.0 — 2026-11-03
- M1: Vite + React + TS + Tailwind skeleti, dizayn tokenləri, Firebase init, auth köməkçiləri, `vercel.json`, `firestore.rules`.
- M2: Admin paneli — quiz CRUD, sual redaktoru (10 tip), validasiya, 1,5 s avtomatik yadda saxlama, sürüşdürərək sıralama, dublikat, geri al (20), JSON idxal/ixrac, telefon önizləməsi.
- M3: Canlı oyun — PIN, QR, lobbi, countdown → sual → reveal → reytinq → podium → bitdi; server vaxtı ilə xal, saat sinxronu, bərpa, çıxarma, kilid, gec qoşulma, `/play` daimi QR.
- M4: Animasiyalar, generativ musiqi və effektlər, konfetti, stikerlər, seriya, emoji reaksiyaları, üzən fon formaları.
- M5: Oyunçu final ekranı + “Cavablarıma bax”, host statistikası, oyun tarixçəsi və hesabatı, CSV (UTF-8 BOM), QR PNG.
- M6 (qismən): `order`, `slider`, `wordcloud`, `open`, `slide` tipləri.
- Firebase: auth provayderləri, rules, admin hesabı və ilkin quiz Admin SDK skripti ilə quruldu.
