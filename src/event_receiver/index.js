const AWS = require("aws-sdk");
const crypto = require("crypto");
const sqs = new AWS.SQS({ apiVersion: "2012-11-05" });

const { SQS_QUEUE_URL } = process.env;

function isNum(n) { return typeof n === "number" && Number.isFinite(n); }
function validate(b) {
  if (!b || typeof b !== "object") return "body must be a JSON object";
  if (!b.type || !["Position", "Emergency"].includes(b.type))
    return 'field "type" must be "Position" or "Emergency"';
  if (!b.vehicle_plate || typeof b.vehicle_plate !== "string")
    return 'field "vehicle_plate" is required (string)';
  if (!b.coordinates || typeof b.coordinates !== "object")
    return 'field "coordinates" is required (object)';
  const { latitude, longitude } = b.coordinates;
  if (!isNum(latitude) || latitude < -90 || latitude > 90)
    return "coordinates.latitude must be number in [-90,90]";
  if (!isNum(longitude) || longitude < -180 || longitude > 180)
    return "coordinates.longitude must be number in [-180,180]";
  if (b.status != null && typeof b.status !== "string")
    return 'field "status" must be string if provided';
  return null;
}

exports.handler = async (event) => {
  try {
    const body = event.isBase64Encoded
      ? JSON.parse(Buffer.from(event.body || "{}", "base64").toString("utf8"))
      : JSON.parse(event.body || "{}");

    const err = validate(body);
    if (err) return { statusCode: 400, body: JSON.stringify({ error: err }) };

    const msg = {
      ...body,
      event_id: crypto.randomUUID(),
      received_at_utc: new Date().toISOString(),
    };

    if (body.type === "Emergency") {
      console.log(JSON.stringify({
        level: "INFO",
        event: "emergency_received",
        event_id: msg.event_id,
        vehicle_plate: body.vehicle_plate,
        coordinates: body.coordinates,
        received_at_utc: msg.received_at_utc,
        source: "receiver"
      }));
    }

    await sqs.sendMessage({
      QueueUrl: SQS_QUEUE_URL,
      MessageBody: JSON.stringify(msg),
    }).promise();

    return {
      statusCode: 202,
      body: JSON.stringify({ event_id: msg.event_id, received_at_utc: msg.received_at_utc }),
    };
  } catch (e) {
    console.error(JSON.stringify({ level: "ERROR", event: "enqueue_failed", error: String(e) }));
    return { statusCode: 500, body: JSON.stringify({ error: "internal_error" }) };
  }
};
