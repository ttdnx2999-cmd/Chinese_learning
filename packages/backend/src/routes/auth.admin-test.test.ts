import express from 'express';
import request from 'supertest';
import authRoutes from './auth.routes';
import adminRoutes from './admin.routes';
import { User, UserDAO } from '../models/User';
import { AuthService } from '../services/AuthService';
import { authenticateJWT, requireRole } from '../middleware/auth';

const app = express();
app.use(express.json());
app.use('/api', authRoutes);
app.use('/api', adminRoutes);
app.get('/protected', authenticateJWT, requireRole(['admin']), (_req, res) => res.json({ ok: true }));
const admin: User = {
  id: 1, username: 'admin', role: 'admin', parentId: null, isActive: true,
  secretPhraseHash: 'unused', createdAt: new Date(), updatedAt: new Date()
};
const originalFlag = process.env.ENABLE_TEMP_ADMIN_ACCESS;
const originalSecret = process.env.JWT_SECRET;

beforeEach(() => {
  process.env.JWT_SECRET = 'test-only-signing-secret';
  process.env.ENABLE_TEMP_ADMIN_ACCESS = 'true';
  jest.spyOn(UserDAO, 'findByUsername').mockResolvedValue(admin);
});
afterEach(() => {
  jest.restoreAllMocks();
  if (originalFlag === undefined) delete process.env.ENABLE_TEMP_ADMIN_ACCESS;
  else process.env.ENABLE_TEMP_ADMIN_ACCESS = originalFlag;
  if (originalSecret === undefined) delete process.env.JWT_SECRET;
  else process.env.JWT_SECRET = originalSecret;
});

test('disabled by default without a database lookup', async () => {
  delete process.env.ENABLE_TEMP_ADMIN_ACCESS;
  await request(app).post('/api/auth/admin-test').expect(404);
  expect(UserDAO.findByUsername).not.toHaveBeenCalled();
});

test('password-free session has admin permissions and expires after an hour', async () => {
  const response = await request(app).post('/api/auth/admin-test').expect(200);
  expect(response.headers['cache-control']).toBe('no-store');
  expect(response.body.user.secretPhraseHash).toBeUndefined();
  const token = response.body.token;
  const payload = AuthService.verifyToken(token) as any;
  expect(payload).toMatchObject({ userId: 1, role: 'admin', temporaryAdmin: true });
  expect(payload.exp - payload.iat).toBe(3600);
  await request(app).get('/protected').set('Authorization', `Bearer ${token}`).expect(200);
  // An empty restore reaches input validation, without performing a restore.
  await request(app).post('/api/admin/restore').set('Authorization', `Bearer ${token}`).send({}).expect(400);
  process.env.ENABLE_TEMP_ADMIN_ACCESS = 'false';
  await request(app).get('/protected').set('Authorization', `Bearer ${token}`).expect(401);
  await request(app).post('/api/admin/restore').set('Authorization', `Bearer ${token}`).send({}).expect(401);
  expect(AuthService.verifyToken(AuthService.generateToken(admin))).not.toBeNull();
});

test.each([null, { ...admin, isActive: false }, { ...admin, role: 'parent' as const }])(
  'does not grant access for an unavailable admin: %p', async user => {
    jest.mocked(UserDAO.findByUsername).mockResolvedValue(user);
    await request(app).post('/api/auth/admin-test').expect(503);
  }
);
