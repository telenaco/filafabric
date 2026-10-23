// One editable box for choosing a known profile. Typing never changes the selection until an option is chosen.
export function searchProfileNames(entries, query) {
  const words = String(query).toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  return entries.filter(p => words.every(word => p.name.toLowerCase().includes(word)))
    .sort((a, b) => a.name.localeCompare(b.name, 'en', { numeric: true, sensitivity: 'base' }));
}

export function createProfilePicker(root, { entries, selected, choose, search = searchProfileNames, meta = () => '', empty }) {
  const input = root.querySelector('input');
  const toggle = root.querySelector('.profile-toggle');
  const list = root.querySelector('[role="listbox"]');
  const status = root.querySelector('[role="status"]');
  let query = '', matches = [], active = -1, busy = false;
  const isOpen = () => !list.hidden;
  const showSelected = () => { input.value = entries().find(p => p.id === selected())?.name ?? ''; };
  const close = () => {
    list.hidden = true;
    status.hidden = true;
    input.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-expanded', 'false');
    input.removeAttribute('aria-activedescendant');
    query = '';
    active = -1;
    showSelected();
  };
  const highlight = (index) => {
    active = index;
    [...list.children].forEach((option, i) => option.classList.toggle('active', i === active));
    const option = list.children[active];
    if (option) {
      input.setAttribute('aria-activedescendant', option.id);
      option.scrollIntoView({ block: 'nearest' });
    } else input.removeAttribute('aria-activedescendant');
  };
  const render = () => {
    matches = search(entries(), query);
    active = -1;
    input.removeAttribute('aria-activedescendant');
    list.replaceChildren(...matches.map((entry, index) => {
      const option = document.createElement('div');
      option.id = `${list.id}-option-${index}`;
      option.className = 'profile-option';
      option.setAttribute('role', 'option');
      option.setAttribute('aria-selected', String(entry.id === selected()));
      const name = document.createElement('span');
      name.className = 'profile-name';
      name.textContent = entry.name;
      option.append(name);
      const detail = meta(entry);
      if (detail) {
        const sub = document.createElement('span');
        sub.className = 'profile-meta';
        sub.textContent = detail;
        option.append(sub);
      }
      option.addEventListener('pointerdown', e => e.preventDefault());
      option.addEventListener('click', () => void select(index));
      return option;
    }));
    list.scrollTop = 0;
    status.textContent = matches.length ? `${matches.length} ${matches.length === 1 ? 'match' : 'matches'}` : empty;
    status.hidden = false;
  };
  const open = () => {
    if (busy) return;
    list.hidden = false;
    input.setAttribute('aria-expanded', 'true');
    toggle.setAttribute('aria-expanded', 'true');
    render();
  };
  const select = async (index) => {
    const entry = matches[index];
    if (!entry || busy) return;
    busy = true;
    input.setAttribute('aria-busy', 'true');
    try { await choose(entry.id); }
    finally {
      busy = false;
      input.removeAttribute('aria-busy');
      close();
      input.focus();
    }
  };
  input.addEventListener('focus', () => input.select());
  input.addEventListener('click', () => { if (!isOpen()) { query = ''; open(); input.select(); } });
  input.addEventListener('input', () => { query = input.value; open(); });
  input.addEventListener('keydown', e => {
    if (busy && ['ArrowDown', 'ArrowUp', 'Enter'].includes(e.key)) { e.preventDefault(); return; }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!isOpen()) open();
      highlight(e.key === 'ArrowDown' ? Math.min(matches.length - 1, active + 1) : active < 0 ? matches.length - 1 : Math.max(0, active - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (isOpen()) void select(active < 0 ? 0 : active);
    } else if (e.key === 'Escape' && isOpen()) {
      e.preventDefault();
      e.stopPropagation();
      close();
    } else if (e.key === 'Tab') close();
  });
  toggle.addEventListener('click', () => {
    if (isOpen()) close();
    else { query = ''; open(); }
    input.focus();
    input.select();
  });
  root.addEventListener('focusout', e => { if (!root.contains(e.relatedTarget)) close(); });
  document.addEventListener('pointerdown', e => { if (!root.contains(e.target) && isOpen()) close(); });
  root.closest('dialog')?.addEventListener('close', close);
  close();
  return { refresh: close };
}
