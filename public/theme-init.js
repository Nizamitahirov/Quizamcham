// İlk rəsmdən əvvəl rəng rejimi (CSP: inline skript qadağandır — ayrıca fayl). Standart — tünd.
try { if (localStorage.getItem('jabr.theme') === 'light') document.documentElement.dataset.theme = 'light' } catch (e) { /* noop */ }

// Oyunçu əlçatanlığı (src/lib/a11y.ts ilə eyni açar): şrift, böyük mətn, kontrast — ilk rəsmdən əvvəl
try {
  var a = JSON.parse(localStorage.getItem('jabr.a11y') || 'null')
  if (a) {
    var el = document.documentElement
    if (a.font && a.font !== 'default') el.dataset.a11yFont = a.font
    if (a.large) el.setAttribute('data-a11y-large', '')
    if (a.contrast) el.setAttribute('data-a11y-contrast', '')
  }
} catch (e) { /* noop */ }
