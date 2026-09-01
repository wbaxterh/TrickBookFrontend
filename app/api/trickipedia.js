import { create } from 'apisauce';

const client = create({ baseURL: 'https://api.thetrickbook.com/api' });

export const getTrickipedia = () => client.get('/trickipedia', { limit: 250 });
export const getTrickNetwork = (id) => client.get(`/trickipedia/${id}/network`);

