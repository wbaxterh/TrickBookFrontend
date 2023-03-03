import {create} from 'apisauce';
//production backend 174.129.64.158
const apiClient = create({
    baseURL:'http://192.168.86.100:9000/api'
});

export default apiClient;
