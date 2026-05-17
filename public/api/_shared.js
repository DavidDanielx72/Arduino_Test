// Shared state (simulates your Express memory state)
export let alarmStatus = "armed";
export let history = [];
export let lastSeen = 0;
export let autoMode = true;
export let manualOverride = false;

export let autoArmTime = "16:00";
export let autoDisarmTime = "06:30";

export function formatTime() {
    return new Date().toLocaleString("en-GB", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit"
    });
}

export function addHistory(description, source = "System", status = "Info") {
    history.push({
        description,
        source,
        status,
        datetime: formatTime()
    });

    if (history.length > 50) history.shift();
}
