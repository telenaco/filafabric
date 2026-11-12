// Apply the same browser preference to the studio and its source offer.
(() => {
  const key = 'filafabric:theme';
  const themes = new Set(['atelier', 'machine', 'material']);
  const system = matchMedia('(prefers-color-scheme: dark)');
  const root = document.documentElement;
  let choice = 'system';
  try {
    const saved = localStorage.getItem(key);
    if (themes.has(saved)) choice = saved;
  } catch { /* the selection can still be used for this visit */ }

  function apply() {
    const theme = choice === 'system' ? (system.matches ? 'machine' : 'atelier') : choice;
    if (root.dataset.theme === theme) return;
    root.dataset.theme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content',
      { atelier: '#f5f3f8', machine: '#171c20', material: '#f0ede5' }[theme]);
    document.dispatchEvent(new Event('filafabric:themechange'));
  }

  apply();
  system.addEventListener('change', apply);
  document.addEventListener('DOMContentLoaded', () => {
    const picker = document.getElementById('theme-choice');
    if (!picker) return;
    picker.value = choice;
    picker.addEventListener('change', () => {
      choice = themes.has(picker.value) ? picker.value : 'system';
      try { localStorage.setItem(key, choice); } catch { /* keep the selection for this visit */ }
      apply();
    });
  });
})();
