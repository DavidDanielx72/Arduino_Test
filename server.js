const express = require("express");
const cors = require("cors");

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());
app.use(express.static("public"));

/* =========================
   STATE
========================= */

let alarmStatus = "armed";
let history = [];
let lastSeen = 0;
let autoMode = true;
let manualOverride = false;

/* =========================
   AUTO TIMES
========================= */
let autoArmTime = "16:00";
let autoDisarmTime = "06:30";

/* =========================
   OPTIONAL PERSIST LOG (SAFE ADDITION)
========================= */
function logSchedule() {
    console.log("SCHEDULE → ARM:", autoArmTime, "DISARM:", autoDisarmTime);
}
/* =========================
   TIME FORMATTER
========================= */

function formatTime() {
    return new Date().toLocaleString("en-GB", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit"
    });
}

/* =========================
   HISTORY (UPDATED STRUCTURE)
========================= */

function addHistory(description, source = "System", status = "Info") {
    history.push({
        description,
        source,
        status,
        datetime: formatTime()
    });

    if (history.length > 50) history.shift();
}

/* =========================
   AUTO SCHEDULER
========================= */

setInterval(() => {
    const now = new Date();

    const currentTime =
        String(now.getHours()).padStart(2, '0') +
        ":" +
        String(now.getMinutes()).padStart(2, '0');

    // AUTO ARM
    if (currentTime === autoArmTime) {
        if (alarmStatus !== "armed") {
            alarmStatus = "armed";
            autoMode = true;
            manualOverride = false;

            console.log("AUTO ARMED", currentTime);
            addHistory("AUTO ARMED", "Scheduler", "Armed");
        }
    }

    // AUTO DISARM
    if (currentTime === autoDisarmTime) {
        if (alarmStatus !== "disarmed") {
            alarmStatus = "disarmed";
            autoMode = false;
            manualOverride = true;

            console.log("AUTO DISARMED", currentTime);
            addHistory("AUTO DISARMED", "Scheduler", "Disarmed");
        }
    }

    // RE-ENABLE AUTO AFTER MANUAL
    if (manualOverride === true) {
        if (currentTime !== autoDisarmTime) {
            manualOverride = false;
            autoMode = true;
        }
    }

}, 1000);

/* =========================
   ESP32 EVENT RECEIVER
========================= */

app.post("/event", (req, res) => {
    console.log("ESP32 EVENT:", req.body);

    lastSeen = Date.now();

    // INTRUSION EVENT
    if (req.body.type === "intrusion") {

        let msg = "INTRUSION DETECTED";

        if (req.body.distance) {
            msg += ` (${req.body.distance}cm)`;
        }

        addHistory(msg, "Sensor", "Triggered");
    }

    // RFID EVENT
    if (req.body.type === "rfid_tap" && req.body.status === "toggle") {

        alarmStatus =
            (alarmStatus === "armed") ? "disarmed" : "armed";

        autoMode = false;
        manualOverride = true;

        addHistory(
            `RFID → ${alarmStatus.toUpperCase()}`,
            "RFID Scanner",
            alarmStatus === "armed" ? "Armed" : "Disarmed"
        );
    }

    res.json({ success: true });
});

/* =========================
   DEVICE STATUS
========================= */

app.get("/device-status", (req, res) => {
    const online = (Date.now() - lastSeen) < 8000;

    res.json({
        online,
        alarmStatus
    });
});

/* =========================
   STATUS
========================= */

app.get("/status", (req, res) => {
    res.json({
        status: alarmStatus,
        autoArmTime,
        autoDisarmTime,
        autoMode
    });
});

/* =========================
   ARM
========================= */

app.post("/arm", (req, res) => {
    alarmStatus = "armed";
    autoMode = true;
    manualOverride = false;

    addHistory("MANUAL ARM", "Dashboard", "Armed");

    res.json({ success: true });
});

/* =========================
   DISARM
========================= */

app.post("/disarm", (req, res) => {
    alarmStatus = "disarmed";
    autoMode = false;
    manualOverride = true;

    addHistory("MANUAL DISARM", "Dashboard", "Disarmed");

    res.json({ success: true });
});

/* =========================
   TOGGLE
========================= */

app.post("/toggle", (req, res) => {
    alarmStatus =
        (alarmStatus === "armed") ? "disarmed" : "armed";

    autoMode = false;
    manualOverride = true;

    addHistory(
        `MANUAL TOGGLE ${alarmStatus.toUpperCase()}`,
        "Dashboard",
        alarmStatus === "armed" ? "Armed" : "Disarmed"
    );

    res.json({
        success: true,
        status: alarmStatus
    });
});

/* =========================
   SET TIMES
========================= */

app.post("/set-times", (req, res) => {
    autoArmTime = req.body.armTime;
    autoDisarmTime = req.body.disarmTime;

    console.log("NEW SCHEDULE SET:", autoArmTime, autoDisarmTime);

    addHistory(
        `AUTO TIMES UPDATED (${autoArmTime} - ${autoDisarmTime})`,
        "Settings",
        "Updated"
    );

    res.json({ success: true, autoArmTime, autoDisarmTime });
});

/* =========================
   HISTORY API (NEW FRONTEND ENDPOINT)
========================= */

app.get("/api/history", (req, res) => {
    res.json(history);
});

/* =========================
   LEGACY HISTORY (OPTIONAL KEEP)
========================= */

app.get("/history", (req, res) => {
    res.json(history);
});

/* =========================
   COMMAND
========================= */

app.get("/command", (req, res) => {
    res.json({ status: alarmStatus });
});

/* =========================
   START SERVER
========================= */

app.listen(PORT, "0.0.0.0", () => {
    console.log("SERVER RUNNING ON PORT", PORT);
});