import { refreshSelectedThreadOutput } from './threadSelection.js';
import { regexReplacement, regexFiltering, deleteDuplicateLines, deleteDuplicateLetters, deleteFurigana } from './utils.js';
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
      case 'removeFurigana':
        return removeFurigana(currentText);
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
    li.dataset.index = index;

    let content = utility.type;
    if (utility.type === 'regexReplacement') {
      const patternInput = document.createElement('input');
      patternInput.type = 'text';
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
      patternInput.value = utility.params.pattern || '';
      patternInput.placeholder = 'Regex pattern';
      patternInput.addEventListener('input', () => {
        updateUtilityParams(index, { pattern: patternInput.value });
      });
      li.appendChild(patternInput);
    }

    li.insertBefore(document.createTextNode(content + ' '), li.firstChild);

    const removeButton = document.createElement('button');
    removeButton.textContent = 'Remove';
    removeButton.addEventListener('click', () => removeUtility(index));
    li.appendChild(removeButton);

    utilityChainList.appendChild(li);
  });

  new Sortable(utilityChainList, {
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
const utilityParamsDiv = document.getElementById('utility-params');
const addUtilityButton = document.getElementById('add-utility');

utilitySelect.addEventListener('change', () => {
  const selectedUtility = utilitySelect.value;
  utilityParamsDiv.innerHTML = '';
  if (selectedUtility === 'regexReplacement') {
    utilityParamsDiv.innerHTML = `
      <input type="text" id="pattern" placeholder="Regex pattern (e.g., /error/i)">
      <input type="text" id="replacement" placeholder="Replacement string (e.g., [ERROR])">
    `;
  } else if (selectedUtility === 'regexFiltering') {
    utilityParamsDiv.innerHTML = `
      <input type="text" id="pattern" placeholder="Regex pattern (e.g., /warning/i)">
    `;
  }
});

addUtilityButton.addEventListener('click', () => {
  const selectedUtility = utilitySelect.value;
  let params = {};
  if (selectedUtility === 'regexReplacement') {
    params.pattern = document.getElementById('pattern').value;
    params.replacement = document.getElementById('replacement').value;
  } else if (selectedUtility === 'regexFiltering') {
    params.pattern = document.getElementById('pattern').value;
  }
  addUtility(selectedUtility, params);
});