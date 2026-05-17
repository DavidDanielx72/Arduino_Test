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
   🔥 FIX: DAILY RUN TRACKERS (IMPORTANT FIX)
========================= */

let lastArmRunKey = null;
let lastDisarmRunKey = null;

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
   🔥 FIXED AUTO SCHEDULER (ROBUST + RELIABLE)
========================= */

setInterval(() => {

    const now = new Date();

    const hour = String(now.getHours()).padStart(2, "0");
    const minute = String(now.getMinutes()).padStart(2, "0");
    const currentTime = `${hour}:${minute}`;

    const todayKey = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;

    /* release override */
    if (manualOverride && Date.now() > overrideUntil) {
        manualOverride = false;
    }

    /* =========================
       AUTO ARM (FIXED)
    ========================= */

    if (!manualOverride && currentTime === autoArmTime) {

        const armKey = todayKey + "-ARM";

        if (lastArmRunKey !== armKey) {

            if (alarmStatus !== "armed") {
                alarmStatus = "armed";

                addHistory("AUTO ARMED", "Scheduler", "Armed");
                console.log("AUTO ARMED");
            }

            lastArmRunKey = armKey;
        }
    }

    /* =========================
       AUTO DISARM (FIXED)
    ========================= */

    if (!manualOverride && currentTime === autoDisarmTime) {

        const disarmKey = todayKey + "-DISARM";

        if (lastDisarmRunKey !== disarmKey) {

            if (alarmStatus !== "disarmed") {
                alarmStatus = "disarmed";

                addHistory("AUTO DISARMED", "Scheduler", "Disarmed");
                console.log("AUTO DISARMED");
            }

            lastDisarmRunKey = disarmKey;
        }
    }

}, 1000); // keep 1s for accuracy

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

    /* RFID TOGGLE (UNCHANGED - WORKING LOGIC) */
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

    /* RESET RUN TRACKERS */
    lastArmRunKey = null;
    lastDisarmRunKey = null;

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
