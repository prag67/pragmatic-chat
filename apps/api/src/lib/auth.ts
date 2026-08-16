import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { env } from './env.js';

export const hashPassword = (pw: string) => bcrypt.hash(pw, 12);
export const verifyPassword = (pw: string, hash: string) => bcrypt.compare(pw, hash);
export const signAccessToken = (payload: object) => jwt.sign(payload, env.JWT_SECRET, { expiresIn: '15m' });
export const signRefreshToken = (payload: object) => jwt.sign(payload, env.JWT_SECRET, { expiresIn: '7d' });
export const verifyToken = (token: string) => jwt.verify(token, env.JWT_SECRET);
