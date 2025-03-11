const logElement = document.getElementById('log');

window.ipc.onLog((logData) => {
  const { type, message } = logData;
  const alertClass = type === 'error' ? 'alert-error' : 'alert-info';
  logElement.innerHTML += `<div role="alert" class="alert ${alertClass} alert-outline p-2 m-2">
    <span>${message}</span>
  </div>`;
  logElement.scrollTop = logElement.scrollHeight;
});