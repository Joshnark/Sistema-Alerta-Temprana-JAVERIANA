import http from 'k6/http';

export const options = {
  scenarios: {
    rate_15_for_67s: {
      executor: 'constant-arrival-rate',
      rate: 15,         
      duration: '67s',         
      preAllocatedVUs: 50,
      maxVUs: 100,
    },
  },
};

const API = __ENV.API_URL; 

export default function () {
  const emergency = Math.random() < 0.10; // ~10% emergencias
  const body = JSON.stringify({
    type: emergency ? "Emergency" : "Position",
    vehicle_plate: `TEST-${Math.floor(Math.random() * 100000)}`,
    coordinates: { latitude: 4.6097, longitude: -74.0817 },
    status: emergency ? "PANIC" : "OK",
  });

  http.post(API, body, { headers: { 'Content-Type': 'application/json' }});
}
