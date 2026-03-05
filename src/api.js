const API_BASE_URL =
  import.meta.env.VITE_API_URL ||
  (import.meta.env.PROD ? '/api' : 'http://localhost:5000/api');

// Get stored token
export const getAuthToken = () => localStorage.getItem('everything_token');

// Set stored token
export const setAuthToken = (token) => {
  if (token) {
    localStorage.setItem('everything_token', token);
  } else {
    localStorage.removeItem('everything_token');
  }
};

// Auth API calls
export const authAPI = {
  register: async (email, password) => {
    const res = await fetch(`${API_BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    setAuthToken(data.token);
    return data;
  },

  login: async (email, password) => {
    const res = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    setAuthToken(data.token);
    return data;
  },
};

// Maps API calls
export const mapsAPI = {
  getMap: async () => {
    const token = getAuthToken();
    const res = await fetch(`${API_BASE_URL}/maps`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data;
  },

  saveMap: async (nodes) => {
    const token = getAuthToken();
    const res = await fetch(`${API_BASE_URL}/maps`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ nodes }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data;
  },
};

// Files API calls
export const filesAPI = {
  uploadFile: async (file, nodeId) => {
    const token = getAuthToken();
    const formData = new FormData();
    formData.append('file', file);
    formData.append('nodeId', nodeId);

    const res = await fetch(`${API_BASE_URL}/files/upload`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: formData,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data;
  },

  getFiles: async (nodeId) => {
    const token = getAuthToken();
    const res = await fetch(`${API_BASE_URL}/files/node/${nodeId}`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data;
  },

  deleteFile: async (fileId) => {
    const token = getAuthToken();
    const res = await fetch(`${API_BASE_URL}/files/${fileId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data;
  },
};
