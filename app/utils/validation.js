import axios from "axios";
import config from "@/utils/config";

export function is_valid_phone_number(phoneNumber) {
    // Check if the cleaned number is exactly 10 digits long
    return phoneNumber.length === 10 && /^\d{10}$/.test(phoneNumber);
}


export function create_axios_instance(requires_token = true) {
    const api = axios.create({
        baseURL: `${config.apiBaseUrl}`,
    });
    if (requires_token) {
        // Interceptor to add token to requests conditionally
        api.interceptors.request.use((config) => {
            const token = window.localStorage.getItem('authToken');
            if (token) {
                config.headers['Authorization'] = token;
            }
            // If there is no token, the request still proceeds without the Authorization header
            return config;
        }, error => {
            // Handle the request error here if needed
            return Promise.reject(error);
        });
    }


    return api
}