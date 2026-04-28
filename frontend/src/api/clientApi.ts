import { apiClient } from './client';
import { authApi } from './authApi';

export interface Client {
  id: string;
  user_id: string;
  client_name: string;
  industry: string;
  contact_person: string;
  email: string;
  last_audit_date?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

function _token(): string {
  const token = authApi.getToken();
  if (!token) throw new Error('Not authenticated');
  return token;
}

export const clientsApi = {
  // List all clients
  listClients: async (): Promise<Client[]> => {
    return apiClient.get('/clients', _token());
  },

  // Create a new client
  createClient: async (data: {
    client_name: string;
    industry: string;
    contact_person: string;
    email: string;
    last_audit_date?: string;
    notes?: string;
  }): Promise<Client> => {
    return apiClient.post('/clients', data, _token());
  },

  // Get a specific client
  getClient: async (clientId: string): Promise<Client> => {
    return apiClient.get(`/clients/${clientId}`, _token());
  },

  // Update a client
  updateClient: async (
    clientId: string,
    data: {
      client_name: string;
      industry: string;
      contact_person: string;
      email: string;
      last_audit_date?: string;
      notes?: string;
    }
  ): Promise<Client> => {
    return apiClient.put(`/clients/${clientId}`, data, _token());
  },

  // Delete a client
  deleteClient: async (clientId: string): Promise<void> => {
    return apiClient.delete(`/clients/${clientId}`, _token());
  },
};

