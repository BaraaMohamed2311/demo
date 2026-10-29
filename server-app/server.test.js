const request = require('supertest');
const { app, pool } = require('./server'); 
// close the pool after all tests as good hygiene
afterAll(async () => {
  await pool.end();
});

describe('API Health Checks', () => {
  test('GET /healthz should return 200 OK and status UP', async () => {
    const res = await request(app).get('/healthz');
    expect(res.statusCode).toEqual(200);
    expect(res.body).toHaveProperty('status', 'UP');
  });
});