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

  forgotPassword: async (email) => {
    const res = await fetch(`${API_BASE_URL}/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data;
  },

  resetPassword: async (token, password) => {
    const res = await fetch(`${API_BASE_URL}/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data;
  },

  getMe: async () => {
    const res = await fetch(`${API_BASE_URL}/auth/me`, {
      ...defaultFetchOptions,
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

  getGlobalMap: async () => {
    const res = await fetch(`${API_BASE_URL}/maps/global`);
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
  uploadFile: (file, nodeId, onProgress) => {
    return new Promise((resolve, reject) => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('nodeId', nodeId);

      const xhr = new XMLHttpRequest();
      xhr.withCredentials = true;
      xhr.open('POST', `${API_BASE_URL}/files/upload`);

      if (onProgress) {
        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
        });
      }

      xhr.onload = () => {
        try {
          const data = JSON.parse(xhr.responseText);
          if (xhr.status >= 200 && xhr.status < 300) resolve(data);
          else reject(new Error(data.error || 'Upload failed'));
        } catch {
          reject(new Error('Upload failed'));
        }
      };
      xhr.onerror = () => reject(new Error('Upload failed'));
      xhr.send(formData);
    });
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
