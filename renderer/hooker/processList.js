import { resetThreadSelection } from './threadSelection.js';
import { clearUtilityChain } from './utilityChain.js';

const refreshButton = document.getElementById('refresh-button');

export let selectedProcessName = null;

async function loadProcessList() {
  refreshButton.disabled = true;
  refreshButton.textContent = '🗘';

  try {
    const processes = await window.ipc.getProcessList();
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
  selectElement.innerHTML = '<option disabled selected>Select an Application...</option>';
  
  processes.forEach((proc, index) => {
    const option = document.createElement('option');
    option.textContent = `${proc.name} (PID: ${proc.pid})`;
    option.value = index;
    selectElement.appendChild(option);
  });
  
  const newSelectElement = selectElement.cloneNode(true);
  selectElement.parentNode.replaceChild(newSelectElement, selectElement);
  
  newSelectElement.addEventListener('change', (event) => {
    const selectedIndex = event.target.value;
    if (selectedIndex !== '') {
      const selectedProcess = processes[selectedIndex];
      selectProcess(selectedProcess);
    }
  });
}

export function selectProcess(process) {
  resetThreadSelection();
  clearUtilityChain();
  selectedProcessName = process.name;
  window.ipc.selectProcess({ pid: process.pid, name: process.name });
}

refreshButton.addEventListener('click', loadProcessList);
loadProcessList();

document.getElementById('open-new-window').addEventListener('click', () => {
  window.ipc.openNewWindow();
});