let isArmed = true;

const toggleBtn = document.getElementById('toggle-btn');
const btnText = document.getElementById('btn-text');

const statusTitle = document.getElementById('status-title');
const statusSubtitle = document.getElementById('status-subtitle');
const statusLabel = document.getElementById('status-label');

const statusIconContainer = document.getElementById('status-icon-container');
const statusIconLocked = document.getElementById('status-icon-locked');
const statusIconUnlocked = document.getElementById('status-icon-unlocked');

const doorStatusDot = document.getElementById('door-status-dot');
const doorStatusText = document.getElementById('door-status-text');

const nextScheduled = document.getElementById('next-scheduled');

function applyUI(state) {
  isArmed = state === "armed";

  if (isArmed) {
    statusTitle.textContent = 'SYSTEM ARMED';
    btnText.textContent = 'DISARM SYSTEM';

    statusSubtitle.innerHTML =
      'Active Monitoring: <span class="text-gray-300">Engineering Lab 1.29</span>';

    statusLabel.classList.remove('text-red-500');
    statusLabel.classList.add('text-teal-400');

    statusIconContainer.classList.remove('border-red-500/30');
    statusIconContainer.classList.add('border-teal-400/30');

    statusIconLocked.classList.remove('hidden');
    statusIconUnlocked.classList.add('hidden');

    doorStatusDot.classList.remove('bg-red-500');
    doorStatusDot.classList.add('bg-teal-400');

    doorStatusText.textContent = 'Door Locked / Secure';

  } else {
    statusTitle.textContent = 'SYSTEM DISARMED';
    btnText.textContent = 'ARM SYSTEM NOW';

    statusSubtitle.innerHTML =
      'Verified via RFID: <span class="text-gray-300">Admin 01</span>';

    statusLabel.classList.remove('text-teal-400');
    statusLabel.classList.add('text-red-500');

    statusIconContainer.classList.remove('border-teal-400/30');
    statusIconContainer.classList.add('border-red-500/30');

    statusIconLocked.classList.add('hidden');
    statusIconUnlocked.classList.remove('hidden');

    doorStatusDot.classList.remove('bg-teal-400');
    doorStatusDot.classList.add('bg-red-500');

    doorStatusText.textContent = 'Door Unlocked / Open';
  }
}

async function fetchStatus() {
  try {
    const res = await fetch('/status');
    const data = await res.json();

    applyUI(data.status);

    // optional schedule display
    if (nextScheduled && data.autoArmTime) {
      nextScheduled.textContent = data.autoArmTime;
    }

  } catch (err) {
    console.error("Status fetch failed:", err);
  }
}

toggleBtn.addEventListener('click', async () => {
  try {
    const res = await fetch('/toggle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });

    const data = await res.json();

    applyUI(data.status);

  } catch (err) {
    console.error("Toggle failed:", err);
  }
});

fetchStatus();

setInterval(fetchStatus, 2000);