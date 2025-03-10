import { selectedProcessName } from './processList.js';
import { selectedThreadId } from './threadSelection.js';
import { utilityChain } from './utilityChain.js';

const saveButton = document.getElementById('save-config');
saveButton.addEventListener('click', () => {
  if (!selectedProcessName || !selectedThreadId) {
    alert('Please select a process and a thread.');
    return;
  }
  const config = {
    selectedThreadId,
    utilityChain: utilityChain.map(util => ({ type: util.type, params: util.params }))
  };
  window.ipc.saveConfiguration(selectedProcessName, config);
});