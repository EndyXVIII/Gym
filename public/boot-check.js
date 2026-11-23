// If the app has not started after a few seconds, show why instead of a blank page.
(function () {
  var errors = [];
  function note(msg) {
    if (msg && errors.length < 5) errors.push(String(msg).slice(0, 200));
  }
  window.addEventListener(
    'error',
    function (e) {
      var t = e.target;
      if (t && t !== window && (t.src || t.href)) note('File non caricato: ' + (t.src || t.href));
      else note(e.message);
    },
    true,
  );
  window.addEventListener('unhandledrejection', function (e) {
    note(e.reason && e.reason.message ? e.reason.message : e.reason);
  });
  setTimeout(function () {
    var boot = document.getElementById('boot');
    if (!boot) return; // the app replaced it: all good
    boot.textContent = '';
    var title = document.createElement('p');
    title.textContent = "L'app non si è avviata.";
    title.style.cssText = 'font-weight:600;margin:0 0 8px';
    var hint = document.createElement('p');
    hint.textContent = 'Ricarica forzando la cache (Cmd+Shift+R). Se resta così, mandami questo testo:';
    hint.style.cssText = 'margin:0 0 8px';
    var detail = document.createElement('pre');
    detail.textContent = (errors.join('\n') || 'nessun errore registrato') + '\n' + navigator.userAgent;
    detail.style.cssText = 'white-space:pre-wrap;word-break:break-word;font-size:12px;margin:0';
    boot.appendChild(title);
    boot.appendChild(hint);
    boot.appendChild(detail);
  }, 6000);
})();
