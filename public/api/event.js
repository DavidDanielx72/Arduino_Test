import { addHistory, alarmStatus } from "./_shared.js";

export default function handler(req, res) {
    const body = req.body;

    if (body.type === "intrusion") {
        let msg = "INTRUSION DETECTED";

        if (body.distance) {
            msg += ` (${body.distance}cm)`;
        }

        addHistory(msg, "Sensor", "Triggered");
    }

    if (body.type === "rfid_tap" && body.status === "toggle") {

        global.alarmStatus =
            global.alarmStatus === "armed" ? "disarmed" : "armed";

        addHistory(
            `RFID → ${global.alarmStatus.toUpperCase()}`,
            "RFID Scanner",
            global.alarmStatus === "armed" ? "Armed" : "Disarmed"
        );
    }

    res.json({ success: true });
}
