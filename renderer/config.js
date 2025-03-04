const displayTextElement = document.getElementById('display-text');
window.ipc.onUpdateText((text) => {
  displayTextElement.innerHTML = text;
});

document.addEventListener('DOMContentLoaded', () => {
  // Styles
  const fontSizeSlider = document.getElementById('font-size-slider');
  const fontColorSelector = document.getElementById('font-color-selector');
  const bgColorSelector = document.getElementById('bg-color-selector');
  const fontSelector = document.getElementById('font-selector');
  const alignmentSelector = document.getElementById('alignment-selector');

  fontSizeSlider.addEventListener('input', () => {
    displayTextElement.style.fontSize = `${fontSizeSlider.value}px`;
  });

  fontColorSelector.addEventListener('input', () => {
    displayTextElement.style.color = fontColorSelector.value;
    toolbar.style.color = fontColorSelector.value;
  });

  bgColorSelector.addEventListener('input', () => {
    displayTextElement.style.backgroundColor = bgColorSelector.value;
    toolbar.style.backgroundColor = bgColorSelector.value;
  });

  fontSelector.addEventListener('change', () => {
    displayTextElement.style.fontFamily = fontSelector.value;
  });

  alignmentSelector.addEventListener('change', () => {
    if (alignmentSelector.value === 'vertical') {
      displayTextElement.style.writingMode = 'vertical-rl';
      displayTextElement.style.textAlign = 'left';
    } else {
      displayTextElement.style.writingMode = 'horizontal-tb';
      displayTextElement.style.textAlign = alignmentSelector.value;
    }
  });

  displayTextElement.style.fontSize = `${fontSizeSlider.value}px`;
  displayTextElement.style.color = fontColorSelector.value;
  displayTextElement.style.backgroundColor = bgColorSelector.value;
  displayTextElement.style.fontFamily = fontSelector.value;
  displayTextElement.style.writingMode = 'horizontal-tb';
  displayTextElement.style.textAlign = 'left';


  // Dragging & resizing

  const interfaceContainer = document.getElementById('interface-container');
  const dragHandle = document.getElementById('drag-handle');
  const resizeHandles = document.querySelectorAll('.resize-handle');
  const hamburgerMenu = document.getElementById('hamburger-menu');
  const optionsMenu = document.getElementById('options-menu');

  let isDragging = false;
  let isResizing = false;
  let resizeDirection = '';
  let startX, startY, startLeft, startTop, startWidth, startHeight;

  dragHandle.addEventListener('mousedown', (e) => {
    isDragging = true;
    startX = e.clientX;
    startY = e.clientY;
    startLeft = interfaceContainer.offsetLeft;
    startTop = interfaceContainer.offsetTop;
    document.body.style.cursor = 'move';
    optionsMenu.style.display = 'none';
  });

  document.addEventListener('mousemove', (e) => {
    if (isDragging) {
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      interfaceContainer.style.left = `${startLeft + dx}px`;
      interfaceContainer.style.top = `${startTop + dy}px`;
    } else if (isResizing) {
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      if (resizeDirection.includes('right')) {
        interfaceContainer.style.width = `${startWidth + dx}px`;
      }
      if (resizeDirection.includes('bottom')) {
        interfaceContainer.style.height = `${startHeight + dy}px`;
      }
      if (resizeDirection.includes('left')) {
        interfaceContainer.style.width = `${startWidth - dx}px`;
        interfaceContainer.style.left = `${startLeft + dx}px`;
      }
      if (resizeDirection.includes('top')) {
        interfaceContainer.style.height = `${startHeight - dy}px`;
        interfaceContainer.style.top = `${startTop + dy}px`;
      }
    }
  });

  document.addEventListener('mouseup', () => {
    isDragging = false;
    isResizing = false;
    document.body.style.cursor = 'default';
  });

  resizeHandles.forEach((handle) => {
    handle.addEventListener('mousedown', (e) => {
      isResizing = true;
      resizeDirection = handle.className.split(' ')[1];
      startX = e.clientX;
      startY = e.clientY;
      startWidth = interfaceContainer.offsetWidth;
      startHeight = interfaceContainer.offsetHeight;
      startLeft = interfaceContainer.offsetLeft;
      startTop = interfaceContainer.offsetTop;
      document.body.style.cursor = handle.style.cursor;
      optionsMenu.style.display = 'none';
    });
  });

  hamburgerMenu.addEventListener('click', (e) => {
    e.stopPropagation();
    if (optionsMenu.style.display === 'block') {
      optionsMenu.style.display = 'none';
    } else {
      const containerRect = interfaceContainer.getBoundingClientRect();
      const menuWidth = 200;
      const menuHeight = 300;
      let menuLeft = containerRect.right;
      if (menuLeft + menuWidth > window.innerWidth) {
        menuLeft = containerRect.left - menuWidth;
        if (menuLeft < 0) menuLeft = 0;
      }
      let menuTop = containerRect.bottom - menuHeight;
      if (menuTop < 0) menuTop = 0;
      optionsMenu.style.left = `${menuLeft}px`;
      optionsMenu.style.top = `${menuTop}px`;
      optionsMenu.style.display = 'block';
    }
    updateShape();
  });

  document.addEventListener('click', (e) => {
    if (!optionsMenu.contains(e.target) && e.target !== hamburgerMenu) {
      optionsMenu.style.display = 'none';
      updateShape();
    }
  });

  optionsMenu.addEventListener('click', (e) => {
    e.stopPropagation();
  });
});