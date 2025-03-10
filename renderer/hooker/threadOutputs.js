const threadOutputsElement = document.getElementById('thread-outputs');

export function updateThreadSection(output, onSelect, selectedThreadId) {
  let instructions = document.getElementById('thread-instructions');
  if (instructions) {
    instructions.remove();
  }

  const threadId = output.threadId;
  let threadSection = document.getElementById(`thread-${threadId}`);

  if (!threadSection) {
    threadSection = document.createElement('li');
    threadSection.id = `thread-${threadId}`;
    threadSection.classList.add('thread-section', 'list-row');

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.value = threadId;
    checkbox.className = 'checkbox';
    checkbox.addEventListener('change', (event) => {
      onSelect(threadId, event.target.checked);
    });

    if (threadId === selectedThreadId) {
      checkbox.checked = true;
      onSelect(threadId, true);
    }

    const checkboxDiv = document.createElement('div');
    checkboxDiv.appendChild(checkbox);
    threadSection.appendChild(checkboxDiv);

    const outputDiv = document.createElement('div');
    outputDiv.innerHTML = output.output;
    threadSection.appendChild(outputDiv);

    threadOutputsElement.appendChild(threadSection);
  } else {
    threadSection.querySelector('div:nth-child(2)').innerHTML = output.output;
  }
}