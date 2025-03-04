const threadOutputsElement = document.getElementById('thread-outputs');

export function updateThreadSection(output) {
  const threadId = output.threadId;
  let threadSection = document.getElementById(`thread-${threadId}`);

  if (!threadSection) {
    threadSection = document.createElement('div');
    threadSection.id = `thread-${threadId}`;
    threadSection.className = 'thread-section';
    threadSection.innerHTML = `<h3>Thread ID: ${threadId}</h3>`;
    threadOutputsElement.appendChild(threadSection);
  }

  threadSection.innerHTML += `<p>Process ID: ${output.processId}, Hookcode: ${output.hookcode}, Output: ${output.output}</p>`;
  threadSection.scrollTop = threadSection.scrollHeight;
}