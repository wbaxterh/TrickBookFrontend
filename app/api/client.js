import {create} from 'apisauce';
//production backend 174.129.64.158
const apiClient = create({
    baseURL:'http://174.129.64.158:9000/api'
});

export default apiClient;
