/**
 * Hüquqi sənədlər (məxfilik siyasəti, istifadə şərtləri, fərdi məlumatların emalına razılıq, marketinq razılığı).
 * Azərbaycan Respublikasının "Fərdi məlumatlar haqqında" Qanunu və GDPR-ın ən yaxşı təcrübələri əsasında hazırlanıb.
 * Versiya dəyişəndə LEGAL_VERSION artırılır — istifadəçinin verdiyi razılıq bu versiya ilə qeyd olunur.
 * Qeyd: operatorun hüquqi adı və VÖEN-i məlum olanda OPERATOR sahəsinə əlavə edin.
 */
export const LEGAL_VERSION = '2026-11-07'
export const OPERATOR = { name: 'Jabr platformasının operatoru', nameEn: 'the operator of the Jabr platform', email: 'nt.nizamitahir@gmail.com', phone: '+994 99 777 70 09' }

export type LegalId = 'privacy' | 'terms' | 'consent' | 'marketing'
export interface LegalSection { h: string; p?: string[]; list?: string[] }
export interface LegalDoc { id: LegalId; title: string; summary: string; sections: LegalSection[] }

const O = OPERATOR

const az: LegalDoc[] = [
  {
    id: 'privacy', title: 'Məxfilik siyasəti',
    summary: 'Hansı məlumatları topladığımızı, nə üçün istifadə etdiyimizi, harada saxladığımızı və hüquqlarınızı izah edir.',
    sections: [
      { h: '1. Biz kimik', p: [`Jabr canlı viktorina və təlim platformasıdır. Fərdi məlumatlarınızın sahibi və operatoru ${O.name}dur ("Operator", "biz"). Əlaqə: ${O.email}, ${O.phone}.`, 'Bu siyasət Azərbaycan Respublikasının "Fərdi məlumatlar haqqında" Qanununa uyğun hazırlanıb və Avropa İttifaqının Ümumi Məlumat Mühafizəsi Reqlamentinin (GDPR) prinsiplərinə əsaslanır.'] },
      { h: '2. Prinsiplərimiz', list: [
        'Qanunilik və şəffaflıq — məlumatları yalnız razılığınız və ya qanuni əsasla, açıq məqsədlə emal edirik.',
        'Məqsədin məhdudluğu — məlumatlar yalnız bu siyasətdə göstərilən məqsədlər üçün istifadə olunur.',
        'Minimallıq — yalnız xidmət üçün lazım olan məlumatları soruşuruq; məcburi olmayan sahələr istəyə bağlıdır.',
        'Dəqiqlik — məlumatlarınızı istənilən vaxt "Hesabım" səhifəsində yeniləyə bilərsiniz.',
        'Saxlama müddətinin məhdudluğu — məlumatlar lazım olduğu müddətdən artıq saxlanılmır (bölmə 7).',
        'Təhlükəsizlik və məxfilik — giriş hüquqları rollar üzrə serverdə məhdudlaşdırılır, bütün əlaqə şifrələnir.',
        'Hesabatlılıq — razılıqlarınız versiya və tarixlə qeyd olunur; idarəçi əməliyyatları audit jurnalına yazılır.',
      ] },
      { h: '3. Hansı məlumatları toplayırıq', list: [
        'Qeydiyyat (Google hesabı ilə): ad, soyad, e-poçt, Google profil şəkli, telefon nömrəsi, ölkə, şəhər.',
        'Peşə/təhsil məlumatı: təlimçi üçün sektor, vəzifə, təşkilat, məqsəd; müəssisə üçün növ, ad, ölçü, təlimçi sayı; tələbə üçün təhsil səviyyəsi, müəssisə, ixtisas, kurs.',
        'Maraq sahələri və bizi haradan eşitdiyiniz (istəyə bağlı).',
        'Canlı oyun iştirakçısı: daxil etdiyiniz ad, soyad, avatar, cavablar, xal və yer. Anonim iştirakçıdan e-poçt və telefon soruşulmur.',
        'Məşq nəticələri: keçdiyiniz quizlər, düzgün cavab sayı, xal və vaxt.',
        'Lisenziya müraciəti: ad, telefon, e-poçt, təşkilat, plan, qeyd.',
        'Texniki məlumatlar: giriş vaxtı, brauzer növü, xəta qeydləri və anonimləşdirilmiş istifadə statistikası (Firebase Analytics).',
        'Razılıqlar: hansı sənədə, hansı versiyaya və nə vaxt razılıq verdiyiniz.',
      ] },
      { h: '4. Məqsədlər və hüquqi əsaslar', list: [
        'Hesab yaratmaq, girişi təmin etmək və platformanı göstərmək — müqavilənin icrası və razılığınız.',
        'Canlı oyunlar, nəticələr, sertifikatlar və hesabatlar — müqavilənin icrası.',
        'Sınaq, pulsuz plan və lisenziyaların idarə edilməsi, müraciətlərə cavab — müqavilənin icrası.',
        'Təhlükəsizlik, sui-istifadənin qarşısının alınması, xətaların aradan qaldırılması — qanuni maraq.',
        'Xidmətin təkmilləşdirilməsi üçün ümumiləşdirilmiş statistika — qanuni maraq.',
        'Yeniliklər və təkliflər barədə bildirişlər — yalnız ayrıca marketinq razılığınız olduqda.',
      ] },
      { h: '5. Kim görür', list: [
        'Siz özünüz — "Hesabım" səhifəsində bütün məlumatlarınızı görür və yükləyə bilərsiniz.',
        'Oyunu keçirən təlimçi — öz oyunlarındakı iştirakçıların adını, cavablarını və nəticələrini görür.',
        'Digər iştirakçılar — oyun zamanı reytinqdə ad və xalınızı görür.',
        'Platformanın səlahiyyətli idarəçiləri — yalnız iş üçün lazım olan həcmdə, rol əsaslı giriş ilə.',
        'Xidmət təminatçıları (prosessorlar): Google LLC (Firebase Authentication, Cloud Firestore, Analytics) və Vercel Inc. (veb hostinq). Onlar məlumatları yalnız bizim tapşırığımızla emal edir.',
        'Məlumatlarınızı satmırıq və reklam məqsədilə üçüncü şəxslərə vermirik. Qanunla tələb olunduqda səlahiyyətli dövlət orqanlarına təqdim oluna bilər.',
      ] },
      { h: '6. Saxlama yeri və transsərhəd ötürmə', p: ['Məlumatlar Google Cloud-un Avropa İttifaqındakı məlumat mərkəzlərində (Firestore, eur3 regionu) saxlanılır. Bu, məlumatların Azərbaycan Respublikasının hüdudlarından kənara ötürülməsi deməkdir; ötürmə razılığınız əsasında və adekvat mühafizə səviyyəsini təmin edən təminatçı vasitəsilə həyata keçirilir. Əlaqə HTTPS (TLS) ilə şifrələnir.'] },
      { h: '7. Saxlama müddətləri', list: [
        'Hesab və qeydiyyat məlumatları — hesab silinənədək; 24 ay heç bir fəaliyyət olmadıqda hesab silinə bilər.',
        'Canlı oyun məlumatları — təlimçi silənədək; platforma köhnə oyunları təmizləmə vasitəsi təqdim edir.',
        'Məşq nəticələri — hesab silinənədək.',
        'Lisenziya müraciətləri və lisenziya qeydləri — mühasibat və hüquqi tələblər üçün 3 ilədək.',
        'Audit və xəta jurnalları — 12 ayadək.',
        'Razılıq qeydləri — razılığın sübutu kimi, hesab silinəndən sonra 3 ilədək (yalnız tarix və versiya).',
      ] },
      { h: '8. Hüquqlarınız', list: [
        'Məlumatlarınızla tanış olmaq və onların surətini almaq ("Hesabım" → "Məlumatlarımı yüklə").',
        'Yanlış məlumatları düzəltmək.',
        'Məlumatlarınızın silinməsini tələb etmək ("Hesabım" → "Hesabı sil").',
        'Razılığı istənilən vaxt geri götürmək (geri götürmə ondan əvvəlki emalın qanuniliyinə təsir etmir).',
        'Marketinq bildirişlərindən imtina etmək.',
        'Emala etiraz etmək və ya onun məhdudlaşdırılmasını tələb etmək.',
        `Müraciətlərə 30 gün ərzində cavab veririk: ${O.email}. Hüquqlarınızın pozulduğunu düşünürsünüzsə, qanunvericiliyə uyğun olaraq səlahiyyətli dövlət orqanına və ya məhkəməyə müraciət edə bilərsiniz.`,
      ] },
      { h: '9. Uşaqlar', p: ['16 yaşına çatmamış şəxslər qeydiyyatdan yalnız valideynin və ya qanuni nümayəndənin razılığı ilə keçə bilər. Məktəb və digər təhsil müəssisələri platformanı şagirdlərlə istifadə edərkən bu razılığın alınmasına cavabdehdir.'] },
      { h: '10. Brauzer yaddaşı və kukilər', p: ['Platforma reklam kukiləri istifadə etmir. Brauzerin yerli yaddaşında yalnız iş üçün zəruri məlumatlar saxlanılır (dil seçimi, giriş sessiyası, oyuna qayıtmaq üçün oyun identifikatoru). Firebase Analytics anonimləşdirilmiş istifadə statistikası toplayır.'] },
      { h: '11. Dəyişikliklər', p: ['Bu siyasət dəyişdikdə yeni versiya bu səhifədə dərc olunur. Əhəmiyyətli dəyişikliklərdə sizdən yenidən razılıq istənilir.'] },
    ],
  },
  {
    id: 'terms', title: 'İstifadə şərtləri',
    summary: 'Platformadan istifadə qaydaları, planlar, lisenziyalar və tərəflərin məsuliyyəti.',
    sections: [
      { h: '1. Ümumi müddəalar', p: [`Bu şərtlər Jabr platformasından (bundan sonra "Platforma") istifadəni tənzimləyir. Platformanın operatoru ${O.name}dur. Qeydiyyatdan keçməklə və ya Platformadan istifadə etməklə bu şərtləri qəbul edirsiniz.`] },
      { h: '2. Hesablar', list: [
        'Qeydiyyat Google hesabı ilə aparılır; komanda üzvlərinə hesab admin tərəfindən verilir.',
        'Verdiyiniz məlumatların doğruluğuna və hesabınızın təhlükəsizliyinə cavabdehsiniz.',
        'Bir şəxs bir hesabdan istifadə edir; sınaq müddətini uzatmaq məqsədilə çoxsaylı hesab açmaq qadağandır.',
        '16 yaşadək şəxslər yalnız valideyn razılığı ilə qeydiyyatdan keçə bilər.',
      ] },
      { h: '3. Planlar', list: [
        'Tələbə planı pulsuzdur: ictimai kataloqdakı quizlərdən limitsiz məşq və canlı oyunlara qoşulma.',
        'Təlimçi və müəssisə qeydiyyatdan sonra 3 günlük Pro sınaq alır — bütün funksiyalar, oyun başına 200 iştirakçıyadək.',
        'Sınaq bitdikdən sonra hesab pulsuz plana keçir: quiz yaratmaq və oyun keçirmək mümkündür, lakin bir oyunda maksimum 10 iştirakçı.',
        'Lisenziya (Təlimçi Pro, Müəssisə) Operatorla razılaşdırılmış müddət və şərtlərlə aktivləşdirilir; avtomatik yenilənmə yoxdur.',
        'Qiymətlər "Planlar və qiymətlər" səhifəsində və ya fərdi təklifdə göstərilir. Ödənişdən sonra lisenziya aktivləşdirilir; aktivləşdirilmiş lisenziya üzrə ödəniş, qanunla nəzərdə tutulmuş hallar istisna olmaqla, geri qaytarılmır.',
      ] },
      { h: '4. Qəbuledilməz istifadə', list: [
        'Qanunu pozan, təhqiredici, ayrı-seçkilik yaradan və ya başqalarının hüquqlarını pozan məzmun yerləşdirmək.',
        'Başqalarının fərdi məlumatlarını onların razılığı olmadan toplamaq və ya yaymaq.',
        'Platformanın təhlükəsizliyini pozmağa, məhdudiyyətlərdən yan keçməyə, avtomatik sorğularla yükləməyə cəhd etmək.',
        'Platformanı və ya onun məzmununu icazəsiz kopyalamaq, satmaq, əks mühəndislik etmək.',
      ] },
      { h: '5. Məzmun', list: [
        'Yaratdığınız quizlərin hüquqları sizə məxsusdur. Platformada saxlanması və göstərilməsi üçün Operatora qeyri-eksklüziv lisenziya verirsiniz.',
        'Quizi kataloqda dərc etdikdə onu bütün qeydiyyatlı istifadəçilərin məşq etməsinə razılıq verirsiniz; məşq zamanı düzgün cavablar göstərilir.',
        'Qaydaları pozan məzmun xəbərdarlıqsız silinə və hesab məhdudlaşdırıla bilər.',
      ] },
      { h: '6. Xidmətin mövcudluğu', p: ['Platforma "olduğu kimi" təqdim olunur. Fasiləsiz işləməsi üçün səy göstəririk, lakin texniki işlər, üçüncü tərəf xidmətlərindəki nasazlıqlar və internet bağlantısı səbəbindən fasilələr ola bilər. Canlı oyunun gedişi təlimçinin cihazından və bağlantısından asılıdır.'] },
      { h: '7. Məsuliyyətin məhdudlaşdırılması', p: ['Qanunun icazə verdiyi həddə Operator dolayı zərərə, əldən çıxmış mənfəətə və ya məlumat itkisinə görə məsuliyyət daşımır. Operatorun ümumi məsuliyyəti son 12 ayda Platforma üçün ödədiyiniz məbləğlə məhdudlaşır.'] },
      { h: '8. Xitam', p: ['Hesabınızı istənilən vaxt "Hesabım" səhifəsində silə bilərsiniz. Operator bu şərtləri pozan hesabı məhdudlaşdıra və ya bağlaya bilər.'] },
      { h: '9. Tətbiq olunan hüquq', p: ['Bu şərtlərə Azərbaycan Respublikasının qanunvericiliyi tətbiq olunur. Mübahisələr danışıqlar yolu ilə, razılıq əldə edilmədikdə Azərbaycan Respublikasının məhkəmələrində həll edilir.'] },
      { h: '10. Əlaqə', p: [`${O.email} · ${O.phone}`] },
    ],
  },
  {
    id: 'consent', title: 'Fərdi məlumatların emalına razılıq',
    summary: 'Qeydiyyat zamanı verdiyiniz razılığın tam mətni.',
    sections: [
      { h: 'Razılığın mətni', p: [`Mən, Jabr platformasında qeydiyyatdan keçməklə, "Fərdi məlumatlar haqqında" Azərbaycan Respublikası Qanununa uyğun olaraq ${O.name}na ("Operator") aşağıda göstərilən fərdi məlumatlarımın göstərilən məqsədlərlə toplanmasına, işlənməsinə, saxlanmasına və məhv edilməsinə azad, konkret və məlumatlı razılıq verirəm.`] },
      { h: 'Məlumatlar', list: ['ad, soyad, e-poçt, Google profil şəkli;', 'telefon nömrəsi, ölkə, şəhər;', 'peşə və ya təhsil məlumatları (sektor, vəzifə, təşkilat, təhsil müəssisəsi, ixtisas, səviyyə);', 'maraq sahələri, platformanı necə tapdığım;', 'platformadakı fəaliyyətim: quizlər, oyunlar, nəticələr, müraciətlər.'] },
      { h: 'Məqsədlər', list: ['hesabımın yaradılması və idarə olunması;', 'platformanın funksiyalarının (oyunlar, məşq, sertifikat, hesabat) göstərilməsi;', 'sınaq, plan və lisenziyaların idarə olunması, müraciətlərimə cavab verilməsi və mənimlə əlaqə saxlanılması;', 'xidmətin təhlükəsizliyi və təkmilləşdirilməsi.'] },
      { h: 'Saxlama və ötürmə', p: ['Məlumatlarımın Google Cloud-un Avropa İttifaqındakı serverlərində saxlanmasına (transsərhəd ötürməyə) və xidmət təminatçıları (Google LLC, Vercel Inc.) tərəfindən Operatorun tapşırığı ilə emal edilməsinə razıyam.'] },
      { h: 'Müddət və geri götürmə', p: ['Razılıq hesabım silinənədək qüvvədədir. Onu istənilən vaxt "Hesabım" səhifəsində hesabı silməklə və ya Operatora yazılı müraciətlə geri götürə bilərəm. Razılığı geri götürdükdə platformadan istifadə mümkün olmayacaq; geri götürmə ondan əvvəlki emalın qanuniliyinə təsir etmir.'] },
    ],
  },
  {
    id: 'marketing', title: 'Marketinq bildirişlərinə razılıq',
    summary: 'İstəyə bağlıdır — vermədikdə də platformadan tam istifadə edə bilərsiniz.',
    sections: [
      { h: 'Nəyə razılıq verirsiniz', p: ['Jabr platformasının yenilikləri, yeni ictimai quizlər, təlim tədbirləri, xüsusi təkliflər və endirimlər barədə mənə e-poçt, SMS, WhatsApp və ya telefon zəngi vasitəsilə məlumat göndərilməsinə razıyam.'] },
      { h: 'Tezlik', p: ['Ayda bir neçə dəfədən çox olmamaqla, yalnız faydalı məzmun.'] },
      { h: 'Geri götürmə', p: ['Razılığı istənilən vaxt "Hesabım" səhifəsində söndürə və ya istənilən mesaja "STOP" yazaraq imtina edə bilərsiniz. Xidmətlə bağlı zəruri bildirişlər (məs. sınağın və ya lisenziyanın bitməsi) bu razılıqdan asılı deyil.'] },
    ],
  },
]

const en: LegalDoc[] = [
  {
    id: 'privacy', title: 'Privacy Policy',
    summary: 'What data we collect, why, where it is stored and what your rights are.',
    sections: [
      { h: '1. Who we are', p: [`Jabr is a live quiz and training platform. The controller of your personal data is ${O.nameEn} ("Operator", "we"). Contact: ${O.email}, ${O.phone}.`, 'This policy follows the Law of the Republic of Azerbaijan "On Personal Data" and is based on the principles of the EU General Data Protection Regulation (GDPR).'] },
      { h: '2. Our principles', list: [
        'Lawfulness and transparency — we process data only with your consent or another legal basis, for a stated purpose.',
        'Purpose limitation — data is used only for the purposes described here.',
        'Data minimisation — we ask only what the service needs; non-essential fields are optional.',
        'Accuracy — you can update your data at any time on the "My account" page.',
        'Storage limitation — data is not kept longer than necessary (section 7).',
        'Integrity and confidentiality — access is limited by role on the server and all traffic is encrypted.',
        'Accountability — your consents are recorded with version and date; administrator actions are written to an audit log.',
      ] },
      { h: '3. Data we collect', list: [
        'Sign-up (with Google): first and last name, email, Google profile photo, phone number, country, city.',
        'Work/education details: for trainers sector, position, organisation, goal; for institutions type, name, size, number of trainers; for students education level, institution, field, year.',
        'Interests and how you heard about us (optional).',
        'Live game participants: the name you enter, avatar, answers, score and rank. Anonymous participants are not asked for email or phone.',
        'Practice results: quizzes taken, correct answers, score and time.',
        'License requests: name, phone, email, organisation, plan, notes.',
        'Technical data: sign-in time, browser type, error reports and anonymised usage statistics (Firebase Analytics).',
        'Consents: which document and version you agreed to, and when.',
      ] },
      { h: '4. Purposes and legal bases', list: [
        'Creating your account, sign-in and providing the platform — performance of contract and consent.',
        'Live games, results, certificates and reports — performance of contract.',
        'Managing trials, the free plan and licenses, answering requests — performance of contract.',
        'Security, abuse prevention, fixing errors — legitimate interest.',
        'Aggregated statistics to improve the service — legitimate interest.',
        'News and offers — only with your separate marketing consent.',
      ] },
      { h: '5. Who can see it', list: [
        'You — on "My account" you can view and download all your data.',
        'The trainer running a game — names, answers and results of participants in their own games.',
        'Other participants — your name and score on the in-game leaderboard.',
        'Authorised platform administrators — only as needed, with role-based access.',
        'Service providers (processors): Google LLC (Firebase Authentication, Cloud Firestore, Analytics) and Vercel Inc. (web hosting), acting only on our instructions.',
        'We do not sell your data or share it for advertising. It may be disclosed to competent authorities where required by law.',
      ] },
      { h: '6. Storage location and transfers', p: ['Data is stored in Google Cloud data centres in the European Union (Firestore, eur3 region). This means your data is transferred outside the Republic of Azerbaijan; the transfer is based on your consent and made through a provider ensuring an adequate level of protection. Traffic is encrypted with HTTPS (TLS).'] },
      { h: '7. Retention', list: [
        'Account and sign-up data — until the account is deleted; accounts inactive for 24 months may be deleted.',
        'Live game data — until the trainer deletes it; the platform offers a cleanup tool for old games.',
        'Practice results — until the account is deleted.',
        'License requests and license records — up to 3 years for accounting and legal requirements.',
        'Audit and error logs — up to 12 months.',
        'Consent records — up to 3 years after account deletion as proof of consent (date and version only).',
      ] },
      { h: '8. Your rights', list: [
        'Access your data and obtain a copy ("My account" → "Download my data").',
        'Rectify inaccurate data.',
        'Request deletion ("My account" → "Delete account").',
        'Withdraw consent at any time (this does not affect processing before withdrawal).',
        'Opt out of marketing.',
        'Object to or request restriction of processing.',
        `We reply within 30 days: ${O.email}. If you believe your rights were violated, you may complain to the competent public authority or court under applicable law.`,
      ] },
      { h: '9. Children', p: ['People under 16 may register only with the consent of a parent or legal guardian. Schools and other institutions using the platform with pupils are responsible for obtaining that consent.'] },
      { h: '10. Browser storage and cookies', p: ['We do not use advertising cookies. Only strictly necessary data is kept in local browser storage (language, sign-in session, the game identifier to rejoin a game). Firebase Analytics collects anonymised usage statistics.'] },
      { h: '11. Changes', p: ['When this policy changes the new version is published here. For material changes we ask for your consent again.'] },
    ],
  },
  {
    id: 'terms', title: 'Terms of Use',
    summary: 'Rules for using the platform, plans, licenses and liability.',
    sections: [
      { h: '1. General', p: [`These terms govern the use of the Jabr platform ("Platform"), operated by ${O.nameEn}. By signing up or using the Platform you accept these terms.`] },
      { h: '2. Accounts', list: ['Sign-up is with a Google account; team accounts are issued by an administrator.', 'You are responsible for the accuracy of your details and the security of your account.', 'One person uses one account; creating multiple accounts to extend the trial is prohibited.', 'People under 16 may register only with parental consent.'] },
      { h: '3. Plans', list: [
        'The Student plan is free: unlimited practice on public catalog quizzes and joining live games.',
        'Trainers and institutions get a 3-day Pro trial after sign-up — all features, up to 200 participants per game.',
        'After the trial the account moves to the free plan: creating quizzes and running games stays available, with at most 10 participants per game.',
        'Licenses (Trainer Pro, Institution) are activated for the period and terms agreed with the Operator; there is no automatic renewal.',
        'Prices are shown on the "Plans & pricing" page or in an individual offer. The license is activated after payment; payments for an activated license are non-refundable except where required by law.',
      ] },
      { h: '4. Unacceptable use', list: ['Posting unlawful, offensive or discriminatory content or content infringing others’ rights.', 'Collecting or sharing others’ personal data without their consent.', 'Attempting to breach security, bypass limits or overload the Platform with automated requests.', 'Copying, reselling or reverse-engineering the Platform or its content without permission.'] },
      { h: '5. Content', list: ['You own the quizzes you create and grant the Operator a non-exclusive license to store and display them on the Platform.', 'Publishing a quiz to the catalog lets every registered user practise it; correct answers are shown in practice.', 'Content breaching these rules may be removed without notice and the account restricted.'] },
      { h: '6. Availability', p: ['The Platform is provided "as is". We aim for uninterrupted operation, but maintenance, third-party outages and connectivity may cause interruptions. A live game depends on the trainer’s device and connection.'] },
      { h: '7. Limitation of liability', p: ['To the extent permitted by law the Operator is not liable for indirect damages, lost profits or data loss. The Operator’s total liability is limited to the amount you paid for the Platform in the last 12 months.'] },
      { h: '8. Termination', p: ['You can delete your account at any time on "My account". The Operator may restrict or close accounts that breach these terms.'] },
      { h: '9. Governing law', p: ['These terms are governed by the laws of the Republic of Azerbaijan. Disputes are settled by negotiation, failing which by the courts of the Republic of Azerbaijan.'] },
      { h: '10. Contact', p: [`${O.email} · ${O.phone}`] },
    ],
  },
  {
    id: 'consent', title: 'Consent to personal data processing',
    summary: 'The full text of the consent you give at sign-up.',
    sections: [
      { h: 'Consent text', p: [`By signing up to the Jabr platform I give ${O.nameEn} ("Operator") my free, specific and informed consent, under the Law of the Republic of Azerbaijan "On Personal Data", to collect, process, store and destroy the personal data listed below for the stated purposes.`] },
      { h: 'Data', list: ['first and last name, email, Google profile photo;', 'phone number, country, city;', 'work or education details (sector, position, organisation, institution, field, level);', 'interests and how I found the platform;', 'my activity on the platform: quizzes, games, results, requests.'] },
      { h: 'Purposes', list: ['creating and managing my account;', 'providing platform features (games, practice, certificates, reports);', 'managing trials, plans and licenses, answering my requests and contacting me;', 'security and improvement of the service.'] },
      { h: 'Storage and transfer', p: ['I agree that my data is stored on Google Cloud servers in the European Union (cross-border transfer) and processed by service providers (Google LLC, Vercel Inc.) on the Operator’s instructions.'] },
      { h: 'Duration and withdrawal', p: ['This consent is valid until my account is deleted. I can withdraw it at any time by deleting my account on "My account" or by writing to the Operator. Without this consent the platform cannot be used; withdrawal does not affect earlier processing.'] },
    ],
  },
  {
    id: 'marketing', title: 'Consent to marketing messages',
    summary: 'Optional — you can use the platform fully without it.',
    sections: [
      { h: 'What you agree to', p: ['I agree to receive news about the Jabr platform, new public quizzes, training events, special offers and discounts by email, SMS, WhatsApp or phone call.'] },
      { h: 'Frequency', p: ['No more than a few times a month, useful content only.'] },
      { h: 'Withdrawal', p: ['You can switch it off at any time on "My account" or reply "STOP" to any message. Essential service notices (e.g. trial or license expiry) do not depend on this consent.'] },
    ],
  },
]

export const LEGAL: Record<'az' | 'en', LegalDoc[]> = { az, en }
