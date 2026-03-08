export const API_BASE_URL =
  import.meta.env.VITE_API_URL ||
  (import.meta.env.PROD ? '/api' : 'http://localhost:5000/api');

const defaultFetchOptions = {
  credentials: 'include', // Automatically send cookies
};

// Auth API calls
export const authAPI = {
  register: async (email, password) => {
    const res = await fetch(`${API_BASE_URL}/auth/register`, {
      ...defaultFetchOptions,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data;
  },

  login: async (email, password) => {
    const res = await fetch(`${API_BASE_URL}/auth/login`, {
      ...defaultFetchOptions,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data;
  },

  logout: async () => {
    const res = await fetch(`${API_BASE_URL}/auth/logout`, {
      ...defaultFetchOptions,
      method: 'POST',
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data;
  },
};

// Maps API calls
export const mapsAPI = {
  getMap: async () => {
    const res = await fetch(`${API_BASE_URL}/maps`, {
      ...defaultFetchOptions,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data;
  },

  saveMap: async (nodes) => {
    const res = await fetch(`${API_BASE_URL}/maps`, {
      ...defaultFetchOptions,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
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
    const formData = new FormData();
    formData.append('file', file);
    formData.append('nodeId', nodeId);

    const res = await fetch(`${API_BASE_URL}/files/upload`, {
      ...defaultFetchOptions,
      method: 'POST',
      body: formData,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data;
  },

  getFiles: async (nodeId) => {
    const res = await fetch(`${API_BASE_URL}/files/node/${nodeId}`, {
      ...defaultFetchOptions,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data;
  },

  deleteFile: async (fileId) => {
    const res = await fetch(`${API_BASE_URL}/files/${fileId}`, {
      ...defaultFetchOptions,
      method: 'DELETE',
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data;
  },

  getStorageUsage: async () => {
    const res = await fetch(`${API_BASE_URL}/files/storage/usage`, {
      ...defaultFetchOptions,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data;
  },
};
