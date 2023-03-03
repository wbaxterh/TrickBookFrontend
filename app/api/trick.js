import apiClient from './client';

const endpoint = "/listing"
const getTrick = tricks => {
    const request = {list_id: tricks.toString()}
    return apiClient.get(endpoint, request);
}

const addTrick = trick =>{
    return apiClient.put(endpoint, trick)
}

const deleteTrick = trick =>{
    return apiClient.delete(endpoint + "/" + trick)
}
const updateTrick = trick =>{
    return apiClient.put(endpoint + "/update", trick);
}
const editTrick = trick =>{
    return apiClient.put(endpoint + "/edit", trick)
}
export default {
    getTrick,
    addTrick,
    deleteTrick,
    updateTrick,
    editTrick,
}