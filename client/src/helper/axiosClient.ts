import axios from "axios";

// Detect if we're accessing from local network or localhost
const getApiUrl = () => {
  const hostname = window.location.hostname;
  
  // If accessing via IP address (not localhost), use that IP for API
  if (hostname !== 'localhost' && hostname !== '127.0.0.1') {
    const apiUrl = `http://${hostname}:8000`;
    console.log(`🌐 Axios configured for network access: ${apiUrl}`);
    return apiUrl;
  }
  
  // Default to localhost
  console.log('🌐 Axios configured for localhost: http://localhost:8000');
  return "http://localhost:8000";
};

const VITE_API_URL = getApiUrl();

export const axiosClient = axios.create({
  baseURL: VITE_API_URL,
  withCredentials: true,
});

// Log all requests for debugging
axiosClient.interceptors.request.use(
  (config) => {
    console.log(`📤 API Request: ${config.method?.toUpperCase()} ${config.baseURL}${config.url}`);
    return config;
  },
  (error) => {
    console.error('❌ Request error:', error);
    return Promise.reject(error);
  }
);

// Log all responses for debugging
axiosClient.interceptors.response.use(
  (response) => {
    console.log(`✅ API Response: ${response.status} ${response.config.url}`);
    return response;
  },
  (error) => {
    console.error(`❌ API Error: ${error.response?.status} ${error.config?.url}`, error.response?.data);
    return Promise.reject(error);
  }
);
