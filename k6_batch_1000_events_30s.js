import http from 'k6/http';
import { Counter, Trend } from 'k6/metrics';
import exec from 'k6/execution';

export const events_sent = new Counter('events_sent');
export const post_latency = new Trend('post_latency');

export const options = {
  scenarios: {
    exact_15rps_30s: {
      executor: 'constant-arrival-rate',
      rate: 15,           
      timeUnit: '1s',
      duration: '30s',     
      preAllocatedVUs: 40,
      maxVUs: 40,
      gracefulStop: '10s', 
    },
  },
  thresholds: {
    http_req_failed: ['rate<=5'],
    'events_sent': ['count>=1000'],  
    http_req_duration: ['p(95)<500'],
  },
  discardResponseBodies: true,
};

const API = __ENV.API_URL;
const headers = { 'Content-Type': 'application/json' };

function genEvent() {
  const emergency = Math.random() < 0.01;
  return {
    type: emergency ? 'Emergency' : 'Position',
    vehicle_plate: `TEST-${Math.floor(Math.random() * 1e6)}`,
    coordinates: { latitude: 4.6097, longitude: -74.0817 },
    status: emergency ? 'PANIC' : 'OK',
  };
}

export default function () {
  if (!API) throw new Error('API_URL no seteada');

  const i = exec.scenario.iterationInTest; 
  const events = (i < 100)
    ? [genEvent(), genEvent(), genEvent()]
    : [genEvent(), genEvent()];

  const res = http.post(API, JSON.stringify({ events }), { headers });
  post_latency.add(res.timings.duration);
  events_sent.add(events.length);
}
