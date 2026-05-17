const express = require("express");
const cors = require("cors");
const path = require("path");

const app = express();

/* =========================
   RENDER PORT FIX
========================= */

const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

/* =========================
   STATIC PUBLIC FOLDER
========================= */

app.use(express.static(path.join(__dirname, "public")));

/* =========================
   STATE
========================= */

let alarmStatus = "armed";
let history = [];
let lastSeen = 0;

let autoMode = true;
let manualOverride = false;

/* =========================
   FIX: PREVENT AUTO REARM
========================= */

let overrideUntil = 0;

/* =========================
   AUTO TIMES
========================= */

let autoArmTime = "16:00";
let autoDisarmTime = "06:30";

/* =========================
   🔥 FIX: DAILY EXECUTION TRACKING
========================= */

let lastArmRunDate = null;
let lastDisarmRunDate = null;

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
   HISTORY
========================= */

function addHistory(description, source = "System", status = "Info") {

    history.push({
        description,
        source,
        status,
        datetime: formatTime()
    });

    if (history.length > 50) {
        history.shift();
    }
}

/* =========================
   🔥 FIXED AUTO SCHEDULER
========================= */

setInterval(() => {

    const now = new Date();

    const currentTime =
        String(now.getHours()).padStart(2, '0') +
        ":" +
        String(now.getMinutes()).padStart(2, '0');

    const today =
        now.getFullYear() + "-" +
        String(now.getMonth() + 1).padStart(2, "0") + "-" +
        String(now.getDate()).padStart(2, "0");

    /* RELEASE MANUAL OVERRIDE */
    if (manualOverride && Date.now() > overrideUntil) {
        manualOverride = false;
    }

    /* =========================
       AUTO ARM (FIXED)
    ========================= */

    if (
        !manualOverride &&
        currentTime === autoArmTime &&
        lastArmRunDate !== today
    ) {
        if (alarmStatus !== "armed") {

            alarmStatus = "armed";
            lastArmRunDate = today;

            console.log("AUTO ARMED");

            addHistory(
                "AUTO ARMED",
                "Scheduler",
                "Armed"
            );
        }
    }

    /* =========================
       AUTO DISARM (FIXED)
    ========================= */

    if (
        !manualOverride &&
        currentTime === autoDisarmTime &&
        lastDisarmRunDate !== today
    ) {
        if (alarmStatus !== "disarmed") {

            alarmStatus = "disarmed";
            lastDisarmRunDate = today;

            console.log("AUTO DISARMED");

            addHistory(
                "AUTO DISARMED",
                "Scheduler",
                "Disarmed"
            );
        }
    }

}, 5000); // better stability than 1s

/* =========================
   ESP32 EVENT RECEIVER
========================= */

app.post("/event", (req, res) => {

    console.log("ESP32 EVENT:", req.body);

    lastSeen = Date.now();

    /* INTRUSION */
    if (req.body.type === "intrusion") {

        let msg = "INTRUSION DETECTED";

        if (req.body.distance) {
            msg += ` (${req.body.distance}cm)`;
        }

        addHistory(msg, "Sensor", "Triggered");
    }

    /* RFID TOGGLE (UNCHANGED — THIS IS CORRECT) */
    if (
        req.body.type === "rfid_tap" &&
        req.body.status === "toggle"
    ) {

        alarmStatus =
            (alarmStatus === "armed")
                ? "disarmed"
                : "armed";

        manualOverride = true;
        overrideUntil = Date.now() + 120000;

        addHistory(
            `RFID → ${alarmStatus.toUpperCase()}`,
            "RFID Scanner",
            alarmStatus === "armed"
                ? "Armed"
                : "Disarmed"
        );
    }

    res.json({ success: true });
});

/* =========================
   DEVICE STATUS
========================= */

app.get("/device-status", (req, res) => {

    const online =
        (Date.now() - lastSeen) < 8000;

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
    manualOverride = true;
    overrideUntil = Date.now() + 120000;

    addHistory("MANUAL ARM", "Dashboard", "Armed");

    res.json({ success: true, status: alarmStatus });
});

/* =========================
   DISARM
========================= */

app.post("/disarm", (req, res) => {

    alarmStatus = "disarmed";
    manualOverride = true;
    overrideUntil = Date.now() + 120000;

    addHistory("MANUAL DISARM", "Dashboard", "Disarmed");

    res.json({ success: true, status: alarmStatus });
});

/* =========================
   TOGGLE
========================= */

app.post("/toggle", (req, res) => {

    alarmStatus =
        (alarmStatus === "armed")
            ? "disarmed"
            : "armed";

    manualOverride = true;
    overrideUntil = Date.now() + 120000;

    addHistory(
        `MANUAL TOGGLE ${alarmStatus.toUpperCase()}`,
        "Dashboard",
        alarmStatus === "armed"
            ? "Armed"
            : "Disarmed"
    );

    res.json({ success: true, status: alarmStatus });
});

/* =========================
   SET TIMES
========================= */

app.post("/set-times", (req, res) => {

    autoArmTime = req.body.armTime;
    autoDisarmTime = req.body.disarmTime;

    /* RESET DAILY TRACKERS */
    lastArmRunDate = null;
    lastDisarmRunDate = null;

    addHistory(
        `AUTO TIMES UPDATED (${autoArmTime} - ${autoDisarmTime})`,
        "Settings",
        "Updated"
    );

    res.json({
        success: true,
        autoArmTime,
        autoDisarmTime
    });
});

/* =========================
   HISTORY
========================= */

app.get("/history", (req, res) => {
    res.json(history);
});

app.get("/api/history", (req, res) => {
    res.json(history);
});

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
