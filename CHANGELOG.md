# Changelog

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
