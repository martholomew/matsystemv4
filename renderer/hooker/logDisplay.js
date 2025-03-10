const logElement = document.getElementById('log');

window.ipc.onLunahostLog((output) => {
  if (output.error) {
    logElement.innerHTML += `<div role="alert" class="alert alert-error alert-outline p-2 m-2">
  <span>${output.error}</span>
</div>`;
  } else if (output.exit !== undefined) {
    logElement.innerHTML += `<div role="alert" class="alert alert-info alert-outline p-2 m-2">
  <span>Process exited with code ${output.exit}</span>
</div>`;
  } else {
    logElement.innerHTML += `<div role="alert" class="alert alert-info alert-outline p-2 m-2">
  <span>${output.output}</span>
</div>`;
  }
  logElement.scrollTop = logElement.scrollHeight;
});

window.ipc.onError((error) => {
  logElement.innerHTML += `<div role="alert" class="alert alert-error alert-outline p-2 m-2">
  <span>Error: ${error}</span>
</div>`;
  logElement.scrollTop = logElement.scrollHeight;
});