const logElement = document.getElementById('log');

window.ipc.onLunahostLog((output) => {
  if (output.error) {
    logElement.innerHTML += `<p style="color: red;">Error: ${output.error}</p>`;
  } else if (output.exit !== undefined) {
    logElement.innerHTML += `<p>Process exited with code ${output.exit}</p>`;
  } else {
    logElement.innerHTML += `<p>Thread ID: ${output.threadId}, Process ID: ${output.processId}, Hookcode: ${output.hookcode}, Output: ${output.output}</p>`;
  }
  logElement.scrollTop = logElement.scrollHeight;
});

window.ipc.onError((error) => {
  logElement.innerHTML += `<p style="color: red;">Error: ${error}</p>`;
  logElement.scrollTop = logElement.scrollHeight;
});