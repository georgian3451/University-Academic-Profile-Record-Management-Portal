// Centralized API Client & UI Helpers for VGU Academic Profile Portal

const API = {
  async request(url, options = {}) {
    const defaultHeaders = {
      'Accept': 'application/json'
    };

    if (!(options.body instanceof FormData)) {
      defaultHeaders['Content-Type'] = 'application/json';
    }

    const config = {
      ...options,
      headers: {
        ...defaultHeaders,
        ...(options.headers || {})
      }
    };

    try {
      const response = await fetch(url, config);
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.message || `Request failed with status ${response.status}`);
      }
      return data;
    } catch (err) {
      console.error(`API Error on [${url}]:`, err);
      throw err;
    }
  },

  // Auth APIs
  login(role, identifier, password) {
    return this.request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ role, identifier, password })
    });
  },

  registerStudent(studentData) {
    return this.request('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(studentData)
    });
  },

  requestOtp(role, identifier) {
    return this.request('/api/auth/forgot-password/request-otp', {
      method: 'POST',
      body: JSON.stringify({ role, identifier })
    });
  },

  verifyOtp(identifier, otp) {
    return this.request('/api/auth/forgot-password/verify-otp', {
      method: 'POST',
      body: JSON.stringify({ identifier, otp })
    });
  },

  resetPassword(identifier, otp, new_password) {
    return this.request('/api/auth/forgot-password/reset', {
      method: 'POST',
      body: JSON.stringify({ identifier, otp, new_password })
    });
  },

  // Student APIs
  getStudentProfile(enrollment_no) {
    return this.request(`/api/student/profile?enrollment_no=${encodeURIComponent(enrollment_no)}`);
  },

  saveBasicDetails(details) {
    return this.request('/api/student/basic-details', {
      method: 'POST',
      body: JSON.stringify(details)
    });
  },

  uploadStudentFile(formData) {
    return this.request('/api/student/upload', {
      method: 'POST',
      body: formData
    });
  },

  saveStudentSection(category, enrollment_no, data) {
    return this.request(`/api/student/section/${category}`, {
      method: 'POST',
      body: JSON.stringify({ enrollment_no, data })
    });
  },

  saveSemesterMarks(enrollment_no, semester, sgpa, marksheet_file) {
    return this.request('/api/student/marks', {
      method: 'POST',
      body: JSON.stringify({ enrollment_no, semester, sgpa, marksheet_file })
    });
  },

  createSubmission(submissionData) {
    return this.request('/api/student/submission', {
      method: 'POST',
      body: JSON.stringify(submissionData)
    });
  },

  // Admin APIs
  getStudentsList(filters = {}) {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') {
        params.append(k, v);
      }
    });
    return this.request(`/api/admin/students?${params.toString()}`);
  },

  verifyStudentAccount(enrollment_no, status, verified_by = 'ADMIN') {
    return this.request(`/api/admin/students/${encodeURIComponent(enrollment_no)}/verify`, {
      method: 'POST',
      body: JSON.stringify({ status, verified_by })
    });
  },

  getStudentDetails(enrollment_no) {
    return this.request(`/api/admin/student/${encodeURIComponent(enrollment_no)}`);
  },

  getSubmissions(status = 'All', type = 'All') {
    return this.request(`/api/admin/submissions?status=${encodeURIComponent(status)}&type=${encodeURIComponent(type)}`);
  },

  reviewSubmission(submissionId, status, admin_comment = '') {
    return this.request(`/api/admin/submissions/${submissionId}/review`, {
      method: 'POST',
      body: JSON.stringify({ status, admin_comment })
    });
  },

  getRequirements() {
    return this.request('/api/admin/requirements');
  },

  createRequirement(data) {
    return this.request('/api/admin/requirements', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  getNonSubmitters(reqId) {
    return this.request(`/api/admin/requirements/${reqId}/non-submitters`);
  },

  bulkEmailNonSubmitters(reqId) {
    return this.request(`/api/admin/requirements/${reqId}/bulk-email`, {
      method: 'POST'
    });
  },

  getAnalytics() {
    return this.request('/api/admin/analytics');
  },

  getEmailLogs() {
    return this.request('/api/admin/email-logs');
  },

  // Events & Hackathons / Workshops / Seminars
  getAdminEvents() {
    return this.request('/api/admin/events');
  },

  createAdminEvent(data) {
    return this.request('/api/admin/events', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  deleteAdminEvent(eventId) {
    return this.request(`/api/admin/events/${eventId}`, {
      method: 'DELETE'
    });
  },

  // FAQs
  getAdminFaqs() {
    return this.request('/api/admin/faqs');
  },

  createAdminFaq(data) {
    return this.request('/api/admin/faqs', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  deleteAdminFaq(faqId) {
    return this.request(`/api/admin/faqs/${faqId}`, {
      method: 'DELETE'
    });
  },

  // Support Queries
  getAdminQueries(status = 'All', category = 'All') {
    return this.request(`/api/admin/queries?status=${encodeURIComponent(status)}&category=${encodeURIComponent(category)}`);
  },

  respondToQuery(queryId, status, admin_response) {
    return this.request(`/api/admin/queries/${queryId}/respond`, {
      method: 'POST',
      body: JSON.stringify({ status, admin_response })
    });
  },

  // Student portal API methods
  getStudentAnnouncements(enrollmentNo) {
    return this.request(`/api/student/announcements?enrollment_no=${encodeURIComponent(enrollmentNo)}`);
  },

  getStudentEvents() {
    return this.request('/api/student/events');
  },

  getStudentFaqs() {
    return this.request('/api/student/faqs');
  },

  getStudentQueries(enrollmentNo) {
    return this.request(`/api/student/queries?enrollment_no=${encodeURIComponent(enrollmentNo)}`);
  },

  submitStudentQuery(data) {
    return this.request('/api/student/queries', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }
};

// UI Notification Toast Engine
const Toast = {
  show(message, type = 'info', duration = 4000) {
    let container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    let icon = 'ℹ️';
    if (type === 'success') icon = '✅';
    if (type === 'error') icon = '❌';
    if (type === 'warning') icon = '⚠️';

    toast.innerHTML = `<span>${icon}</span> <div>${message}</div>`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(-6px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, duration);
  },

  success(msg) { this.show(msg, 'success'); },
  error(msg) { this.show(msg, 'error'); },
  warning(msg) { this.show(msg, 'warning'); },
  info(msg) { this.show(msg, 'info'); }
};
