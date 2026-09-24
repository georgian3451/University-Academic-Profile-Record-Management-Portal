// Student Dashboard Controller - VGU Academic Portal

const StudentController = {
  currentStudent: null,
  profileData: null,
  extras: {},
  marks: [],
  submissions: [],
  requirements: [],

  async init(user, profile) {
    this.currentStudent = user;
    this.profileData = profile;
    await this.refreshProfile();
    this.setupEventListeners();
  },

  async refreshProfile() {
    try {
      const res = await API.getStudentProfile(this.currentStudent.identifier);
      if (res.success) {
        this.profileData = res.profile;
        this.extras = res.extras || {};
        this.marks = res.marks || [];
        this.submissions = res.submissions || [];
        this.requirements = res.requirements || [];

        this.applyVerificationGate();
        this.renderCompleteness();
        this.renderBasicDetails();
        this.renderOptionalSections();
        this.renderSubmissions();
        this.renderRequirements();
      }
    } catch (err) {
      Toast.error('Failed to load profile details: ' + err.message);
    }
  },

  applyVerificationGate() {
    const isVerified = (this.profileData.verification_status === 'Verified');
    const pendingBanner = document.getElementById('student-pending-banner');
    const verifiedBadge = document.getElementById('student-verified-badge');

    if (pendingBanner) {
      if (isVerified) {
        pendingBanner.classList.add('hidden');
      } else {
        pendingBanner.classList.remove('hidden');
      }
    }

    if (verifiedBadge) {
      if (isVerified) {
        verifiedBadge.className = 'status-pill status-approved';
        verifiedBadge.innerHTML = '🛡️ Verified Profile';
      } else if (this.profileData.verification_status === 'Rejected') {
        verifiedBadge.className = 'status-pill status-rejected';
        verifiedBadge.innerHTML = '❌ Registration Rejected';
      } else {
        verifiedBadge.className = 'status-pill status-pending';
        verifiedBadge.innerHTML = '⏳ Pending Verification';
      }
    }

    // Toggle disabled state on all form elements and action buttons
    const basicForm = document.getElementById('student-basic-form');
    if (basicForm) {
      basicForm.querySelectorAll('input:not(#bd-enrollment_no), select').forEach(el => {
        el.disabled = !isVerified;
      });
      const submitBtn = basicForm.querySelector('button[type="submit"]');
      if (submitBtn) {
        submitBtn.disabled = !isVerified;
        submitBtn.title = isVerified ? '' : 'Verification required to edit profile';
      }
    }

    // Photo change button
    const photoWrap = document.querySelector('.photo-btn-wrap');
    if (photoWrap) {
      photoWrap.style.display = isVerified ? 'block' : 'none';
    }

    // Optional section buttons
    const lockableButtons = [
      'btn-save-links',
      'btn-add-project-modal',
      'btn-upload-cert-modal',
      'btn-add-hack-modal',
      'btn-add-workshop-modal',
      'btn-add-seminar-modal'
    ];
    lockableButtons.forEach(id => {
      const btn = document.getElementById(id);
      if (btn) {
        btn.disabled = !isVerified;
        if (!isVerified) btn.classList.add('btn-disabled');
        else btn.classList.remove('btn-disabled');
      }
    });

    // Tag inputs
    document.querySelectorAll('.tag-input').forEach(input => {
      input.disabled = !isVerified;
      input.placeholder = isVerified ? input.getAttribute('data-placeholder') || input.placeholder : 'Locked (Pending Verification)';
    });
  },

  renderCompleteness() {
    const pct = this.profileData.completeness_pct || 0;
    const meterNumber = document.getElementById('student-meter-number');
    const meterFill = document.getElementById('student-meter-fill');
    const progressBar = document.getElementById('student-progress-fill');
    const badge = document.getElementById('student-completeness-badge');
    const desc = document.getElementById('student-completeness-desc');

    if (meterNumber) meterNumber.textContent = `${Math.round(pct)}%`;
    if (progressBar) progressBar.style.width = `${pct}%`;

    const circumference = 238.76;
    if (meterFill) {
      const offset = circumference - (pct / 100) * circumference;
      meterFill.style.strokeDasharray = `${circumference}`;
      meterFill.style.strokeDashoffset = `${offset}`;
    }

    if (badge && desc) {
      if (this.profileData.verification_status !== 'Verified') {
        badge.className = 'completeness-badge badge-incomplete';
        badge.textContent = 'Verification Pending';
        desc.textContent = 'Your profile is awaiting administrative review. Data entry will unlock upon verification.';
      } else if (pct >= 90) {
        badge.className = 'completeness-badge badge-excellent';
        badge.textContent = 'Placement Ready ★';
        desc.textContent = 'Outstanding! Your academic profile meets all top campus placement criteria at VGU.';
      } else if (pct >= 60) {
        badge.className = 'completeness-badge badge-good';
        badge.textContent = 'Good Progress';
        desc.textContent = 'Upload your certificates, resume, and project proofs to reach 100% completeness.';
      } else {
        badge.className = 'completeness-badge badge-incomplete';
        badge.textContent = 'Profile Incomplete';
        desc.textContent = 'Please fill compulsory basic details and upload your photo & resume.';
      }
    }

    const checklist = this.profileData.checklist || {};
    const checklistContainer = document.getElementById('completeness-checklist');
    if (checklistContainer) {
      const items = [
        { label: 'Basic Details', done: checklist.basic_details },
        { label: 'Profile Photo', done: checklist.photo },
        { label: 'Coding Links', done: checklist.links },
        { label: 'Skills & Roles', done: checklist.skills },
        { label: 'Semester Marks', done: checklist.marks },
        { label: 'Certificates', done: checklist.certificates },
        { label: 'Hackathons', done: checklist.hackathons },
        { label: 'Seminars/Events', done: checklist.seminars },
        { label: 'Workshops', done: checklist.workshops },
        { label: 'Projects', done: checklist.projects },
        { label: 'Resume', done: checklist.resume }
      ];

      checklistContainer.innerHTML = items.map(item => `
        <span class="status-pill ${item.done ? 'status-approved' : 'status-pending'}">
          ${item.done ? '✓' : '○'} ${item.label}
        </span>
      `).join('');
    }
  },

  renderBasicDetails() {
    const p = this.profileData || {};
    const fields = [
      'enrollment_no', 'full_name', 'dob', 'branch', 'program',
      'class_name', 'section', 'semester', 'mobile', 'email', 'semester_year'
    ];

    fields.forEach(field => {
      const el = document.getElementById(`bd-${field}`);
      if (el && p[field] !== undefined && p[field] !== null) {
        el.value = p[field];
      }
    });

    const photoEl = document.getElementById('student-photo-preview');
    if (photoEl) {
      photoEl.src = p.photo_path || '/static/images/avatars/default.svg';
    }

    const topAvatar = document.getElementById('topbar-avatar');
    const topName = document.getElementById('topbar-name');
    if (topAvatar) topAvatar.src = p.photo_path || '/static/images/avatars/default.svg';
    if (topName) topName.textContent = p.full_name || this.currentStudent.name;
  },

  renderOptionalSections() {
    const links = this.extras.links || {};
    ['linkedin', 'github', 'leetcode', 'codeforces'].forEach(k => {
      const el = document.getElementById(`link-${k}`);
      if (el) el.value = links[k] || '';
    });

    const skills = this.extras.skills || {};
    this.renderTagList('tags-soft-skills', skills.soft_skills || []);
    this.renderTagList('tags-tech-skills', skills.technical_skills || []);
    this.renderTagList('tags-target-roles', skills.target_roles || []);

    this.renderMarksTable();
    this.renderProjectsList();
    this.renderHackathonsList();
    this.renderSeminarsList();
    this.renderWorkshopsList();
    this.renderResumeView();
  },

  renderTagList(containerId, tagArray) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const input = container.querySelector('.tag-input');
    const chips = container.querySelectorAll('.tag-chip');
    chips.forEach(c => c.remove());

    const isVerified = (this.profileData.verification_status === 'Verified');

    tagArray.forEach(tag => {
      const chip = document.createElement('span');
      chip.className = 'tag-chip';
      chip.innerHTML = `${tag} ${isVerified ? `<span class="tag-remove" onclick="StudentController.removeTag('${containerId}', '${tag}')">&times;</span>` : ''}`;
      container.insertBefore(chip, input);
    });
  },

  removeTag(containerId, tagToRemove) {
    if (this.profileData.verification_status !== 'Verified') {
      Toast.warning('Verification required before modifying skills.');
      return;
    }
    const skills = this.extras.skills || { soft_skills: [], technical_skills: [], target_roles: [] };
    if (containerId === 'tags-soft-skills') {
      skills.soft_skills = (skills.soft_skills || []).filter(t => t !== tagToRemove);
    } else if (containerId === 'tags-tech-skills') {
      skills.technical_skills = (skills.technical_skills || []).filter(t => t !== tagToRemove);
    } else if (containerId === 'tags-target-roles') {
      skills.target_roles = (skills.target_roles || []).filter(t => t !== tagToRemove);
    }
    this.saveSkillsData(skills);
  },

  async addTag(containerId, inputEl) {
    if (this.profileData.verification_status !== 'Verified') {
      Toast.warning('Your account is pending verification by admin.');
      return;
    }
    const val = inputEl.value.trim();
    if (!val) return;

    const skills = this.extras.skills || { soft_skills: [], technical_skills: [], target_roles: [] };
    if (containerId === 'tags-soft-skills') {
      skills.soft_skills = [...(skills.soft_skills || []), val];
    } else if (containerId === 'tags-tech-skills') {
      skills.technical_skills = [...(skills.technical_skills || []), val];
    } else if (containerId === 'tags-target-roles') {
      skills.target_roles = [...(skills.target_roles || []), val];
    }
    inputEl.value = '';
    await this.saveSkillsData(skills);
  },

  async saveSkillsData(skills) {
    try {
      const res = await API.saveStudentSection('skills', this.currentStudent.identifier, skills);
      if (res.success) {
        this.extras.skills = skills;
        this.profileData.completeness_pct = res.completeness.percentage;
        this.profileData.checklist = res.completeness.checklist;
        this.renderCompleteness();
        this.renderTagList('tags-soft-skills', skills.soft_skills || []);
        this.renderTagList('tags-tech-skills', skills.technical_skills || []);
        this.renderTagList('tags-target-roles', skills.target_roles || []);
        Toast.success('Skills updated');
      }
    } catch (err) {
      Toast.error('Failed to save skills: ' + err.message);
    }
  },

  renderMarksTable() {
    const tbody = document.getElementById('student-marks-tbody');
    if (!tbody) return;

    const isVerified = (this.profileData.verification_status === 'Verified');
    const marksMap = {};
    this.marks.forEach(m => { marksMap[m.semester] = m; });

    let rows = '';
    for (let sem = 1; sem <= 8; sem++) {
      const m = marksMap[sem];
      const sgpaVal = m ? m.sgpa.toFixed(2) : '-';
      const fileLink = m && m.marksheet_file ? `<a href="/${m.marksheet_file}" target="_blank" class="btn-link">📄 View Marksheet</a>` : '<span class="text-muted">Not uploaded</span>';
      
      rows += `
        <tr>
          <td><strong>Semester ${sem}</strong></td>
          <td>${sgpaVal}</td>
          <td>${fileLink}</td>
          <td>
            <button class="btn btn-secondary btn-sm" onclick="StudentController.openMarksModal(${sem})" ${isVerified ? '' : 'disabled'}>
              ${m ? 'Edit / Re-upload' : '+ Add SGPA'}
            </button>
          </td>
        </tr>
      `;
    }
    tbody.innerHTML = rows;

    const cgpaDisplay = document.getElementById('student-cgpa-display');
    if (cgpaDisplay) {
      cgpaDisplay.textContent = this.profileData.cgpa ? this.profileData.cgpa.toFixed(2) : '0.00';
    }
  },

  renderProjectsList() {
    const list = document.getElementById('student-projects-list');
    if (!list) return;

    const isVerified = (this.profileData.verification_status === 'Verified');
    const projects = this.extras.projects || [];
    if (projects.length === 0) {
      list.innerHTML = `<div class="text-muted" style="padding: 1.5rem; text-align: center;">No projects added yet. Click "+ Add New Project" to showcase your builds.</div>`;
      return;
    }

    list.innerHTML = projects.map((p, idx) => `
      <div class="profile-card" style="margin-bottom: 1rem; border-left: 3px solid var(--primary);">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.5rem;">
          <div>
            <h4 style="font-size: 1.05rem; font-weight: 700;">${p.title}</h4>
            <div style="font-size: 0.8rem; color: #60a5fa; margin-top: 0.2rem;">Tech Stack: ${p.tech_stack || 'N/A'}</div>
          </div>
          ${isVerified ? `<button class="btn btn-secondary btn-sm" onclick="StudentController.deleteProject(${idx})">Delete</button>` : ''}
        </div>
        <p style="font-size: 0.88rem; color: var(--text-light); margin-bottom: 0.75rem;">${p.description || ''}</p>
        <div style="display: flex; gap: 1rem; font-size: 0.82rem; flex-wrap: wrap;">
          ${p.demo_url ? `<a href="${p.demo_url}" target="_blank" class="btn-link">🔗 Live Demo</a>` : ''}
          ${p.repo_url ? `<a href="${p.repo_url}" target="_blank" class="btn-link">💻 Source Code</a>` : ''}
          ${p.file_path ? `<a href="/${p.file_path}" target="_blank" class="btn-link">📄 Documentation</a>` : ''}
        </div>
      </div>
    `).join('');
  },

  deleteProject(idx) {
    if (this.profileData.verification_status !== 'Verified') {
      Toast.warning('Verification required before deleting items.');
      return;
    }
    const projects = (this.extras.projects || []).filter((_, i) => i !== idx);
    API.saveStudentSection('projects', this.currentStudent.identifier, projects).then(res => {
      this.extras.projects = projects;
      this.renderProjectsList();
      this.profileData.completeness_pct = res.completeness.percentage;
      this.renderCompleteness();
      Toast.success('Project removed');
    });
  },

  renderHackathonsList() {
    const list = document.getElementById('student-hackathons-list');
    if (!list) return;

    const items = this.extras.hackathons || [];
    if (items.length === 0) {
      list.innerHTML = `<div class="text-muted" style="padding: 1rem; text-align: center;">No hackathons recorded yet.</div>`;
      return;
    }

    list.innerHTML = items.map(h => `
      <div class="profile-card" style="margin-bottom: 0.85rem; padding: 1rem 1.25rem;">
        <div style="display: flex; justify-content: space-between;">
          <h4 style="font-weight: 700;">${h.name}</h4>
          <span class="status-pill status-approved">${h.result || 'Participant'}</span>
        </div>
        <div style="font-size: 0.82rem; color: var(--text-secondary); margin-top: 0.3rem;">
          Role: ${h.role || 'Member'} | Project: ${h.project_name || 'N/A'} | Date: ${h.date || 'N/A'}
        </div>
        ${h.proof_file ? `<div style="margin-top: 0.4rem;"><a href="/${h.proof_file}" target="_blank" class="btn-link">📄 View Proof Document</a></div>` : ''}
      </div>
    `).join('');
  },

  renderSeminarsList() {
    const orgList = document.getElementById('seminars-organized-list');
    const partList = document.getElementById('seminars-participated-list');
    const semData = this.extras.seminars || { organized: [], participated: [] };

    if (orgList) {
      const orgs = semData.organized || [];
      orgList.innerHTML = orgs.length === 0 ? '<div class="text-muted">No organized seminars listed.</div>' :
        orgs.map(s => `
          <div style="padding: 0.75rem 0; border-bottom: 1px solid var(--border-subtle);">
            <div style="display: flex; justify-content: space-between; align-items: flex-start;">
              <div>
                <strong>${s.title}</strong>
                <div style="font-size: 0.8rem; color: var(--text-secondary); margin-top: 0.15rem;">
                  Role: ${s.role || 'Organizer'} | Date: ${s.date || ''}
                </div>
                ${s.proof_file ? `<div style="margin-top: 0.3rem;"><a href="/${s.proof_file}" target="_blank" class="btn-link">📄 Report/Proof</a></div>` : ''}
              </div>
              ${s.image_url ? `
                <a href="${s.image_url}" target="_blank" title="Click to view event photo">
                  <img src="${s.image_url}" alt="Seminar Photo" style="width: 54px; height: 54px; border-radius: 6px; object-fit: cover; border: 1px solid rgba(255,255,255,0.2);">
                </a>` : ''}
            </div>
          </div>
        `).join('');
    }

    if (partList) {
      const parts = semData.participated || [];
      partList.innerHTML = parts.length === 0 ? '<div class="text-muted">No attended seminars listed.</div>' :
        parts.map(s => `
          <div style="padding: 0.75rem 0; border-bottom: 1px solid var(--border-subtle);">
            <div style="display: flex; justify-content: space-between; align-items: flex-start;">
              <div>
                <strong>${s.title}</strong>
                <div style="font-size: 0.8rem; color: var(--text-secondary); margin-top: 0.15rem;">
                  Organized By: ${s.organizer || 'N/A'} | Date: ${s.date || ''}
                </div>
                ${s.proof_file ? `<div style="margin-top: 0.3rem;"><a href="/${s.proof_file}" target="_blank" class="btn-link">📄 Certificate</a></div>` : ''}
              </div>
              ${s.image_url ? `
                <a href="${s.image_url}" target="_blank" title="Click to view photo">
                  <img src="${s.image_url}" alt="Seminar Photo" style="width: 54px; height: 54px; border-radius: 6px; object-fit: cover; border: 1px solid rgba(255,255,255,0.2);">
                </a>` : ''}
            </div>
          </div>
        `).join('');
    }
  },

  renderWorkshopsList() {
    const list = document.getElementById('workshops-list');
    if (!list) return;

    const items = this.extras.workshops || [];
    list.innerHTML = items.length === 0 ? '<div class="text-muted" style="padding: 1rem;">No workshops logged.</div>' :
      items.map(w => `
        <div class="profile-card" style="margin-bottom: 0.75rem; padding: 1rem;">
          <div style="display: flex; justify-content: space-between; align-items: flex-start;">
            <div>
              <h4 style="font-weight: 700;">${w.topic}</h4>
              <div style="font-size: 0.82rem; color: var(--text-secondary); margin-top: 0.2rem;">
                Conducted by: ${w.conducted_by || 'N/A'} | Date: ${w.date || 'N/A'}
              </div>
              ${w.proof_file ? `<div style="margin-top: 0.35rem;"><a href="/${w.proof_file}" target="_blank" class="btn-link">📄 Certificate</a></div>` : ''}
            </div>
            ${w.image_url ? `
              <a href="${w.image_url}" target="_blank" title="Workshop Event Image">
                <img src="${w.image_url}" alt="Workshop Photo" style="width: 60px; height: 60px; border-radius: 6px; object-fit: cover; border: 1px solid rgba(255,255,255,0.2);">
              </a>` : ''}
          </div>
        </div>
      `).join('');
  },

  renderResumeView() {
    const container = document.getElementById('resume-view-container');
    if (!container) return;

    const isVerified = (this.profileData.verification_status === 'Verified');
    const resData = this.extras.resumes || {};
    if (resData.filename) {
      container.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: space-between; background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.3); border-radius: var(--radius-md); padding: 1rem 1.25rem;">
          <div style="display: flex; align-items: center; gap: 0.85rem;">
            <span style="font-size: 1.8rem;">📄</span>
            <div>
              <div style="font-weight: 700; color: #f8fafc;">${resData.filename}</div>
              <div style="font-size: 0.78rem; color: var(--text-secondary);">Stored under /uploads/Students/${this.profileData.branch}/${this.profileData.section}/${this.currentStudent.identifier}/resume/</div>
            </div>
          </div>
          <div style="display: flex; gap: 0.75rem;">
            <a href="/${resData.file_path}" target="_blank" class="btn btn-secondary btn-sm">Download / View</a>
            ${isVerified ? `<button class="btn btn-primary btn-sm" onclick="document.getElementById('resume-file-input').click()">Replace Resume</button>` : ''}
          </div>
        </div>
      `;
    } else {
      container.innerHTML = `
        <div style="text-align: center; padding: 2rem; border: 2px dashed var(--border-subtle); border-radius: var(--radius-md);">
          <div style="font-size: 2rem; margin-bottom: 0.5rem;">📄</div>
          <h4 style="font-weight: 600; margin-bottom: 0.25rem;">No Resume Uploaded Yet</h4>
          <p style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 1rem;">Upload your updated PDF resume to boost placement visibility at VGU.</p>
          ${isVerified ? `<button class="btn btn-primary btn-sm" onclick="document.getElementById('resume-file-input').click()">Upload Resume (PDF)</button>` : '<span class="status-pill status-pending">Resume upload unlocked after verification</span>'}
        </div>
      `;
    }
  },

  renderSubmissions() {
    const tbody = document.getElementById('student-submissions-tbody');
    if (!tbody) return;

    if (this.submissions.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-muted); padding: 2rem;">No submissions yet. Upload certificates or requirement proofs to get verified.</td></tr>`;
      return;
    }

    tbody.innerHTML = this.submissions.map(s => {
      let statusBadge = `<span class="status-pill status-pending">⏳ Pending Review</span>`;
      if (s.status === 'Approved') {
        statusBadge = `<span class="status-pill status-approved">✅ Approved</span>`;
      } else if (s.status === 'Rejected') {
        statusBadge = `<span class="status-pill status-rejected">❌ Rejected</span>`;
      }

      const commentSnippet = s.admin_comment ? 
        `<div style="font-size: 0.8rem; color: #fb7185; margin-top: 0.25rem; font-style: italic;">Note: "${s.admin_comment}"</div>` : '';

      return `
        <tr>
          <td><strong>${s.title}</strong>${commentSnippet}</td>
          <td><span style="text-transform: capitalize;">${s.submission_type}</span></td>
          <td>${s.issuer_or_org || 'VGU'}</td>
          <td>
            ${s.file_path ? `<a href="/${s.file_path}" target="_blank" class="btn-link">📄 ${s.file_name || 'Proof File'}</a>` : '-'}
          </td>
          <td>${statusBadge}</td>
          <td style="font-size: 0.8rem; color: var(--text-muted);">${s.submitted_at ? s.submitted_at.split(' ')[0] : ''}</td>
        </tr>
      `;
    }).join('');
  },

  renderRequirements() {
    const container = document.getElementById('student-requirements-list');
    if (!container) return;

    const isVerified = (this.profileData.verification_status === 'Verified');

    if (this.requirements.length === 0) {
      container.innerHTML = `<div class="text-muted" style="padding: 1.5rem; text-align: center;">No pending VGU university requirements for your semester/branch.</div>`;
      return;
    }

    // Sort: compulsory first, then by deadline ascending
    const sorted = [...this.requirements].sort((a, b) => {
      if (b.is_compulsory !== a.is_compulsory) return b.is_compulsory - a.is_compulsory;
      return (a.deadline || '').localeCompare(b.deadline || '');
    });

    container.innerHTML = sorted.map(req => {
      const isCompulsory = !!req.is_compulsory;
      let statusTag = `<span class="status-pill status-pending">⏳ Not Submitted</span>`;
      let actionBtn = `<button class="btn btn-primary btn-sm" onclick="StudentController.openRequirementModal(${req.id}, '${req.title.replace(/'/g, "\\'")}')" ${isVerified ? '' : 'disabled'}>Submit Proof</button>`;

      if (req.student_submission_status === 'Approved') {
        statusTag = `<span class="status-pill status-approved">✅ Completed &amp; Verified</span>`;
        actionBtn = `<button class="btn btn-secondary btn-sm" disabled>Completed</button>`;
      } else if (req.student_submission_status === 'Pending') {
        statusTag = `<span class="status-pill status-pending">⏳ Under Faculty Review</span>`;
        actionBtn = `<button class="btn btn-secondary btn-sm" disabled>Under Review</button>`;
      } else if (req.student_submission_status === 'Rejected') {
        statusTag = `<span class="status-pill status-rejected">❌ Rejected</span>`;
        actionBtn = `<button class="btn btn-danger btn-sm" onclick="StudentController.openRequirementModal(${req.id}, '${req.title.replace(/'/g, "\\'")}')" ${isVerified ? '' : 'disabled'}>Re-submit Proof</button>`;
      }

      const compulsoryBadge = isCompulsory
        ? `<span class="status-pill" style="background: rgba(239,68,68,0.2); color: #f87171; border: 1px solid rgba(239,68,68,0.4); font-weight: 700;">&#128308; COMPULSORY</span>`
        : '';

      return `
        <div class="profile-card" style="margin-bottom: 1rem; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem; ${isCompulsory ? 'border-left: 3px solid #ef4444; background: rgba(239,68,68,0.04);' : ''}">
          <div style="flex: 1; min-width: 260px;">
            <div style="display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap; margin-bottom: 0.35rem;">
              <h4 style="font-weight: 700;">${req.title}</h4>
              ${compulsoryBadge}
              ${statusTag}
            </div>
            <p style="font-size: 0.85rem; color: var(--text-light); margin-bottom: 0.5rem;">${req.description}</p>
            <div style="font-size: 0.8rem; color: var(--text-secondary); display: flex; gap: 1.5rem; flex-wrap: wrap;">
              <span><strong>Deadline:</strong> <span style="color: #fbbf24;">${req.deadline}</span></span>
              <span><strong>Audience:</strong> ${req.target_branch} (${req.target_year})</span>
            </div>
            ${req.rejection_comment ? `<div style="color: #fb7185; font-size: 0.8rem; margin-top: 0.4rem;"><strong>Faculty Feedback:</strong> ${req.rejection_comment}</div>` : ''}
          </div>
          <div>${actionBtn}</div>
        </div>
      `;
    }).join('');
  },

  setupEventListeners() {
    const basicForm = document.getElementById('student-basic-form');
    if (basicForm) {
      basicForm.onsubmit = async (e) => {
        e.preventDefault();
        if (this.profileData.verification_status !== 'Verified') {
          Toast.warning('Your profile must be verified by admin before saving changes.');
          return;
        }
        const payload = {
          enrollment_no: this.currentStudent.identifier,
          full_name: document.getElementById('bd-full_name').value.trim(),
          dob: document.getElementById('bd-dob').value.trim(),
          branch: document.getElementById('bd-branch').value.trim(),
          program: document.getElementById('bd-program').value.trim(),
          class_name: document.getElementById('bd-class_name').value.trim(),
          section: document.getElementById('bd-section').value.trim(),
          semester: parseInt(document.getElementById('bd-semester').value) || 1,
          mobile: document.getElementById('bd-mobile').value.trim(),
          email: document.getElementById('bd-email').value.trim(),
          semester_year: document.getElementById('bd-semester_year').value.trim()
        };

        try {
          const res = await API.saveBasicDetails(payload);
          if (res.success) {
            Toast.success('Basic details saved successfully!');
            await this.refreshProfile();
          }
        } catch (err) {
          Toast.error(err.message);
        }
      };
    }

    const photoInput = document.getElementById('student-photo-input');
    if (photoInput) {
      photoInput.onchange = async () => {
        if (this.profileData.verification_status !== 'Verified') {
          Toast.warning('Profile photo can only be updated once verified by admin.');
          return;
        }
        if (!photoInput.files || !photoInput.files[0]) return;
        const file = photoInput.files[0];
        const formData = new FormData();
        formData.append('file', file);
        formData.append('enrollment_no', this.currentStudent.identifier);
        formData.append('category', 'basic_details');
        formData.append('is_photo', 'true');

        try {
          const res = await API.uploadStudentFile(formData);
          if (res.success) {
            Toast.success('Profile photo updated!');
            await this.refreshProfile();
          }
        } catch (err) {
          Toast.error('Photo upload failed: ' + err.message);
        }
      };
    }

    const resumeInput = document.getElementById('resume-file-input');
    if (resumeInput) {
      resumeInput.onchange = async () => {
        if (this.profileData.verification_status !== 'Verified') {
          Toast.warning('Resume can only be uploaded after profile verification.');
          return;
        }
        if (!resumeInput.files || !resumeInput.files[0]) return;
        const file = resumeInput.files[0];
        const formData = new FormData();
        formData.append('file', file);
        formData.append('enrollment_no', this.currentStudent.identifier);
        formData.append('category', 'resume');

        try {
          const res = await API.uploadStudentFile(formData);
          if (res.success) {
            Toast.success('Resume uploaded successfully!');
            await this.refreshProfile();
          }
        } catch (err) {
          Toast.error('Resume upload failed: ' + err.message);
        }
      };
    }

    const saveLinksBtn = document.getElementById('btn-save-links');
    if (saveLinksBtn) {
      saveLinksBtn.onclick = async () => {
        if (this.profileData.verification_status !== 'Verified') {
          Toast.warning('Verification required before saving social profile links.');
          return;
        }
        const links = {
          linkedin: document.getElementById('link-linkedin').value.trim(),
          github: document.getElementById('link-github').value.trim(),
          leetcode: document.getElementById('link-leetcode').value.trim(),
          codeforces: document.getElementById('link-codeforces').value.trim()
        };
        try {
          const res = await API.saveStudentSection('links', this.currentStudent.identifier, links);
          if (res.success) {
            Toast.success('Social and coding profiles updated!');
            await this.refreshProfile();
          }
        } catch (err) {
          Toast.error('Failed to save links: ' + err.message);
        }
      };
    }
  },

  openMarksModal(sem) {
    if (this.profileData.verification_status !== 'Verified') {
      Toast.warning('Your account is pending verification by admin.');
      return;
    }
    document.getElementById('modal-marks-sem').value = sem;
    document.getElementById('modal-marks-sgpa').value = '';
    const marksModal = document.getElementById('modal-marks');
    if (marksModal) marksModal.classList.add('active');
  },

  async submitMarks() {
    const sem = document.getElementById('modal-marks-sem').value;
    const sgpa = parseFloat(document.getElementById('modal-marks-sgpa').value);
    const fileInput = document.getElementById('modal-marks-file');

    if (isNaN(sgpa) || sgpa < 0 || sgpa > 10) {
      Toast.warning('Please enter a valid SGPA between 0.00 and 10.00');
      return;
    }

    let filePath = '';
    if (fileInput.files && fileInput.files[0]) {
      const formData = new FormData();
      formData.append('file', fileInput.files[0]);
      formData.append('enrollment_no', this.currentStudent.identifier);
      formData.append('category', 'marks');
      const uploadRes = await API.uploadStudentFile(formData);
      filePath = uploadRes.file ? uploadRes.file.file_path : '';
    }

    try {
      const res = await API.saveSemesterMarks(this.currentStudent.identifier, sem, sgpa, filePath);
      if (res.success) {
        Toast.success(`Semester ${sem} marks recorded!`);
        document.getElementById('modal-marks').classList.remove('active');
        await this.refreshProfile();
      }
    } catch (err) {
      Toast.error('Failed to record marks: ' + err.message);
    }
  },

  openCertificateModal() {
    if (this.profileData.verification_status !== 'Verified') {
      Toast.warning('Your profile is pending admin verification.');
      return;
    }
    document.getElementById('cert-title').value = '';
    document.getElementById('cert-issuer').value = '';
    document.getElementById('modal-certificate').classList.add('active');
  },

  async submitCertificate() {
    const title = document.getElementById('cert-title').value.trim();
    const issuer = document.getElementById('cert-issuer').value.trim();
    const fileInput = document.getElementById('cert-file');

    if (!title) {
      Toast.warning('Certificate title is required.');
      return;
    }

    let filePath = '';
    let fileName = '';
    if (fileInput.files && fileInput.files[0]) {
      const formData = new FormData();
      formData.append('file', fileInput.files[0]);
      formData.append('enrollment_no', this.currentStudent.identifier);
      formData.append('category', 'certificates');
      const uploadRes = await API.uploadStudentFile(formData);
      filePath = uploadRes.file ? uploadRes.file.file_path : '';
      fileName = fileInput.files[0].name;
    }

    try {
      const res = await API.createSubmission({
        enrollment_no: this.currentStudent.identifier,
        submission_type: 'certificate',
        title,
        issuer_or_org: issuer,
        file_path: filePath,
        file_name: fileName
      });
      if (res.success) {
        Toast.success('Certificate submitted for faculty verification!');
        document.getElementById('modal-certificate').classList.remove('active');
        await this.refreshProfile();
      }
    } catch (err) {
      Toast.error('Failed to submit certificate: ' + err.message);
    }
  },

  openRequirementModal(reqId, reqTitle) {
    if (this.profileData.verification_status !== 'Verified') {
      Toast.warning('Your profile is pending admin verification.');
      return;
    }
    document.getElementById('req-modal-id').value = reqId;
    document.getElementById('req-modal-title-display').textContent = reqTitle;
    document.getElementById('modal-requirement-submit').classList.add('active');
  },

  async submitRequirementProof() {
    const reqId = document.getElementById('req-modal-id').value;
    const notes = document.getElementById('req-modal-notes').value.trim();
    const fileInput = document.getElementById('req-modal-file');

    if (!fileInput.files || !fileInput.files[0]) {
      Toast.warning('Please select a proof file to upload.');
      return;
    }

    const formData = new FormData();
    formData.append('file', fileInput.files[0]);
    formData.append('enrollment_no', this.currentStudent.identifier);
    formData.append('category', 'other_uploaded_files');

    try {
      const uploadRes = await API.uploadStudentFile(formData);
      const filePath = uploadRes.file ? uploadRes.file.file_path : '';

      const subRes = await API.createSubmission({
        enrollment_no: this.currentStudent.identifier,
        requirement_id: parseInt(reqId),
        submission_type: 'requirement',
        title: document.getElementById('req-modal-title-display').textContent,
        issuer_or_org: notes || 'Student Requirement Proof',
        file_path: filePath,
        file_name: fileInput.files[0].name
      });

      if (subRes.success) {
        Toast.success('Requirement proof submitted successfully!');
        document.getElementById('modal-requirement-submit').classList.remove('active');
        await this.refreshProfile();
      }
    } catch (err) {
      Toast.error('Failed to submit requirement proof: ' + err.message);
    }
  },

  // Workshops with Optional Image
  async submitWorkshop() {
    if (this.profileData.verification_status !== 'Verified') {
      Toast.warning('Account verification required.');
      return;
    }
    const topic = document.getElementById('ws-topic').value.trim();
    const conducted_by = document.getElementById('ws-conducted').value.trim();
    const imgInput = document.getElementById('ws-image-file');

    if (!topic) {
      Toast.warning('Workshop topic is required.');
      return;
    }

    let imageUrl = '';
    if (imgInput.files && imgInput.files[0]) {
      const formData = new FormData();
      formData.append('file', imgInput.files[0]);
      formData.append('enrollment_no', this.currentStudent.identifier);
      formData.append('category', 'other_uploaded_files');
      try {
        const uploadRes = await API.uploadStudentFile(formData);
        imageUrl = '/' + uploadRes.file.file_path;
      } catch (e) {
        console.error('Image upload failed', e);
      }
    }

    const ws = {
      id: Date.now(),
      topic,
      conducted_by,
      image_url: imageUrl,
      date: new Date().toISOString().split('T')[0]
    };

    const cur = this.extras.workshops || [];
    cur.push(ws);
    try {
      const res = await API.saveStudentSection('workshops', this.currentStudent.identifier, cur);
      if (res.success) {
        this.extras.workshops = cur;
        this.renderWorkshopsList();
        this.profileData.completeness_pct = res.completeness.percentage;
        this.renderCompleteness();
        document.getElementById('modal-workshop').classList.remove('active');
        document.getElementById('ws-topic').value = '';
        document.getElementById('ws-conducted').value = '';
        if (imgInput) imgInput.value = '';
        Toast.success('Workshop logged with image!');
      }
    } catch (err) {
      Toast.error('Failed to save workshop: ' + err.message);
    }
  },

  // Seminars with Optional Image
  async submitSeminar() {
    if (this.profileData.verification_status !== 'Verified') {
      Toast.warning('Account verification required.');
      return;
    }
    const semType = document.getElementById('sem-type').value; // 'organized' or 'participated'
    const title = document.getElementById('sem-title').value.trim();
    const roleOrOrg = document.getElementById('sem-role-org').value.trim();
    const imgInput = document.getElementById('sem-image-file');

    if (!title) {
      Toast.warning('Seminar title is required.');
      return;
    }

    let imageUrl = '';
    if (imgInput.files && imgInput.files[0]) {
      const formData = new FormData();
      formData.append('file', imgInput.files[0]);
      formData.append('enrollment_no', this.currentStudent.identifier);
      formData.append('category', 'other_uploaded_files');
      try {
        const uploadRes = await API.uploadStudentFile(formData);
        imageUrl = '/' + uploadRes.file.file_path;
      } catch (e) {
        console.error('Image upload failed', e);
      }
    }

    const item = {
      id: Date.now(),
      title,
      [semType === 'organized' ? 'role' : 'organizer']: roleOrOrg,
      image_url: imageUrl,
      date: new Date().toISOString().split('T')[0]
    };

    const cur = this.extras.seminars || { organized: [], participated: [] };
    if (!cur[semType]) cur[semType] = [];
    cur[semType].push(item);

    try {
      const res = await API.saveStudentSection('seminars', this.currentStudent.identifier, cur);
      if (res.success) {
        this.extras.seminars = cur;
        this.renderSeminarsList();
        this.profileData.completeness_pct = res.completeness.percentage;
        this.renderCompleteness();
        document.getElementById('modal-seminar').classList.remove('active');
        document.getElementById('sem-title').value = '';
        document.getElementById('sem-role-org').value = '';
        if (imgInput) imgInput.value = '';
        Toast.success('Seminar logged with image!');
      }
    } catch (err) {
      Toast.error('Failed to save seminar: ' + err.message);
    }
  }
};
