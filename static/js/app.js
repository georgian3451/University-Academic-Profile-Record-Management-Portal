// Main Application Controller & View Manager - VGU Academic Portal

const App = {
  currentUser: null,
  otpContext: {
    role: 'student',
    identifier: '',
    otp: ''
  },

  init() {
    this.setupGlobalEvents();
    this.checkSession();
  },

  checkSession() {
    const saved = localStorage.getItem('vgu_user_session');
    if (saved) {
      try {
        const user = JSON.parse(saved);
        if (user && user.role) {
          this.launchUserSession(user);
          return;
        }
      } catch (e) {
        localStorage.removeItem('vgu_user_session');
      }
    }
    this.showView('view-splash');
  },

  showView(viewId) {
    document.querySelectorAll('.app-view').forEach(v => v.classList.add('hidden'));
    const target = document.getElementById(viewId);
    if (target) target.classList.remove('hidden');

    const topbar = document.getElementById('app-topbar');
    if (viewId === 'view-splash') {
      if (topbar) topbar.classList.add('hidden');
    } else {
      if (topbar) topbar.classList.remove('hidden');
    }
  },

  async launchUserSession(user) {
    this.currentUser = user;
    localStorage.setItem('vgu_user_session', JSON.stringify(user));

    const topName = document.getElementById('topbar-name');
    const topRole = document.getElementById('topbar-role');
    const topAvatar = document.getElementById('topbar-avatar');

    if (topName) topName.textContent = user.name || user.identifier;
    if (topRole) topRole.textContent = user.role === 'admin' ? 'VGU Faculty Admin' : 'VGU Student Portal';
    if (topAvatar) topAvatar.src = user.role === 'admin' ? '/static/images/avatars/admin.svg' : '/static/images/avatars/student1.svg';

    if (user.role === 'student') {
      this.showView('view-student-portal');
      await StudentController.init(user);
    } else if (user.role === 'admin') {
      this.showView('view-admin-portal');
      await AdminController.init(user);
    }
  },

  logout() {
    localStorage.removeItem('vgu_user_session');
    this.currentUser = null;
    Toast.info('Logged out successfully.');
    this.showView('view-splash');
  },

  fillDemoCredentials(role, identifier, password) {
    if (role === 'student') {
      document.getElementById('student-login-id').value = identifier;
      document.getElementById('student-login-pw').value = password;
      Toast.info(`Filled Student credentials (${identifier})`);
    } else if (role === 'admin') {
      document.getElementById('admin-login-id').value = identifier;
      document.getElementById('admin-login-pw').value = password;
      Toast.info(`Filled Admin credentials (${identifier})`);
    }
  },

  async handleStudentLogin(e) {
    e.preventDefault();
    const id = document.getElementById('student-login-id').value.trim();
    const pw = document.getElementById('student-login-pw').value.trim();

    if (!id || !pw) {
      Toast.warning('Please enter Enrollment Number and Password.');
      return;
    }

    try {
      const res = await API.login('student', id, pw);
      if (res.success) {
        Toast.success(`Welcome back, ${res.user.name}!`);
        await this.launchUserSession(res.user);
      }
    } catch (err) {
      Toast.error(err.message);
    }
  },

  async handleAdminLogin(e) {
    e.preventDefault();
    const id = document.getElementById('admin-login-id').value.trim();
    const pw = document.getElementById('admin-login-pw').value.trim();

    if (!id || !pw) {
      Toast.warning('Please enter Employee ID and Password.');
      return;
    }

    try {
      const res = await API.login('admin', id, pw);
      if (res.success) {
        Toast.success(`Welcome back, ${res.user.name}!`);
        await this.launchUserSession(res.user);
      }
    } catch (err) {
      Toast.error(err.message);
    }
  },

  // Student Registration Modal & Handler
  openRegisterModal() {
    const form = document.getElementById('form-student-register');
    if (form) form.reset();
    document.getElementById('modal-student-register').classList.add('active');
  },

  async handleStudentRegistration(e) {
    e.preventDefault();
    const pw = document.getElementById('reg-password').value.trim();
    const confirmPw = document.getElementById('reg-confirm-password').value.trim();

    if (pw !== confirmPw) {
      Toast.warning('Passwords do not match. Please re-enter.');
      return;
    }

    const payload = {
      enrollment_no: document.getElementById('reg-enrollment').value.trim().toUpperCase(),
      full_name: document.getElementById('reg-name').value.trim(),
      email: document.getElementById('reg-email').value.trim().toLowerCase(),
      mobile: document.getElementById('reg-mobile').value.trim(),
      branch: document.getElementById('reg-branch').value,
      program: document.getElementById('reg-program').value,
      class_name: document.getElementById('reg-class').value.trim(),
      section: document.getElementById('reg-section').value.trim(),
      semester: parseInt(document.getElementById('reg-semester').value) || 1,
      semester_year: document.getElementById('reg-year').value,
      dob: document.getElementById('reg-dob').value,
      password: pw
    };

    try {
      const res = await API.registerStudent(payload);
      if (res.success) {
        Toast.success(res.message, 6000);
        document.getElementById('modal-student-register').classList.remove('active');
        // Pre-fill student login
        document.getElementById('student-login-id').value = payload.enrollment_no;
        document.getElementById('student-login-pw').value = pw;
      }
    } catch (err) {
      Toast.error('Registration failed: ' + err.message);
    }
  },

  // Forgot Password Flow
  openForgotPassword(role) {
    this.otpContext.role = role;
    document.getElementById('fp-role').value = role;
    document.getElementById('fp-id-label').textContent = role === 'student' ? 'Enrollment Number' : 'Employee ID';
    document.getElementById('fp-identifier').value = '';

    document.getElementById('fp-step-1').classList.remove('hidden');
    document.getElementById('fp-step-2').classList.add('hidden');
    document.getElementById('fp-step-3').classList.add('hidden');

    document.getElementById('modal-forgot-password').classList.add('active');
  },

  async requestOtp() {
    const id = document.getElementById('fp-identifier').value.trim();
    const role = document.getElementById('fp-role').value;

    if (!id) {
      Toast.warning(`Please enter your ${role === 'student' ? 'Enrollment Number' : 'Employee ID'}.`);
      return;
    }

    try {
      const res = await API.requestOtp(role, id);
      if (res.success) {
        this.otpContext.identifier = id;
        this.otpContext.otp = res.simulated_otp;

        document.getElementById('fp-masked-mobile').textContent = res.masked_mobile;
        document.getElementById('fp-step-1').classList.add('hidden');
        document.getElementById('fp-step-2').classList.remove('hidden');
        document.getElementById('fp-otp-input').value = '';

        this.showSimulatedSmsToast(res.masked_mobile, res.simulated_otp);
      }
    } catch (err) {
      Toast.error(err.message);
    }
  },

  showSimulatedSmsToast(mobile, otp) {
    let oldToast = document.querySelector('.sms-toast');
    if (oldToast) oldToast.remove();

    const toast = document.createElement('div');
    toast.className = 'sms-toast';
    toast.innerHTML = `
      <div class="sms-icon">📱</div>
      <div class="sms-content">
        <h4>VGU SMS Gateway</h4>
        <p>Vivekananda Global University Auth code for ${mobile}:</p>
        <div class="sms-otp-code">${otp}</div>
        <p style="font-size: 0.72rem; color: var(--text-muted); margin-top: 0.2rem;">Valid for 5 minutes.</p>
        <button class="btn btn-secondary btn-sm" style="margin-top: 0.5rem; font-size: 0.75rem; padding: 0.25rem 0.6rem;" onclick="document.getElementById('fp-otp-input').value = '${otp}'; this.parentElement.parentElement.remove();">
          Copy Code to Input & Close
        </button>
      </div>
    `;
    document.body.appendChild(toast);
  },

  async verifyOtp() {
    const otp = document.getElementById('fp-otp-input').value.trim();
    if (!otp || otp.length !== 6) {
      Toast.warning('Please enter the 6-digit OTP.');
      return;
    }

    try {
      const res = await API.verifyOtp(this.otpContext.identifier, otp);
      if (res.success) {
        this.otpContext.otp = otp;
        document.getElementById('fp-step-2').classList.add('hidden');
        document.getElementById('fp-step-3').classList.remove('hidden');
        document.getElementById('fp-new-pw').value = '';
        Toast.success('OTP verified successfully!');
      }
    } catch (err) {
      Toast.error(err.message);
    }
  },

  async resetPassword() {
    const pw = document.getElementById('fp-new-pw').value.trim();
    if (!pw || pw.length < 6) {
      Toast.warning('Password must be at least 6 characters long.');
      return;
    }

    try {
      const res = await API.resetPassword(this.otpContext.identifier, this.otpContext.otp, pw);
      if (res.success) {
        Toast.success(res.message);
        document.getElementById('modal-forgot-password').classList.remove('active');

        if (this.otpContext.role === 'student') {
          document.getElementById('student-login-id').value = this.otpContext.identifier;
          document.getElementById('student-login-pw').value = pw;
        } else {
          document.getElementById('admin-login-id').value = this.otpContext.identifier;
          document.getElementById('admin-login-pw').value = pw;
        }
      }
    } catch (err) {
      Toast.error(err.message);
    }
  },

  setupGlobalEvents() {
    const studentForm = document.getElementById('form-student-login');
    if (studentForm) studentForm.onsubmit = (e) => this.handleStudentLogin(e);

    const adminForm = document.getElementById('form-admin-login');
    if (adminForm) adminForm.onsubmit = (e) => this.handleAdminLogin(e);

    const registerForm = document.getElementById('form-student-register');
    if (registerForm) registerForm.onsubmit = (e) => this.handleStudentRegistration(e);

    document.querySelectorAll('.modal-close, .modal-cancel').forEach(btn => {
      btn.onclick = (e) => {
        const modal = e.target.closest('.modal-backdrop');
        if (modal) modal.classList.remove('active');
      };
    });

    document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
      backdrop.onclick = (e) => {
        if (e.target === backdrop) {
          backdrop.classList.remove('active');
        }
      };
    });

    document.querySelectorAll('[data-student-tab]').forEach(btn => {
      btn.onclick = () => {
        document.querySelectorAll('[data-student-tab]').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.student-tab-panel').forEach(p => p.classList.add('hidden'));

        btn.classList.add('active');
        const targetId = btn.getAttribute('data-student-tab');
        const targetPanel = document.getElementById(targetId);
        if (targetPanel) targetPanel.classList.remove('hidden');
      };
    });

    document.querySelectorAll('[data-admin-tab]').forEach(btn => {
      btn.onclick = () => {
        document.querySelectorAll('[data-admin-tab]').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.admin-tab-panel').forEach(p => p.classList.add('hidden'));

        btn.classList.add('active');
        const targetId = btn.getAttribute('data-admin-tab');
        const targetPanel = document.getElementById(targetId);
        if (targetPanel) targetPanel.classList.remove('hidden');
      };
    });
  }
};

window.addEventListener('DOMContentLoaded', () => App.init());
