import { resetThreadSelection } from './threadSelection.js';
import { clearUtilityChain } from './utilityChain.js';

const refreshButton = document.getElementById('refresh-button');
export let selectedProcessName = null;
let isSetupComplete = false;
let currentProcesses = [];

window.ipc.onSetupComplete(() => {
  isSetupComplete = true;
  loadProcessList();
});

window.ipc.onAutoProcessSelected((processData) => {
  if (currentProcesses.length > 0) {
    const selectElement = document.getElementById('process-list');
    const index = currentProcesses.findIndex(p => p.pid === processData.pid);
    if (index !== -1) {
      selectElement.value = index;
      selectedProcessName = processData.name;
    }
  }
});

async function loadProcessList() {
  if (!isSetupComplete) {
    console.log('Setup not complete, cannot load process list.');
    return;
  }
  refreshButton.disabled = true;
  refreshButton.textContent = '🗘';
  try {
    const processes = await window.ipc.getProcessList();
    if (processes.error) {
      console.log(processes.error);
      return;
    }
    currentProcesses = processes;
    displayProcessList(processes);
  } catch (error) {
    console.error('Error fetching process list:', error);
  } finally {
    refreshButton.disabled = false;
    refreshButton.textContent = '🗘';
  }
}

function displayProcessList(processes) {
  const selectElement = document.getElementById('process-list');
  selectElement.disabled = !isSetupComplete;
  selectElement.innerHTML = '<option disabled selected>Select an Application...</option>';

  processes.forEach((proc, index) => {
    const option = document.createElement('option');
    option.textContent = `${proc.name}`;
    option.value = index;
    selectElement.appendChild(option);
  });

  const newSelectElement = selectElement.cloneNode(true);
  selectElement.parentNode.replaceChild(newSelectElement, selectElement);

  newSelectElement.addEventListener('change', (event) => {
    const selectedIndex = event.target.value;
    if (selectedIndex !== '' && isSetupComplete) {
      const selectedProcess = processes[selectedIndex];
      selectProcess(selectedProcess);
    }
  });
}

export function selectProcess(process) {
  if (!isSetupComplete) {
    console.log('Setup not complete, cannot select process.');
    return;
  }
  resetThreadSelection();
  clearUtilityChain();
  selectedProcessName = process.name;
  window.ipc.selectProcess(process);
}

refreshButton.addEventListener('click', loadProcessList);
loadProcessList();

document.getElementById('open-new-window').addEventListener('click', () => {
  window.ipc.openNewWindow();
});