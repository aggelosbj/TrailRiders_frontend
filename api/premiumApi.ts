import { api } from './client';

export interface Plan {
  id: number;
  months: number;
  price: number;
  label: string;
}

export interface SubStatus {
  active: boolean;
  startDate: string | null;
  expireDate: string | null;
  plan: number | null;
  nextPlan: number | null;
  autoRenew: boolean;
}

/** subGen: 0 = start, 1 = change plan, 2 = cancel (backend design) */
async function subToken(subGen: 0 | 1 | 2): Promise<string> {
  const res = await api.post('/auth/token', null, { params: { subGen } });
  return res.data.subToken;
}

export async function getPlansApi(): Promise<Plan[]> {
  const res = await api.get('/subscription/plans');
  return res.data;
}

export async function getSubscriptionApi(): Promise<SubStatus> {
  const res = await api.get('/subscription/check');
  return res.data.subStatus;
}

export async function startSubscriptionApi(plan: number): Promise<SubStatus> {
  const token = await subToken(0);
  const res = await api.post('/subscription/start', { plan }, { params: { subToken: token } });
  return res.data.subStatus;
}

export async function changePlanApi(plan: number): Promise<SubStatus> {
  const token = await subToken(1);
  const res = await api.post('/subscription/update', { plan }, { params: { subToken: token } });
  return res.data.subStatus;
}

export async function cancelSubscriptionApi() {
  const token = await subToken(2);
  const res = await api.post('/subscription/cancel', null, { params: { subToken: token } });
  return res.data;
}
