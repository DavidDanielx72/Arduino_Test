let history = [];

export default function handler(req, res) {
  res.status(200).json(history);
}
