// Apply the saved theme before the first paint (no flash of the wrong theme).
try {
  var t = localStorage.getItem('scheda:theme');
  if (t === 'light' || t === 'dark') document.documentElement.dataset.theme = t;
} catch (e) {}
