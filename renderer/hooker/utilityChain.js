import { refreshSelectedThreadOutput } from './threadSelection.js';
import { regexReplacement, regexFiltering, deleteDuplicateLines, deleteDuplicateLetters, removeFurigana, removeSpeaker } from './utils.js';
import Sortable from './sortable.complete.esm.js';

export let utilityChain = [];

export function clearUtilityChain() {
  utilityChain = [];
  renderUtilityChain();
}

export function setUtilityChain(newChain) {
  utilityChain = newChain || [];
  renderUtilityChain();
}

export function addUtility(type, params = {}) {
  utilityChain.push({ type, params });
  renderUtilityChain();
  refreshSelectedThreadOutput();
}

export function removeUtility(index) {
  utilityChain.splice(index, 1);
  renderUtilityChain();
  refreshSelectedThreadOutput();
}

export function updateUtilityParams(index, params) {
  utilityChain[index].params = params;
  refreshSelectedThreadOutput();
}

export function applyUtilityChain(text) {
  return utilityChain.reduce((currentText, utility) => {
    switch (utility.type) {
      case 'regexReplacement':
        return regexReplacement(currentText, utility.params.pattern, utility.params.replacement);
      case 'regexFiltering':
        return regexFiltering(currentText, utility.params.pattern);
      case 'deleteDuplicateLines':
        return deleteDuplicateLines(currentText);
      case 'deleteDuplicateLetters':
        return deleteDuplicateLetters(currentText);
      case 'removeSpeaker':
        return removeSpeaker(currentText);
      default:
        return currentText;
    }
  }, text);
}

function renderUtilityChain() {
  const utilityChainList = document.getElementById('utility-chain');
  utilityChainList.innerHTML = '';
  
  utilityChain.forEach((utility, index) => {
    const li = document.createElement('li');
    li.className = 'list-row';
    li.dataset.index = index;

    let content = utility.type;
    if (utility.type === 'regexReplacement') {
      const patternInput = document.createElement('input');
      patternInput.type = 'text';
      patternInput.classList.add('input', 'min-w-50');
      patternInput.value = utility.params.pattern || '';
      patternInput.placeholder = 'Regex pattern';
      patternInput.addEventListener('input', () => {
        updateUtilityParams(index, {
          pattern: patternInput.value,
          replacement: replacementInput.value
        });
      });

      const replacementInput = document.createElement('input');
      replacementInput.type = 'text';
      replacementInput.classList.add('input', 'min-w-50');
      replacementInput.value = utility.params.replacement || '';
      replacementInput.placeholder = 'Replacement';
      replacementInput.addEventListener('input', () => {
        updateUtilityParams(index, {
          pattern: patternInput.value,
          replacement: replacementInput.value
        });
      });

      li.appendChild(patternInput);
      li.appendChild(replacementInput);
    } else if (utility.type === 'regexFiltering') {
      const patternInput = document.createElement('input');
      patternInput.type = 'text';
      patternInput.classList.add('input', 'min-w-50');
      patternInput.value = utility.params.pattern || '';
      patternInput.placeholder = 'Regex pattern';
      patternInput.addEventListener('input', () => {
        updateUtilityParams(index, { pattern: patternInput.value });
      });
      li.appendChild(patternInput);
    }
    const utilityName = document.createElement('p');
    utilityName.classList.add('text-nowrap');
    utilityName.innerHTML = content;

    li.insertBefore(utilityName, li.firstChild);
    
    const dragHandle = document.createElement('p');
    dragHandle.classList.add('handle', 'select-none', 'text-2xl', 'text-neutral-content', 'mx-4');
    dragHandle.innerHTML = '⁝⁝';

    li.insertBefore(dragHandle, li.firstChild);

    const removeButton = document.createElement('button');
    removeButton.classList.add('btn', 'btn-outline', 'btn-error', 'float-right', 'text-2xl');
    removeButton.textContent = '×';
    removeButton.addEventListener('click', () => removeUtility(index));

    const buttonDiv = document.createElement('div');
    buttonDiv.classList.add('list-col-grow');
    buttonDiv.appendChild(removeButton)
    li.appendChild(buttonDiv);

    li.classList.add('items-center');

    utilityChainList.appendChild(li);
  });

  new Sortable(utilityChainList, {
    handle: '.handle',
    animation: 150,
    onEnd: (evt) => {
      const fromIndex = evt.oldIndex;
      const toIndex = evt.newIndex;
      const [utility] = utilityChain.splice(fromIndex, 1);
      utilityChain.splice(toIndex, 0, utility);
      renderUtilityChain();
      refreshSelectedThreadOutput();
    }
  });
}

const utilitySelect = document.getElementById('utility-select');

utilitySelect.addEventListener('change', () => {
  const selectedUtility = utilitySelect.value;
  if (selectedUtility) {
    addUtility(selectedUtility, {});
    utilitySelect.selectedIndex = 0;
  }
});