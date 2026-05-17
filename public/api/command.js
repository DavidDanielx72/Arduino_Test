import { alarmStatus } from "./_shared.js";

export default function handler(req, res) {
    res.json({ status: alarmStatus });
}
