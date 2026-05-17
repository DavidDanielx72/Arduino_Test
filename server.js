const express = require("express");
const cors = require("cors");
const path = require("path");

const app = express();
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

let manualOverride = false;
let overrideUntil = 0;

/* =========================
   AUTO TIMES
========================= */

let autoArmTime = "16:00";
let autoDisarmTime = "06:30";

/* =========================
   SAFE EXECUTION TRACKERS
========================= */

let lastArmKey = null;
let lastDisarmKey = null;

/* =========================
   HELPERS
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
   ROBUST AUTO SCHEDULER (FIXED)
========================= */

setInterval(() => {

    const now = new Date();
    const currentTime = now.toTimeString().slice(0, 5);
    const dayKey = now.toDateString();

    /* release override */
    if (manualOverride && Date.now() > overrideUntil) {
        manualOverride = false;
    }

    const armKey = `${dayKey}-ARM`;
    const disarmKey = `${dayKey}-DISARM`;

    /* =========================
       AUTO ARM
    ========================= */

    if (
        currentTime === autoArmTime &&
        lastArmKey !== armKey &&
        !manualOverride
    ) {
        if (alarmStatus !== "armed") {
            alarmStatus = "armed";
            addHistory("AUTO ARMED", "Scheduler", "Armed");
            console.log("AUTO ARMED");
        }

        lastArmKey = armKey;
    }

    /* =========================
       AUTO DISARM
    ========================= */

    if (
        currentTime === autoDisarmTime &&
        lastDisarmKey !== disarmKey &&
        !manualOverride
    ) {
        if (alarmStatus !== "disarmed") {
            alarmStatus = "disarmed";
            addHistory("AUTO DISARMED", "Scheduler", "Disarmed");
            console.log("AUTO DISARMED");
        }

        lastDisarmKey = disarmKey;
    }

}, 10000);

/* =========================
   ESP32 EVENT (FIXED RFID)
========================= */

app.post("/event", (req, res) => {

    console.log("ESP32 EVENT:", JSON.stringify(req.body));
    lastSeen = Date.now();

    /* INTRUSION */
    if (req.body.type === "intrusion") {

        let msg = "INTRUSION DETECTED";

        if (req.body.distance && req.body.distance > 0) {
            msg += ` (${req.body.distance}cm)`;
        }

        addHistory(msg, "Sensor", "Triggered");
    }

    /* =========================
       RFID (ROBUST FIX)
    ========================= */

    if (req.body.type === "rfid_tap") {

        const uidValid = req.body.cardUID && req.body.cardUID.length > 5;

        if (!uidValid) {
            addHistory("RFID TAP (INVALID)", "RFID", "Triggered");
            return res.json({ success: false });
        }

        alarmStatus = (alarmStatus === "armed") ? "disarmed" : "armed";

        manualOverride = true;
        overrideUntil = Date.now() + 120000;

        addHistory(
            `RFID → ${alarmStatus.toUpperCase()}`,
            "RFID Scanner",
            alarmStatus === "armed" ? "Armed" : "Disarmed"
        );

        return res.json({ success: true });
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
        autoDisarmTime
    });
});

/* =========================
   MANUAL CONTROLS
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

    lastArmKey = null;
    lastDisarmKey = null;

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
