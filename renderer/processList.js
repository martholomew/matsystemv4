import { resetThreadSelection } from './threadSelection.js';
import { clearUtilityChain } from './utilityChain.js';

const refreshButton = document.getElementById('refresh-button');

export let selectedProcessName = null;

async function loadProcessList() {
  refreshButton.disabled = true;
  refreshButton.textContent = 'Refreshing...';

  try {
    const processes = await window.ipc.getProcessList();
    displayProcessList(processes);
  } catch (error) {
    console.error('Error fetching process list:', error);
  } finally {
    refreshButton.disabled = false;
    refreshButton.textContent = 'Refresh';
  }
}

function displayProcessList(processes) {
  const listElement = document.getElementById('process-list');
  listElement.innerHTML = '';
  processes.forEach((proc, index) => {
    const item = document.createElement('li');
    item.textContent = `${index + 1}. ${proc.name} (PID: ${proc.pid})`;
    item.addEventListener('click', () => selectProcess(proc));
    listElement.appendChild(item);
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