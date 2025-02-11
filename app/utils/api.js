import axios from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_API_URL;

// Unauthenticated API instance
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Authenticated API instance
const authApi = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add a request interceptor to the authenticated instance
authApi.interceptors.request.use((config) => {
  const token = localStorage.getItem('authToken');
  if (token) {
    config.headers['Authorization'] = `Bearer ${token}`;
  }
  return config;
}, (error) => {
  return Promise.reject(error);
});

// Add a response interceptor to handle token expiration
authApi.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      // Clear localStorage on unauthorized response
      localStorage.removeItem('authToken');
      localStorage.removeItem('patientId');
      
      // Redirect to login if needed
      if (typeof window !== 'undefined') {
        window.location.href = '/auth';
      }
    }
    return Promise.reject(error);
  }
);

export const create_axios_instance = () => {
  return api;
};

export const is_valid_phone_number = (phone) => {
  return /^\d{10}$/.test(phone); // Basic example: 10 digit number
};

export const authenticate_token = async (token) => {
  try {
    const response = await api.post('/authenticate_token/', { token });
    // Update localStorage with fresh token if provided
    if (response.data && response.data.token) {
      localStorage.setItem('authToken', response.data.token);
    }
    return response;
  } catch (error) {
    localStorage.removeItem('authToken');
    localStorage.removeItem('patientId');
    throw error;
  }
};

export const createPatient = (patientData) => {
  return api.post('/patients/', patientData);
};

export const generate_otp = (contact_number) => {
  return api.post('/patients/generate_otp/', { contact_number });
};

export const verify_otp = (contact_number, otp) => {
  const formData = new FormData();
  formData.append('contact_number', contact_number);
  formData.append('otp', otp);

  const sanitizedBaseUrl = API_BASE_URL.replace(/\/$/, '');

  return axios.post(`${sanitizedBaseUrl}/login/patient/`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  })
    .then(response => {
      if (response.data && response.data.token) {
        localStorage.setItem('authToken', response.data.token);
        if (response.data.patient && response.data.patient.id) {
          localStorage.setItem('patientId', response.data.patient.id);
        }
      }
      return response;
    })
    .catch(error => {
      console.error('OTP verification failed:', error.response ? error.response.data : error.message);
      throw error;
    });
};

// Public API calls
export const getDoctors = () => {
  return api.get('/doctors/?filter_by_active=1');
};

export const getAvailableTimes = (doctorId, start_date) => {
  return api.get(`/doctors/${doctorId}/available_appointments/`, { params: { start_date } });
};

export const createAppointment = (appointmentData) => {
  if (typeof appointmentData !== 'object' || appointmentData === null) {
    console.error('Invalid appointment data received:', appointmentData);
    return Promise.reject(new Error('Invalid appointment data'));
  }

  // Extract questionnaire data if it exists
  const { questionnaire, ...appointmentDetails } = appointmentData;

  const formattedData = {
    date: appointmentDetails.date,
    time: appointmentDetails.time,
    doctor_id: appointmentDetails.doctor_id,
    patient: {
      first_name: appointmentDetails.patient.first_name || '',
      last_name: appointmentDetails.patient.last_name || '',
      contact_number: appointmentDetails.patient.contact_number || '',
    },
    booked_by_patient: 1,
    questionnaire_data: questionnaire || null  // Always include questionnaire_data, even if null
  };

  return authApi.post('/appointments/', formattedData)
    .then(response => {
      console.log('Backend response:', response.data);
      return response;
    })
    .catch(error => {
      if (error.response && error.response.status === 401) {
        // Clear invalid tokens
        localStorage.removeItem('authToken');
        localStorage.removeItem('patientId');
      }
      console.error('Error in createAppointment:', error.response?.data || error.message);
      throw error;
    });
};

// Protected API calls (these will now use the authenticated instance)
export const getPatientAppointments = (patientId) => {
  return authApi.get(`/patients/${patientId}/appointments/`)
    .then(response => {
      return response;
    })
    .catch(error => {
      if (error.response && error.response.status === 401) {
        // Clear invalid tokens
        localStorage.removeItem('authToken');
        localStorage.removeItem('patientId');
      }
      console.error('API: Error fetching appointments:', error.response ? error.response.data : error.message);
      throw error;
    });
};

export const getCancelledAppointments = (patientId) => {
  return authApi.get(`/patients/${patientId}/cancelled_appointments/`)
    .then(response => {
      return response.data;
    })
    .catch(error => {
      if (error.response && error.response.status === 401) {
        // Clear invalid tokens
        localStorage.removeItem('authToken');
        localStorage.removeItem('patientId');
      }
      console.error('API: Error fetching cancelled appointments:', error.response ? error.response.data : error.message);
      throw error;
    });
};

export const changeAppointmentStatus = (appointmentId, status) => {
  return authApi.post('/appointments/change-status/', {
    appointment_id: appointmentId,
    appointment_status: status
  });
};

export const editAppointment = (appointmentId, appointmentData) => {
  if (typeof appointmentData !== 'object' || appointmentData === null) {
    console.error('Invalid appointment data received:', appointmentData);
    return Promise.reject(new Error('Invalid appointment data'));
  }

  const patientData = appointmentData.patient || {};

  const formattedData = {
    date: appointmentData.date,
    time: appointmentData.time,
    doctor_id: appointmentData.doctor_id,
    status: appointmentData.status || 'UNC',
    patient: {
      first_name: patientData.first_name || '',
      last_name: patientData.last_name || '',
      contact_number: patientData.contact_number || '',
    },
    booked_by_patient: appointmentData.booked_by_patient
  };

  return authApi.put(`/appointments/${appointmentId}/`, formattedData)
    .catch(error => {
      if (error.response && error.response.status === 401) {
        // Clear invalid tokens
        localStorage.removeItem('authToken');
        localStorage.removeItem('patientId');
      }
      console.error('Error in editAppointment:', error.response?.data || error.message);
      throw error;
    });
};

export const getDoctorWithProfilePicture = (doctorId) => {
  return api.get(`/doctors/${doctorId}/?with_profile_picture=1`);
};

export const getAllDoctorData = () => {
  return api.get('/available_appointments/');
};

export const createPatientAndGenerateOTP = (contactNumber) => {
  return api.post('/patients/create_and_generate_otp/', { contact_number: contactNumber });
};

export const getQuestionnaire = (id) => {
  return api.get(`/questionnaires/${id}/`)
}

export default api;