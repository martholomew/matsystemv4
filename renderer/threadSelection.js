import { applyUtilityChain } from './utilityChain.js';
import { updateThreadSection } from './threadOutputs.js';
import { setUtilityChain } from './utilityChain.js';

const threadListElement = document.getElementById('thread-list');
const selectedThreadOutputElement = document.getElementById('selected-thread-output');

let threadOutputs = {};
export let selectedThreadId = null;
let savedConfig = null;

window.ipc.onConfigurationLoaded((config) => {
  savedConfig = config;
  if (config) {
    setUtilityChain(config.utilityChain);
  }
});

export function resetThreadSelection() {
  threadListElement.innerHTML = '';
  document.getElementById('thread-outputs').innerHTML = '';
  threadOutputs = {};
  selectedThreadId = null;
  selectedThreadOutputElement.innerHTML = '';
  savedConfig = null;
}

function applySavedConfiguration() {
  if (savedConfig && savedConfig.selectedThreadId) {
    const checkbox = document.querySelector(`input[value="${savedConfig.selectedThreadId}"]`);
    if (checkbox) {
      document.querySelectorAll('#thread-list input[type="checkbox"]').forEach((cb) => {
        cb.checked = false;
      });
      checkbox.checked = true;
      selectedThreadId = savedConfig.selectedThreadId;
      displaySelectedThreadOutput();
    }
  }
}

function createThreadList(threadIds) {
  threadListElement.innerHTML = '';
  threadIds.forEach((threadId) => {
    if (threadId !== '0') {
      const listItem = document.createElement('li');
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.value = threadId;
      checkbox.addEventListener('change', (event) => {
        if (event.target.checked) {
          document.querySelectorAll('#thread-list input[type="checkbox"]').forEach((cb) => {
            if (cb !== checkbox) cb.checked = false;
          });
          selectedThreadId = threadId;
          displaySelectedThreadOutput();
        } else {
          selectedThreadId = null;
          selectedThreadOutputElement.innerHTML = '';
        }
      });
      listItem.appendChild(checkbox);
      listItem.appendChild(document.createTextNode(` Thread ID: ${threadId}`));
      threadListElement.appendChild(listItem);
    }
  });
  applySavedConfiguration();
}

function displaySelectedThreadOutput() {
  if (!selectedThreadId) {
    selectedThreadOutputElement.innerHTML = '';
    window.ipc.sendText('');
    return;
  }
  let latestOutput = threadOutputs[selectedThreadId];
  if (!latestOutput) {
    selectedThreadOutputElement.innerHTML = '<p>No output yet for this thread.</p>';
    window.ipc.sendText('<p>No output yet for this thread.</p>');
    return;
  }

  latestOutput = applyUtilityChain(latestOutput);
  const formattedOutput = `<p>${latestOutput}</p>`;
  selectedThreadOutputElement.innerHTML = formattedOutput;
  window.ipc.sendText(formattedOutput);
}

export function refreshSelectedThreadOutput() {
  displaySelectedThreadOutput();
}

window.ipc.onLunahostThread((output) => {
  const threadId = output.threadId;
  if (threadId === '0') return;

  threadOutputs[threadId] = output.output;

  if (!document.querySelector(`input[value="${threadId}"]`)) {
    createThreadList(Object.keys(threadOutputs));
  }

  if (selectedThreadId === threadId) {
    displaySelectedThreadOutput();
  }

  updateThreadSection(output);
});