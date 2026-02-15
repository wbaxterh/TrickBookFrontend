import { create } from 'apisauce';

//production backend 174.129.64.158
const apiClient = create({
  baseURL: 'https://api.thetrickbook.com/api',
});

export default apiClient;
