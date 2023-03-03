import apiClient from './client';

const endpoint = "/listings"
const getTricks = userId => {
    const request = {userId: userId.toString()};
    return apiClient.get(endpoint, request);
}

const addTrickList = trick =>{
    return apiClient.post(endpoint, trick);
}

const deleteTrickList = trick =>{
    return apiClient.delete(endpoint + "/" + trick)
}
const editTrickList = trickList =>{
    return apiClient.put(endpoint + "/edit", trickList);
}
export default {
    getTricks,
    addTrickList,
    deleteTrickList,
    editTrickList,
}