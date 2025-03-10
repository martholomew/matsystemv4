import { applyUtilityChain } from './utilityChain.js';
import { updateThreadSection } from './threadOutputs.js';
import { setUtilityChain } from './utilityChain.js';

const selectedThreadOutputElement = document.getElementById('selected-thread-output');

let threadOutputs = {};
export let selectedThreadId = null;
let savedConfig = null;
let currentExeName = '';

window.ipc.onConfigurationLoaded((config) => {
  savedConfig = config;
  if (config) {
    setUtilityChain(config.utilityChain);
    selectedThreadId = config.selectedThreadId; // Set initial selection from config
  }
});

window.ipc.onProcessDetails((details) => {
  currentExeName = details.name;
});

export function resetThreadSelection() {
  let threadInstructions = document.getElementById(`thread-instructions`);

  if (!threadInstructions) {
    threadInstructions = document.createElement('div');
    threadInstructions.id = 'thread-instructions';
    threadInstructions.classList.add('card', 'card-border', 'bg-base-100', 'w-auto');
    threadInstructions.innerHTML = `<div role="alert" class="alert alert-warning alert-outline p-2 m-2">
        <span>Please progress the text in the VN</span>
      </div>`
    document.getElementById('thread-fieldset').appendChild(threadInstructions);
    const allThreadElements = document.querySelectorAll('.thread-section')
    allThreadElements.forEach(element => element.remove());
  }

  threadOutputs = {};
  selectedThreadId = null;
  selectedThreadOutputElement.innerHTML = '';
  savedConfig = null;
  currentExeName = '';
}

function onSelect(threadId, isChecked) {
  if (isChecked) {
    document.querySelectorAll('#thread-outputs input[type="checkbox"]').forEach((cb) => {
      if (cb.value !== threadId) cb.checked = false;
    });
    selectedThreadId = threadId;
    displaySelectedThreadOutput();
  } else {
    if (selectedThreadId === threadId) {
      selectedThreadId = null;
      selectedThreadOutputElement.innerHTML = '';
    }
  }
}

function displaySelectedThreadOutput() {
  if (!selectedThreadId) {
    selectedThreadOutputElement.innerHTML = '';
    window.ipc.sendText({ text: '', exeName: currentExeName });
    return;
  }
  let latestOutput = threadOutputs[selectedThreadId];
  if (!latestOutput) {
    selectedThreadOutputElement.innerHTML = '<p>No output yet for this thread.</p>';
    window.ipc.sendText({ text: '<p>No output yet for this thread.</p>', exeName: currentExeName });
    return;
  }

  latestOutput = applyUtilityChain(latestOutput);
  const formattedOutput = `<p>${latestOutput}</p>`;
  selectedThreadOutputElement.innerHTML = formattedOutput;
  window.ipc.sendText({ text: formattedOutput, exeName: currentExeName });
}

export function refreshSelectedThreadOutput() {
  displaySelectedThreadOutput();
}

window.ipc.onLunahostThread((output) => {
  const threadId = output.threadId;
  if (threadId === '0') return;

  threadOutputs[threadId] = output.output;

  updateThreadSection(output, onSelect, selectedThreadId);

  if (selectedThreadId === threadId) {
    displaySelectedThreadOutput();
  }
});