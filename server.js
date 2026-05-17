const express = require("express");
const cors = require("cors");
const path = require("path");

const app = express();

/* =========================
   PORT
========================= */

const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

/* =========================
   STATE
========================= */

let alarmStatus = "armed";
let history = [];
let lastSeen = 0;

let autoMode = true;
let manualOverride = false;
let overrideUntil = 0;

/* =========================
   AUTO TIMES
========================= */

let autoArmTime = "16:00";
let autoDisarmTime = "06:30";

/* =========================
   SAFETY: TRACK LAST EXECUTION (FIXED PROPERLY)
========================= */

let lastArmMinute = null;
let lastDisarmMinute = null;

/* =========================
   TIME HELPERS
========================= */

function getTimeParts() {
    const now = new Date();
    return {
        hour: String(now.getHours()).padStart(2, "0"),
        minute: String(now.getMinutes()).padStart(2, "0"),
        dayKey: `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`
    };
}

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
   HISTORY
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
   🔥 ROBUST AUTO SYSTEM (FIXED)
========================= */

setInterval(() => {

    const { hour, minute, dayKey } = getTimeParts();
    const currentTime = `${hour}:${minute}`;

    /* release manual override safely */
    if (manualOverride && Date.now() > overrideUntil) {
        manualOverride = false;
    }

    const armKey = `${dayKey}-ARM-${autoArmTime}`;
    const disarmKey = `${dayKey}-DISARM-${autoDisarmTime}`;

    /* =========================
       AUTO ARM (FIXED RELIABLE)
    ========================= */

    if (
        currentTime === autoArmTime &&
        lastArmMinute !== armKey
    ) {
        if (alarmStatus !== "armed") {

            alarmStatus = "armed";

            addHistory("AUTO ARMED", "Scheduler", "Armed");
            console.log("AUTO ARMED");
        }

        lastArmMinute = armKey;
    }

    /* =========================
       AUTO DISARM (FIXED RELIABLE)
    ========================= */

    if (
        currentTime === autoDisarmTime &&
        lastDisarmMinute !== disarmKey
    ) {
        if (alarmStatus !== "disarmed") {

            alarmStatus = "disarmed";

            addHistory("AUTO DISARMED", "Scheduler", "Disarmed");
            console.log("AUTO DISARMED");
        }

        lastDisarmMinute = disarmKey;
    }

}, 1000);

/* =========================
   ESP32 EVENT RECEIVER (RFID FIXED)
========================= */

app.post("/event", (req, res) => {

    lastSeen = Date.now();

    console.log("ESP32 EVENT:", req.body);

    /* INTRUSION */
    if (req.body.type === "intrusion") {

        let msg = "INTRUSION DETECTED";

        if (req.body.distance) {
            msg += ` (${req.body.distance}cm)`;
        }

        addHistory(msg, "Sensor", "Triggered");
    }

    /* =========================
       RFID (FIXED: ALWAYS OVERRIDES CLEANLY)
    ========================= */

    if (
        req.body.type === "rfid_tap" &&
        req.body.status === "toggle"
    ) {
        alarmStatus = (alarmStatus === "armed") ? "disarmed" : "armed";

        manualOverride = true;
        overrideUntil = Date.now() + 120000;

        /* reset scheduler locks so auto still works later */
        lastArmMinute = null;
        lastDisarmMinute = null;

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
    res.json({
        online: (Date.now() - lastSeen) < 8000,
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
   MANUAL CONTROL
========================= */

app.post("/arm", (req, res) => {
    alarmStatus = "armed";
    manualOverride = true;
    overrideUntil = Date.now() + 120000;
    addHistory("MANUAL ARM", "Dashboard", "Armed");
    res.json({ success: true, status: alarmStatus });
});

app.post("/disarm", (req, res) => {
    alarmStatus = "disarmed";
    manualOverride = true;
    overrideUntil = Date.now() + 120000;
    addHistory("MANUAL DISARM", "Dashboard", "Disarmed");
    res.json({ success: true, status: alarmStatus });
});

app.post("/toggle", (req, res) => {
    alarmStatus = (alarmStatus === "armed") ? "disarmed" : "armed";
    manualOverride = true;
    overrideUntil = Date.now() + 120000;

    addHistory(
        `MANUAL TOGGLE ${alarmStatus.toUpperCase()}`,
        "Dashboard",
        alarmStatus === "armed" ? "Armed" : "Disarmed"
    );

    res.json({ success: true, status: alarmStatus });
});

/* =========================
   SET TIMES
========================= */

app.post("/set-times", (req, res) => {
    autoArmTime = req.body.armTime;
    autoDisarmTime = req.body.disarmTime;

    /* reset scheduler locks */
    lastArmMinute = null;
    lastDisarmMinute = null;

    addHistory(
        `AUTO TIMES UPDATED (${autoArmTime} - ${autoDisarmTime})`,
        "Settings",
        "Updated"
    );

    res.json({ success: true, autoArmTime, autoDisarmTime });
});

/* =========================
   HISTORY
========================= */

app.get("/history", (req, res) => res.json(history));
app.get("/api/history", (req, res) => res.json(history));

/* =========================
   COMMAND
========================= */

app.get("/command", (req, res) => {
    res.json({ status: alarmStatus });
});

/* =========================
   ROOT
========================= */

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
});

/* =========================
   START SERVER
========================= */

app.listen(PORT, "0.0.0.0", () => {
    console.log("SERVER RUNNING ON PORT", PORT);
});
