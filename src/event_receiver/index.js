const AWS = require('aws-sdk');            
const { randomUUID } = require('crypto');
const sqs = new AWS.SQS({ apiVersion: '2012-11-05' });

const { SQS_QUEUE_URL } = process.env;

function isNum(n) { return typeof n === 'number' && Number.isFinite(n); }
function validateEvent(b) {
  if (!b || typeof b !== 'object') return 'body must be a JSON object';
  if (!b.type || !['Position', 'Emergency'].includes(b.type))
    return 'field "type" must be "Position" or "Emergency"';
  if (!b.vehicle_plate || typeof b.vehicle_plate !== 'string')
    return 'field "vehicle_plate" is required (string)';
  if (!b.coordinates || typeof b.coordinates !== 'object')
    return 'field "coordinates" is required (object)';
  const { latitude, longitude } = b.coordinates;
  if (!isNum(latitude) || latitude < -90 || latitude > 90)
    return 'coordinates.latitude must be number in [-90,90]';
  if (!isNum(longitude) || longitude < -180 || longitude > 180)
    return 'coordinates.longitude must be number in [-180,180]';
  if (b.status != null && typeof b.status !== 'string')
    return 'field "status" must be string if provided';
  return null;
}
const chunk = (arr, size) => { const out=[]; for (let i=0;i<arr.length;i+=size) out.push(arr.slice(i,i+size)); return out; };

exports.handler = async (event) => {
  try {
    const raw = event.isBase64Encoded
      ? JSON.parse(Buffer.from(event.body || '{}', 'base64').toString('utf8'))
      : JSON.parse(event.body || '{}');

    const list = Array.isArray(raw?.events) ? raw.events : [raw];
    if (!list.length) return { statusCode: 400, body: JSON.stringify({ error: 'empty payload' }) };

    for (const ev of list) {
      const err = validateEvent(ev);
      if (err) return { statusCode: 400, body: JSON.stringify({ error: err }) };
    }

    const now = new Date().toISOString();
    const enriched = list.map((ev) => ({ ...ev, event_id: randomUUID(), received_at_utc: now }));

    for (const ev of enriched) {
      if (ev.type === 'Emergency') {
        console.log(JSON.stringify({
          level: 'INFO',
          event: 'emergency_received',
          event_id: ev.event_id,
          vehicle_plate: ev.vehicle_plate,
          coordinates: ev.coordinates,
          received_at_utc: ev.received_at_utc,
          source: 'receiver',
        }));
      }
    }

    for (const group of chunk(enriched, 10)) {
      const Entries = group.map((ev) => ({
        Id: ev.event_id.slice(0, 80),           
        MessageBody: JSON.stringify(ev),
      }));
      const resp = await sqs.sendMessageBatch({ QueueUrl: SQS_QUEUE_URL, Entries }).promise();

      if (resp.Failed && resp.Failed.length) {
        for (const f of resp.Failed) {
          const ev = group.find((e) => e.event_id.slice(0, 80) === f.Id);
          if (ev) {
            await sqs.sendMessage({ QueueUrl: SQS_QUEUE_URL, MessageBody: JSON.stringify(ev) }).promise();
          }
        }
      }
    }

    return {
      statusCode: 202,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accepted_events: enriched.length,
        emergencies: enriched.filter(e => e.type === 'Emergency').length,
        event_ids: enriched.map(e => e.event_id),
      }),
    };
  } catch (e) {
    console.error(JSON.stringify({ level: 'ERROR', event: 'enqueue_failed', error: String(e) }));
    return { statusCode: 500, body: JSON.stringify({ error: 'internal_error' }) };
  }
};
