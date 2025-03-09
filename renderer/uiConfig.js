const els = {
  text: document.getElementById('display-text'),
  fontSize: document.getElementById('font-size-slider'),
  fontColor: document.getElementById('font-color-selector'),
  bgColor: document.getElementById('bg-color-selector'),
  font: document.getElementById('font-selector'),
  align: document.getElementById('alignment-selector'),
  lineHeight: document.getElementById('line-height-slider'),
  indent: document.getElementById('indent-slider'),
  container: document.getElementById('interface-container'),
  drag: document.getElementById('drag-handle'),
  resize: document.querySelectorAll('.resize-handle'),
  menuBtn: document.getElementById('hamburger-menu'),
  menu: document.getElementById('options-menu'),
  hoverCheck: document.getElementById('hover-visibility')
};

const getDisplayName = (exeName) => exeName.replace(/\.exe$/i, '');

const interactiveSelectors = ['.hover-element', 'iframe.yomitan-popup'];

const state = {
  dragging: false,
  resizing: false,
  dir: '',
  x: 0, y: 0, left: 0, top: 0, width: 0, height: 0,
  hoverOn: false,
  listeners: new Set(),
  over: new Set()
};

let hoverInitialized = false;
let currentExeName = '';

const updateIndent = () => {
  const value = els.indent.value;
  if (els.text.textContent.startsWith('「')) {
    els.text.style.textIndent = `-${value}em`;
    els.text.style.paddingLeft = `calc(5px + ${value}em)`;
  } else {
    els.text.style.textIndent = '0';
    els.text.style.paddingLeft = '5px';
  }
};

const applyStyles = () => {
  const t = els.text.style;
  t.fontSize = `${els.fontSize.value}px`;
  t.color = els.fontColor.value;
  t.backgroundColor = els.bgColor.value;
  t.fontFamily = els.font.value;
  t.writingMode = 'horizontal-tb';
  t.textAlign = 'left';
  t.lineHeight = els.lineHeight.value;
  els.menu.style.color = els.fontColor.value;
  els.menu.style.backgroundColor = els.bgColor.value;
};
applyStyles();

els.fontSize.addEventListener('input', () => els.text.style.fontSize = `${els.fontSize.value}px`);
els.lineHeight.addEventListener('input', () => els.text.style.lineHeight = els.lineHeight.value);
els.indent.addEventListener('input', updateIndent);
els.fontColor.addEventListener('input', () => {
  els.text.style.color = els.fontColor.value;
  els.menu.style.color = els.fontColor.value;
});
els.bgColor.addEventListener('input', () => {
  els.text.style.backgroundColor = els.bgColor.value;
  els.menu.style.backgroundColor = els.bgColor.value;
});
els.font.addEventListener('change', () => els.text.style.fontFamily = els.font.value);
els.align.addEventListener('change', () => {
  els.text.style.writingMode = els.align.value === 'vertical' ? 'vertical-rl' : 'horizontal-tb';
  els.text.style.textAlign = els.align.value === 'vertical' ? 'left' : els.align.value;
});

updateIndent();

const getResizeDirection = (target) => {
  if (target.classList.contains('left-edge')) return 'left';
  if (target.classList.contains('right-edge')) return 'right';
  if (target.classList.contains('top-edge')) return 'top';
  if (target.classList.contains('bottom-edge')) return 'bottom';
  if (target.classList.contains('top-left-corner')) return 'topleft';
  if (target.classList.contains('top-right-corner')) return 'topright';
  if (target.classList.contains('bottom-left-corner')) return 'bottomleft';
  if (target.classList.contains('bottom-right-corner')) return 'bottomright';
  return '';
};

const dragResizeStart = (e, isDrag) => {
  if (isDrag) {
    state.dragging = true;
    state.dir = '';
  } else {
    state.resizing = true;
    state.dir = getResizeDirection(e.target);
    if (!state.dir) return;
  }
  state.x = e.clientX;
  state.y = e.clientY;
  state.left = els.container.offsetLeft;
  state.top = els.container.offsetTop;
  state.width = els.container.offsetWidth;
  state.height = els.container.offsetHeight;
  document.body.style.cursor = isDrag ? 'move' : getCursorForDirection(state.dir);
  els.menu.style.display = 'none';
  state.over.delete(els.menu);
  if (state.hoverOn && !state.over.size) hideHover();
};

const getCursorForDirection = (dir) => {
  switch (dir) {
    case 'top': return 'n-resize';
    case 'bottom': return 's-resize';
    case 'left': return 'w-resize';
    case 'right': return 'e-resize';
    case 'topleft': return 'nw-resize';
    case 'topright': return 'ne-resize';
    case 'bottomleft': return 'sw-resize';
    case 'bottomright': return 'se-resize';
    default: return 'default';
  }
};

els.drag.addEventListener('mousedown', (e) => dragResizeStart(e, true));
els.resize.forEach((h) => h.addEventListener('mousedown', (e) => dragResizeStart(e, false)));

document.addEventListener('mousemove', (e) => {
  const { dragging, resizing, x, y, dir } = state;
  if (!(dragging || resizing)) return;
  const dx = e.clientX - x,
    dy = e.clientY - y;
  const s = els.container.style;

  if (dragging) {
    s.left = `${state.left + dx}px`;
    s.top = `${state.top + dy}px`;
  } else if (resizing) {
    if (dir.includes('right')) s.width = `${Math.max(100, state.width + dx)}px`;
    if (dir.includes('bottom')) s.height = `${Math.max(100, state.height + dy)}px`;
    if (dir.includes('left')) {
      s.width = `${Math.max(100, state.width - dx)}px`;
      s.left = `${state.left + dx}px`;
    }
    if (dir.includes('top')) {
      s.height = `${Math.max(100, state.height - dy)}px`;
      s.top = `${state.top + dy}px`;
    }
  }
});

document.addEventListener('mouseup', () => {
  state.dragging = state.resizing = false;
  document.body.style.cursor = 'default';
});

const getHoverEls = () => document.querySelectorAll(interactiveSelectors.join(','));

const showHover = () => getHoverEls().forEach((e) => { if (e.style.display !== 'none') e.style.opacity = '1'; });
const hideHover = () => getHoverEls().forEach((e) => { if (e.style.display !== 'none') e.style.opacity = '0'; });

const onEnter = (e) => {
  state.over.add(e.currentTarget);
  if (state.hoverOn) showHover();
  hoverInitialized = true;
};

const onLeave = (e) => {
  state.over.delete(e.currentTarget);
  if (state.hoverOn && !state.over.size) hideHover();
  hoverInitialized = true;
};

const attachHover = (el) => {
  if (!state.listeners.has(el)) {
    el.addEventListener('mouseenter', onEnter);
    el.addEventListener('mouseleave', onLeave);
    state.listeners.add(el);
  }
};

getHoverEls().forEach(attachHover);

els.hoverCheck.addEventListener('change', () => {
  state.hoverOn = els.hoverCheck.checked;
  if (state.hoverOn) {
    if (state.over.size === 0 && hoverInitialized) {
      hideHover();
    }
  } else {
    showHover();
  }
});

els.menuBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  const m = els.menu.style;
  if (m.display === 'block') {
    m.display = 'none';
    state.over.delete(els.menu);
    if (state.hoverOn && !state.over.size) hideHover();
  } else {
    const r = els.container.getBoundingClientRect();
    const w = 200,
      h = 300;
    let left = r.right;
    if (left + w > window.innerWidth) left = Math.max(0, r.left - w);
    let top = r.bottom - h;
    if (top < 0) top = 0;
    m.left = `${left}px`;
    m.top = `${top}px`;
    m.display = 'block';
    m.opacity = '1';
  }
});

document.addEventListener('click', (e) => {
  if (!els.menu.contains(e.target) && e.target !== els.menuBtn) {
    els.menu.style.display = 'none';
    state.over.delete(els.menu);
    if (state.hoverOn && !state.over.size) hideHover();
  }
});

els.menu.addEventListener('click', (e) => e.stopPropagation());

const observeDOM = (mutations) => {
  mutations.forEach((m) => {
    if (m.type !== 'childList') return;
    m.addedNodes.forEach((n) => {
      if (n.nodeType !== Node.ELEMENT_NODE) return;
      interactiveSelectors.forEach((sel) => {
        if (n.matches(sel)) attachHover(n);
        n.querySelectorAll(sel).forEach(attachHover);
      });
    });
  });
};
new MutationObserver(observeDOM).observe(document.body, { childList: true, subtree: true });

document.getElementById('save-config-btn').addEventListener('click', () => {
  if (!currentExeName) {
    alert('No executable selected. Please select a process first.');
    return;
  }
  const configData = {
    fontSize: els.fontSize.value,
    fontColor: els.fontColor.value,
    bgColor: els.bgColor.value,
    font: els.font.value,
    align: els.align.value,
    lineHeight: els.lineHeight.value,
    hoverVisibility: els.hoverCheck.checked,
    position: {
      x: els.container.style.left,
      y: els.container.style.top,
      width: els.container.style.width,
      height: els.container.style.height
    },
    indent: els.indent.value
  };
  window.ipc.saveConfiguration(currentExeName, configData);
});

function loadConfiguration(configData) {
  if (!configData) return;

  els.fontSize.value = configData.fontSize || 16;
  els.fontSize.dispatchEvent(new Event('input'));

  els.lineHeight.value = configData.lineHeight || 1.5;
  els.lineHeight.dispatchEvent(new Event('input'));

  els.fontColor.value = configData.fontColor || '#000000';
  els.fontColor.dispatchEvent(new Event('input'));

  els.bgColor.value = configData.bgColor || '#ffffff';
  els.bgColor.dispatchEvent(new Event('input'));

  els.font.value = configData.font || 'Arial';
  els.font.dispatchEvent(new Event('change'));

  els.align.value = configData.align || 'left';
  els.align.dispatchEvent(new Event('change'));

  els.hoverCheck.checked = configData.hoverVisibility || false;
  els.hoverCheck.dispatchEvent(new Event('change'));

  if (configData.position) {
    els.container.style.left = configData.position.x || '100px';
    els.container.style.top = configData.position.y || '100px';
    els.container.style.width = configData.position.width || '300px';
    els.container.style.height = configData.position.height || '200px';
    els.container.offsetWidth;
  }

  els.indent.value = configData.indent || 1;
  els.indent.dispatchEvent(new Event('input'));

  showHover();
}

window.ipc.onUpdateText((data) => {
  els.text.innerHTML = data.text;
  els.drag.innerHTML = getDisplayName(data.exeName);
  updateIndent();

  if (data.exeName !== currentExeName) {
    currentExeName = data.exeName;
    window.ipc.getConfiguration(currentExeName).then((configData) => {
      loadConfiguration(configData);
    });
  }
});

if (currentExeName) {
  window.ipc.getConfiguration(currentExeName).then((configData) => {
    loadConfiguration(configData);
  });
}