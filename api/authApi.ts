import { api } from './client';
import type { User } from './userApi';

export interface LoginResponse {
  message: string;
  accessToken: string;
  refreshToken: string;
  user: User;
}

// ---------- LOGIN ----------
export async function loginApi(username: string, pwd: string): Promise<LoginResponse> {
  const res = await api.post('/auth/login', { username, pwd });
  return res.data;
}

// ---------- GOOGLE (sends the Google ID token to the backend) ----------
export async function googleLoginApi(idToken: string): Promise<LoginResponse> {
  const res = await api.post('/auth/google', { idToken });
  return res.data;
}

// ---------- SIGNUP ----------
export async function signupApi(username: string, pwd: string, email?: string, fullName?: string) {
  const res = await api.post('/auth/signup', { username, pwd, email, fullName });
  return res.data;
}

// ---------- FORGOT PASSWORD (sends an e-mail with a reset link) ----------
export async function forgotPasswordApi(email: string) {
  const res = await api.post('/auth/forgotPassword', { email });
  return res.data;
}

// ---------- LOGOUT ----------
export async function logoutApi() {
  try {
    await api.post('/auth/logout');
  } catch {
    // ignore — the local session is cleared anyway
  }
}

// ---------- CHANGE PASSWORD ----------
export async function changePasswordApi(oldPassword: string, newPassword: string, confirmNewPassword: string) {
  const res = await api.post('/auth/changePassword', { oldPassword, newPassword, confirmNewPassword });
  return res.data;
}

// ---------- DELETE ACCOUNT ----------
export async function deleteAccountApi(confirmUsername: string) {
  const res = await api.post('/auth/deleteUser', { confirmUsername });
  return res.data;
}
