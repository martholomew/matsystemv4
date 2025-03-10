const ipc = window.ipc;

const interactiveSelectors = ['.hover-element', 'iframe.yomitan-popup'];

const state = {
  interacting: false,
  updating: false,
  iframes: new Map(),
  timer: null
};

const getBound = el => {
  const r = el.getBoundingClientRect();
  const s = getComputedStyle(el);
  return r.width > 0 && r.height > 0 && s.visibility === 'visible'
    ? { x: r.left, y: r.top, width: r.width, height: r.height }
    : null;
};

const getBounds = () => Array.from(document.querySelectorAll(interactiveSelectors.join(',')))
  .map(getBound).filter(Boolean);

const sendBounds = () => ipc.sendBounds(getBounds());

const updateBounds = () => {
  if (!state.interacting) {
    if (!state.updating) {
      ipc.sendBounds('full');
      state.updating = true;
    }
    clearTimeout(state.timer);
    state.timer = setTimeout(() => {
      if (!state.interacting) {
        sendBounds();
        state.updating = false;
      }
    }, 200);
  }
};

const startInteract = () => {
  state.interacting = true;
  ipc.sendBounds('full');
};

const endInteract = () => {
  state.interacting = false;
  sendBounds();
};

document.getElementById('drag-handle').addEventListener('mousedown', startInteract);
document.querySelectorAll('.resize-handle').forEach(h => h.addEventListener('mousedown', startInteract));
window.addEventListener('mouseup', endInteract);

const observeDOM = mutations => {
  mutations.forEach(m => {
    if (m.type !== 'childList') return;
    m.addedNodes.forEach(n => {
      if (n.nodeType === Node.ELEMENT_NODE && n.matches('iframe.yomitan-popup')) {
        const obs = new MutationObserver(updateBounds);
        obs.observe(n, { attributes: true, attributeFilter: ['style'] });
        state.iframes.set(n, obs);
        if (!state.interacting) updateBounds();
      }
    });
    m.removedNodes.forEach(n => {
      if (n.nodeType === Node.ELEMENT_NODE && n.matches('iframe.yomitan-popup') && state.iframes.has(n)) {
        state.iframes.get(n).disconnect();
        state.iframes.delete(n);
        if (!state.interacting) sendBounds();
      }
    });
  });
};
new MutationObserver(observeDOM).observe(document.body, { childList: true, subtree: true });

const optionsMenu = document.getElementById('options-menu');
if (optionsMenu) new MutationObserver(() => !state.interacting && updateBounds())
  .observe(optionsMenu, { attributes: true, attributeFilter: ['style'] });

sendBounds();
window.addEventListener('resize', () => !state.interacting && updateBounds());