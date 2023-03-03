import client from './client'

const endpoint = "/users"

const addUser = (name, email, password) =>{
    return client.post(endpoint, {name, email, password})
}
const getUser = (email) =>{
    return client.get(endpoint + "/", {email});
}
export default {
    addUser,
    getUser
}
