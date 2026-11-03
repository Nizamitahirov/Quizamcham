export function buildAiPrompt(topic: string, count: number, level: string) {
  return `Sən təlim üçün quiz hazırlayan köməkçisən. "${topic || 'Süni intellekt'}" mövzusunda azərbaycan dilində ${count} sual hazırla. Səviyyə: ${level}.
Qaydalar:
- Sual tipləri qarışıq olsun: əsasən "single" (4 variant, 1 düzgün), bir neçə "truefalse", 1–2 "multi" (bir neçə düzgün), 1 "type" (qısa yazılı cavab), istəsən 1 "poll".
- Sual mətni ≤ 200 simvol, variant ≤ 90 simvol, "explanation" ≤ 300 simvol (qısa və öyrədici).
- "timeLimit": 15–45 saniyə. "points": "standard" (vacib suallarda "double").
- Yalnız JSON qaytar, başqa mətn yazma.

Format:
{
  "title": "…",
  "description": "…",
  "coverEmoji": "🤖",
  "settings": { "defaultTime": 30 },
  "questions": [
    { "type": "single", "text": "…", "timeLimit": 30, "points": "standard",
      "options": [{"id":"a","text":"…"},{"id":"b","text":"…"},{"id":"c","text":"…"},{"id":"d","text":"…"}],
      "correct": ["a"], "explanation": "…" },
    { "type": "truefalse", "text": "…", "timeLimit": 15, "points": "standard",
      "options": [{"id":"t","text":"Doğru"},{"id":"f","text":"Yanlış"}], "correct": ["t"], "explanation": "…" },
    { "type": "type", "text": "…", "timeLimit": 30, "points": "standard", "accepted": ["…","…"], "correct": [], "explanation": "…" }
  ]
}`
}
