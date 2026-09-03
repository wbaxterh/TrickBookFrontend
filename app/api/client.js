import {create} from 'apisauce';
import authStorage from '../auth/storage';

//production backend 174.129.64.158
const apiClient = create({
    baseURL:'http://174.129.64.158:9000/api'
});

// The API protects each user's private data. Attach the persisted JWT to all
// requests so reads and writes are consistently recognized as the owner.
apiClient.addAsyncRequestTransform(async request => {
    const token = await authStorage.getToken();

    if (token) {
        request.headers['x-auth-token'] = token;
    }
});

export default apiClient;
