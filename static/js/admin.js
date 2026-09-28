// Admin Dashboard Controller - VGU Academic Portal

const AdminController = {
  currentAdmin: null,
  students: [],
  submissions: [],
  requirements: [],
  activeRequirementId: null,

  async init(user) {
    this.currentAdmin = user;
    this.setupEventListeners();
    await this.refreshAll();
  },

  async refreshAll() {
    await Promise.all([
      this.loadStudents(),
      this.loadSubmissions(),
      this.loadRequirements(),
      this.loadAnalytics()
    ]);
  },

  async loadStudents() {
    const filters = {
      query: document.getElementById('admin-filter-search')?.value.trim() || '',
      branch: document.getElementById('admin-filter-branch')?.value || '',
      year: document.getElementById('admin-filter-year')?.value || '',
      min_cgpa: document.getElementById('admin-filter-cgpa')?.value || '',
      min_attendance: document.getElementById('admin-filter-att')?.value || '',
      min_certificates: document.getElementById('admin-filter-certs')?.value || '',
      internship_status: document.getElementById('admin-filter-internship')?.value || '',
      verification_status: document.getElementById('admin-filter-verification')?.value || ''
    };

    try {
      const res = await API.getStudentsList(filters);
      if (res.success) {
        this.students = res.students;
        this.renderStudentTable();
      }
    } catch (err) {
      Toast.error('Failed to load student directory: ' + err.message);
    }
  },

  renderStudentTable() {
    const tbody = document.getElementById('admin-students-tbody');
    const countBadge = document.getElementById('admin-student-count');
    if (countBadge) countBadge.textContent = `${this.students.length} Students`;
    if (!tbody) return;

    if (this.students.length === 0) {
      tbody.innerHTML = `<tr><td colspan="9" style="text-align: center; color: var(--text-muted); padding: 2rem;">No students match the current filter criteria.</td></tr>`;
      return;
    }

    tbody.innerHTML = this.students.map(s => {
      const avatar = s.photo_path || '/static/images/avatars/default.svg';
      const completeness = Math.round(s.completeness_pct || 0);

      let verBadge = `<span class="status-pill status-approved">🛡️ Verified</span>`;
      let verifyAction = '';
      if (s.verification_status === 'Pending') {
        verBadge = `<span class="status-pill status-pending">⏳ Pending</span>`;
        verifyAction = `
          <button class="btn btn-success btn-sm" style="margin-left:0.4rem;padding:0.25rem 0.5rem;font-size:0.72rem;" onclick="AdminController.verifyStudent('${s.enrollment_no}', 'Verified')">Verify ✓</button>
          <button class="btn btn-danger btn-sm" style="margin-left:0.3rem;padding:0.25rem 0.5rem;font-size:0.72rem;" onclick="AdminController.verifyStudent('${s.enrollment_no}', 'Rejected')">Reject</button>
        `;
      } else if (s.verification_status === 'Rejected') {
        verBadge = `<span class="status-pill status-rejected">❌ Rejected</span>`;
        verifyAction = `<button class="btn btn-secondary btn-sm" style="margin-left: 0.4rem; padding: 0.25rem 0.5rem; font-size: 0.72rem;" onclick="AdminController.verifyStudent('${s.enrollment_no}', 'Verified')">Re-verify</button>`;
      }

      return `
        <tr>
          <td>
            <div style="display: flex; align-items: center; gap: 0.75rem;">
              <img src="${avatar}" style="width: 34px; height: 34px; border-radius: 50%; object-fit: cover; border: 1px solid rgba(255,255,255,0.2);">
              <div>
                <strong style="color: #ffffff;">${s.full_name}</strong>
                <div style="font-family: var(--font-mono); font-size: 0.75rem; color: var(--text-secondary);">${s.enrollment_no}</div>
              </div>
            </div>
          </td>
          <td>${s.branch}</td>
          <td><span style="font-size: 0.8rem; color: var(--text-light);">${s.semester_year} (Sem ${s.semester})</span></td>
          <td><strong style="color: #60a5fa;">${s.cgpa ? s.cgpa.toFixed(2) : '-'}</strong></td>
          <td>${s.attendance_pct ? s.attendance_pct + '%' : '-'}</td>
          <td><span class="status-pill status-approved">🏆 ${s.cert_count || 0}</span></td>
          <td>
            <div style="display: flex; align-items: center; gap: 0.5rem;">
              <div style="flex: 1; height: 6px; background: rgba(255,255,255,0.1); border-radius: 4px; overflow: hidden; min-width: 50px;">
                <div style="height: 100%; width: ${completeness}%; background: linear-gradient(90deg, #3b82f6, #10b981);"></div>
              </div>
              <span style="font-size: 0.75rem; font-weight: 700;">${completeness}%</span>
            </div>
          </td>
          <td>${verBadge} ${verifyAction}</td>
          <td>
            <button class="btn btn-secondary btn-sm" onclick="AdminController.inspectStudent('${s.enrollment_no}')">Inspect</button>
          </td>
        </tr>
      `;
    }).join('');
  },

  async verifyStudent(enrollmentNo, status) {
    try {
      const res = await API.verifyStudentAccount(enrollmentNo, status, this.currentAdmin.name);
      if (res.success) {
        Toast.success(res.message);
        await this.loadStudents();
        // If dossier modal is open for this student, refresh the verification bar in-place
        const dossierModal = document.getElementById('modal-student-dossier');
        const dossierEnrollment = document.getElementById('dossier-enrollment');
        if (dossierModal && dossierModal.classList.contains('active') && dossierEnrollment && dossierEnrollment.textContent.trim() === enrollmentNo) {
          this._refreshDossierVerificationBar(enrollmentNo, status);
        }
      }
    } catch (err) {
      Toast.error('Verification failed: ' + err.message);
    }
  },

  _refreshDossierVerificationBar(enrollmentNo, currentStatus) {
    const verContainer = document.getElementById('dossier-verification-actions');
    if (!verContainer) return;
    if (currentStatus === 'Verified') {
      verContainer.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: space-between; background: rgba(16,185,129,0.12); border: 1px solid rgba(16,185,129,0.3); padding: 0.75rem 1rem; border-radius: var(--radius-sm); margin-bottom: 1.25rem;">
          <span style="color: #34d399; font-weight: 600;">🛡️ Account Verified &amp; Full Edit Access Granted</span>
          <button class="btn btn-danger btn-sm" onclick="AdminController.verifyStudent('${enrollmentNo}', 'Rejected')">Revoke Verification</button>
        </div>
      `;
    } else {
      verContainer.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: space-between; background: rgba(245,158,11,0.15); border: 1px solid rgba(245,158,11,0.35); padding: 0.75rem 1rem; border-radius: var(--radius-sm); margin-bottom: 1.25rem;">
          <span style="color: #fbbf24; font-weight: 600;">⚠️ Registration Awaiting Faculty Approval</span>
          <div style="display: flex; gap: 0.5rem;">
            <button class="btn btn-success btn-sm" onclick="AdminController.verifyStudent('${enrollmentNo}', 'Verified')">Verify &amp; Grant Access ✓</button>
            <button class="btn btn-danger btn-sm" onclick="AdminController.verifyStudent('${enrollmentNo}', 'Rejected')">Reject</button>
          </div>
        </div>
      `;
    }
  },

  async inspectStudent(enrollmentNo) {
    try {
      const res = await API.getStudentDetails(enrollmentNo);
      if (!res.success) throw new Error(res.message);

      const s = res.student;
      const extras = res.extras || {};
      const marks = res.marks || [];
      const submissions = res.submissions || [];
      const requirementsStatus = res.requirements_status || [];

      // ── HEADER ─────────────────────────────────────────────
      document.getElementById('dossier-name').textContent = s.full_name;
      document.getElementById('dossier-enrollment').textContent = s.enrollment_no;
      document.getElementById('dossier-avatar').src = s.photo_path || '/static/images/avatars/default.svg';

      // Student Code (enrollment is the code here, shown in the badge if different)
      const codeBadge = document.getElementById('dossier-student-code-badge');
      if (codeBadge) { codeBadge.textContent = `📛 ${s.enrollment_no}`; codeBadge.style.display = 'inline'; }

      // ── VERIFICATION BAR ───────────────────────────────────
      const verContainer = document.getElementById('dossier-verification-actions');
      if (verContainer) {
        this._refreshDossierVerificationBar(s.enrollment_no, s.verification_status);
      }

      // ── TAB: OVERVIEW ──────────────────────────────────────
      document.getElementById('dossier-email').textContent = s.email;
      document.getElementById('dossier-mobile').textContent = s.mobile;
      document.getElementById('dossier-dob').textContent = s.dob || '—';
      document.getElementById('dossier-program').textContent = s.program || '—';
      document.getElementById('dossier-account-since').textContent = s.account_created_at ? s.account_created_at.split('T')[0] : '—';

      document.getElementById('dossier-branch').textContent = s.branch;
      document.getElementById('dossier-class').textContent = s.class_name || '—';
      document.getElementById('dossier-section').textContent = s.section || '—';
      document.getElementById('dossier-semester').textContent = s.semester ? `Semester ${s.semester}` : '—';
      document.getElementById('dossier-year').textContent = s.semester_year || '—';

      document.getElementById('dossier-cgpa').textContent = s.cgpa ? s.cgpa.toFixed(2) : '—';
      document.getElementById('dossier-attendance').textContent = s.attendance_pct ? `${s.attendance_pct}%` : '—';
      document.getElementById('dossier-completeness-val').textContent = s.completeness_pct ? `${Math.round(s.completeness_pct)}%` : '—';

      // Links
      const links = extras.links || {};
      const setLink = (id, url, label) => {
        const el = document.getElementById(id);
        if (!el) return;
        if (url) { el.href = url; el.style.display = 'inline-flex'; el.textContent = label; }
        else { el.style.display = 'none'; }
      };
      const resData = extras.resumes || {};
      setLink('dossier-resume-btn', resData.file_path ? `/${resData.file_path}` : null, `📄 ${resData.filename || 'Resume'}`);
      setLink('dossier-linkedin-btn', links.linkedin, '🔗 LinkedIn');
      setLink('dossier-github-btn', links.github, '🐙 GitHub');
      setLink('dossier-leetcode-btn', links.leetcode, '💻 LeetCode');

      // Semester Marks
      const marksContainer = document.getElementById('dossier-marks-list');
      if (marksContainer) {
        marksContainer.innerHTML = marks.length === 0 ? '<div style="color:var(--text-muted);font-size:0.85rem;">No marks recorded yet.</div>' :
          marks.map(m => `
            <div style="display: flex; justify-content: space-between; padding: 0.4rem 0.6rem; border-bottom: 1px solid var(--border-subtle); font-size: 0.84rem; align-items: center;">
              <span style="color:var(--text-secondary);">Semester ${m.semester}</span>
              <strong style="color:#60a5fa;">SGPA: ${m.sgpa.toFixed(2)}</strong>
              ${m.marksheet_file ? `<a href="/${m.marksheet_file}" target="_blank" class="btn-link" style="font-size:0.75rem;">📄 Marksheet</a>` : '<span style="font-size:0.75rem;color:var(--text-muted);">No file</span>'}
            </div>
          `).join('');
      }

      // Projects
      const projectsContainer = document.getElementById('dossier-projects-list');
      const projects = extras.projects || [];
      if (projectsContainer) {
        projectsContainer.innerHTML = projects.length === 0 ? '<div style="color:var(--text-muted);font-size:0.85rem;">No projects listed.</div>' :
          projects.map(p => `
            <div style="background:rgba(15,23,42,0.5);border:1px solid var(--border-subtle);border-radius:var(--radius-sm);padding:0.75rem 1rem;margin-bottom:0.6rem;font-size:0.84rem;">
              <div style="font-weight:700;color:#e2e8f0;">${p.title}</div>
              ${p.tech_stack ? `<div style="font-size:0.75rem;color:#a78bfa;margin-top:0.2rem;">Stack: ${p.tech_stack}</div>` : ''}
              ${p.description ? `<div style="font-size:0.78rem;color:var(--text-secondary);margin-top:0.3rem;">${p.description}</div>` : ''}
              <div style="display:flex;gap:0.6rem;margin-top:0.4rem;flex-wrap:wrap;">
                ${p.demo_url ? `<a href="${p.demo_url}" target="_blank" class="btn-link" style="font-size:0.75rem;">🌐 Demo</a>` : ''}
                ${p.repo_url ? `<a href="${p.repo_url}" target="_blank" class="btn-link" style="font-size:0.75rem;">🐙 Repo</a>` : ''}
              </div>
            </div>
          `).join('');
      }

      // ── TAB: SKILLS & ROLES ────────────────────────────────
      const skillsData = extras.skills || {};
      const softSkills = skillsData.soft_skills || [];
      const techSkills = skillsData.technical_skills || [];
      const targetRoles = skillsData.target_roles || [];
      const hasAnySkills = softSkills.length || techSkills.length || targetRoles.length;

      // Student code section
      const codeSection = document.getElementById('dossier-student-code-section');
      const codeEl = document.getElementById('dossier-student-code');
      if (codeSection && codeEl) { codeSection.style.display = 'block'; codeEl.textContent = s.enrollment_no; }

      const renderTags = (containerId, items, color) => {
        const el = document.getElementById(containerId);
        if (!el) return;
        el.innerHTML = items.length === 0
          ? `<span style="color:var(--text-muted);font-size:0.82rem;">None listed</span>`
          : items.map(item => `<span class="tag-chip" style="background:${color};font-size:0.8rem;padding:0.25rem 0.7rem;">${item}</span>`).join('');
      };
      renderTags('dossier-soft-skills', softSkills, 'rgba(251,191,36,0.18)');
      renderTags('dossier-technical-skills', techSkills, 'rgba(52,211,153,0.18)');
      renderTags('dossier-target-roles', targetRoles, 'rgba(96,165,250,0.18)');
      const noSkillsMsg = document.getElementById('dossier-no-skills-msg');
      if (noSkillsMsg) noSkillsMsg.style.display = hasAnySkills ? 'none' : 'block';

      // ── TAB: ACTIVITIES ────────────────────────────────────
      const renderActivityCards = (containerId, items, renderFn) => {
        const el = document.getElementById(containerId);
        if (!el) return;
        el.innerHTML = (!items || items.length === 0) ? '<div style="color:var(--text-muted);font-size:0.84rem;">None recorded.</div>' : items.map(renderFn).join('');
      };

      const hackathons = extras.hackathons || [];
      renderActivityCards('dossier-hackathons-list', hackathons, h => `
        <div style="background:rgba(245,158,11,0.08);border:1px solid rgba(245,158,11,0.25);border-radius:var(--radius-sm);padding:0.7rem 0.9rem;margin-bottom:0.5rem;font-size:0.83rem;">
          <div style="font-weight:700;color:#fbbf24;">${h.name}</div>
          ${h.role ? `<div style="color:var(--text-light);margin-top:0.2rem;">Role: ${h.role}</div>` : ''}
          ${h.project_name ? `<div style="color:var(--text-secondary);">Project: ${h.project_name}</div>` : ''}
          ${h.result ? `<div style="color:#34d399;font-weight:600;">Result: ${h.result}</div>` : ''}
          ${h.date ? `<div style="color:var(--text-muted);font-size:0.75rem;">Date: ${h.date}</div>` : ''}
        </div>
      `);

      const workshops = extras.workshops || [];
      renderActivityCards('dossier-workshops-list', workshops, w => `
        <div style="background:rgba(52,211,153,0.08);border:1px solid rgba(52,211,153,0.25);border-radius:var(--radius-sm);padding:0.7rem 0.9rem;margin-bottom:0.5rem;font-size:0.83rem;">
          <div style="font-weight:700;color:#34d399;">${w.topic}</div>
          ${w.conducted_by ? `<div style="color:var(--text-light);">By: ${w.conducted_by}</div>` : ''}
          ${w.date ? `<div style="color:var(--text-muted);font-size:0.75rem;">Date: ${w.date}</div>` : ''}
        </div>
      `);

      const seminarsData = extras.seminars || {};
      const allSeminars = [
        ...(seminarsData.organized || []).map(s => ({...s, type: 'Organized'})),
        ...(seminarsData.participated || []).map(s => ({...s, type: 'Participated'}))
      ];
      renderActivityCards('dossier-seminars-list', allSeminars, sm => `
        <div style="background:rgba(96,165,250,0.08);border:1px solid rgba(96,165,250,0.25);border-radius:var(--radius-sm);padding:0.7rem 0.9rem;margin-bottom:0.5rem;font-size:0.83rem;">
          <div style="display:flex;align-items:center;gap:0.5rem;">
            <span style="font-weight:700;color:#60a5fa;">${sm.title}</span>
            <span class="status-pill ${sm.type==='Organized'?'status-approved':'status-pending'}" style="font-size:0.7rem;">${sm.type}</span>
          </div>
          ${sm.role ? `<div style="color:var(--text-light);margin-top:0.2rem;">Role: ${sm.role}</div>` : ''}
          ${sm.organizer ? `<div style="color:var(--text-secondary);">Organizer: ${sm.organizer}</div>` : ''}
          ${sm.date ? `<div style="color:var(--text-muted);font-size:0.75rem;">Date: ${sm.date}</div>` : ''}
        </div>
      `);

      // Clubs / Other (check for extras.clubs or extracurricular key)
      const clubs = extras.clubs || extras.extracurricular || [];
      const clubsEl = document.getElementById('dossier-clubs-list');
      if (clubsEl) {
        clubsEl.innerHTML = (!clubs || clubs.length === 0) ? '<div style="color:var(--text-muted);font-size:0.84rem;">No clubs or extracurricular activities recorded.</div>' :
          (Array.isArray(clubs) ? clubs : Object.entries(clubs)).map(c => `
            <span class="tag-chip" style="background:rgba(196,181,253,0.15);font-size:0.82rem;padding:0.3rem 0.8rem;">${typeof c === 'string' ? c : c[0]}</span>
          `).join('');
      }

      // ── TAB: SUBMISSIONS & REQUIREMENTS ────────────────────
      const reqStatusEl = document.getElementById('dossier-requirements-status');
      if (reqStatusEl) {
        reqStatusEl.innerHTML = requirementsStatus.length === 0
          ? '<div style="color:var(--text-muted);font-size:0.85rem;">No active requirements for this student\'s branch/year.</div>'
          : requirementsStatus.map(r => {
              const isSubmitted = r.status === 'submitted';
              const sub = r.submission;
              const subStatus = sub ? sub.status : null;
              let badgeHtml = isSubmitted
                ? `<span class="status-pill ${subStatus === 'Approved' ? 'status-approved' : subStatus === 'Rejected' ? 'status-rejected' : 'status-pending'}">${subStatus || 'Submitted'}</span>`
                : `<span class="status-pill status-rejected">⚠️ Pending</span>`;
              const isPast = new Date(r.deadline) < new Date();
              return `
                <div style="background:rgba(15,23,42,0.55);border:1px solid ${isSubmitted ? 'rgba(52,211,153,0.25)' : (isPast?'rgba(239,68,68,0.3)':'var(--border-subtle)')};border-left:3px solid ${isSubmitted?'#34d399':(isPast?'#ef4444':'#fbbf24')};border-radius:var(--radius-sm);padding:0.7rem 0.9rem;margin-bottom:0.6rem;font-size:0.83rem;">
                  <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:0.4rem;">
                    <div>
                      <div style="font-weight:700;color:#e2e8f0;">${r.title}</div>
                      ${r.is_compulsory ? `<span style="font-size:0.7rem;color:#f87171;font-weight:600;">● COMPULSORY</span>` : ''}
                    </div>
                    <div style="display:flex;align-items:center;gap:0.5rem;flex-shrink:0;">
                      ${badgeHtml}
                      <span style="font-size:0.72rem;color:${isPast?'#f87171':'#fbbf24'};">📅 ${r.deadline}</span>
                    </div>
                  </div>
                  ${sub && sub.admin_comment ? `<div style="font-size:0.75rem;color:#fb7185;margin-top:0.3rem;">💬 Admin: "${sub.admin_comment}"</div>` : ''}
                </div>
              `;
            }).join('');
      }

      const subsContainer = document.getElementById('dossier-subs-list');
      if (subsContainer) {
        subsContainer.innerHTML = submissions.length === 0 ? '<div style="color:var(--text-muted);font-size:0.85rem;">No uploaded documents or certificates.</div>' :
          submissions.map(sub => `
            <div style="padding: 0.5rem 0; border-bottom: 1px solid var(--border-subtle); font-size: 0.85rem;">
              <div style="display: flex; justify-content: space-between;">
                <strong>${sub.title}</strong>
                <span class="status-pill ${sub.status === 'Approved' ? 'status-approved' : sub.status === 'Rejected' ? 'status-rejected' : 'status-pending'}">${sub.status}</span>
              </div>
              <div style="font-size: 0.78rem; color: var(--text-secondary); margin-top: 0.2rem;">
                ${sub.submission_type} • ${sub.issuer_or_org || ''}
                ${sub.file_path ? `• <a href="/${sub.file_path}" target="_blank" class="btn-link">View File</a>` : ''}
              </div>
              ${sub.admin_comment ? `<div style="font-size: 0.75rem; color: #fb7185; margin-top: 0.2rem;">Comment: "${sub.admin_comment}"</div>` : ''}
            </div>
          `).join('');
      }

      // Show the modal and reset to Overview tab
      this._switchDossierTab('dtab-overview');
      document.getElementById('modal-student-dossier').classList.add('active');
    } catch (err) {
      Toast.error('Failed to load dossier: ' + err.message);
    }
  },

  _switchDossierTab(targetId) {
    document.querySelectorAll('.dossier-tab-panel').forEach(p => p.style.display = 'none');
    document.querySelectorAll('.dossier-tab-btn').forEach(b => {
      const isActive = b.dataset.dossierTab === targetId;
      b.style.borderBottom = isActive ? '2px solid var(--primary)' : '2px solid transparent';
      b.style.color = isActive ? '#fff' : 'var(--text-secondary)';
      b.classList.toggle('active', isActive);
    });
    const panel = document.getElementById(targetId);
    if (panel) panel.style.display = 'block';
  },



  async loadSubmissions() {
    const status = document.getElementById('admin-sub-status-filter')?.value || 'All';
    try {
      const res = await API.getSubmissions(status);
      if (res.success) {
        this.submissions = res.submissions;
        this.renderSubmissionsTable();
      }
    } catch (err) {
      Toast.error('Failed to load submissions: ' + err.message);
    }
  },

  renderSubmissionsTable() {
    const tbody = document.getElementById('admin-submissions-tbody');
    const badge = document.getElementById('admin-pending-badge');
    const pendingCount = this.submissions.filter(s => s.status === 'Pending').length;
    if (badge) badge.textContent = `${pendingCount} Pending`;
    if (!tbody) return;

    if (this.submissions.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--text-muted); padding: 2rem;">No submissions found for selected filter.</td></tr>`;
      return;
    }

    tbody.innerHTML = this.submissions.map(s => {
      let statusBadge = `<span class="status-pill status-pending">Pending</span>`;
      if (s.status === 'Approved') statusBadge = `<span class="status-pill status-approved">Approved</span>`;
      if (s.status === 'Rejected') statusBadge = `<span class="status-pill status-rejected">Rejected</span>`;

      return `
        <tr>
          <td>
            <strong>${s.student_name}</strong>
            <div style="font-family: var(--font-mono); font-size: 0.75rem; color: var(--text-secondary);">${s.enrollment_no} (${s.branch})</div>
          </td>
          <td><strong>${s.title}</strong></td>
          <td><span style="text-transform: capitalize;">${s.submission_type}</span></td>
          <td>${s.issuer_or_org || '-'}</td>
          <td>
            ${s.file_path ? `<a href="/${s.file_path}" target="_blank" class="btn-link">📄 ${s.file_name || 'View File'}</a>` : '-'}
          </td>
          <td>${statusBadge}</td>
          <td>
            <div style="display: flex; gap: 0.4rem;">
              <button class="btn btn-success btn-sm" onclick="AdminController.approveSubmission(${s.id})">Approve</button>
              <button class="btn btn-danger btn-sm" onclick="AdminController.openRejectModal(${s.id}, '${s.title.replace(/'/g, "\\'")}')">Reject</button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  },

  async approveSubmission(subId) {
    try {
      const res = await API.reviewSubmission(subId, 'Approved', 'Verified and accepted by VGU faculty.');
      if (res.success) {
        Toast.success('Submission approved!');
        await this.loadSubmissions();
        await this.loadStudents();
      }
    } catch (err) {
      Toast.error('Approval failed: ' + err.message);
    }
  },

  openRejectModal(subId, title) {
    document.getElementById('reject-sub-id').value = subId;
    document.getElementById('reject-sub-title').textContent = title;
    document.getElementById('reject-sub-comment').value = '';
    document.getElementById('modal-reject-submission').classList.add('active');
  },

  async submitRejection() {
    const subId = document.getElementById('reject-sub-id').value;
    const comment = document.getElementById('reject-sub-comment').value.trim();

    try {
      const res = await API.reviewSubmission(subId, 'Rejected', comment || 'Documentation insufficient.');
      if (res.success) {
        Toast.success('Submission rejected with feedback.');
        document.getElementById('modal-reject-submission').classList.remove('active');
        await this.loadSubmissions();
        await this.loadStudents();
      }
    } catch (err) {
      Toast.error('Failed to reject submission: ' + err.message);
    }
  },

  async loadRequirements() {
    try {
      const res = await API.getRequirements();
      if (res.success) {
        this.requirements = res.requirements;
        this.renderRequirementsList();
      }
    } catch (err) {
      Toast.error('Failed to load requirements: ' + err.message);
    }
  },

  renderRequirementsList() {
    const container = document.getElementById('admin-requirements-container');
    if (!container) return;

    if (this.requirements.length === 0) {
      container.innerHTML = `<div class="text-muted" style="padding: 2rem; text-align: center;">No academic requirements posted yet. Click "+ Create Requirement" above.</div>`;
      return;
    }

    container.innerHTML = this.requirements.map(r => {
      // Build eligibility badges
      const elig = r.eligibility_filters || {};
      const eligBadges = [];
      if (elig.target_section && elig.target_section !== 'All') eligBadges.push(`🔖 ${elig.target_section}`);
      if (elig.min_cgpa) eligBadges.push(`📈 CGPA ≥ ${elig.min_cgpa}`);
      if (elig.min_attendance) eligBadges.push(`📅 Att ≥ ${elig.min_attendance}%`);
      if (elig.required_skills && elig.required_skills.length) eligBadges.push(`⚙️ Skills: ${elig.required_skills.join(', ')}`);

      return `
      <div class="profile-card" style="margin-bottom: 1.25rem; ${r.is_compulsory ? 'border-left: 3px solid #ef4444;' : ''}">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 1rem; margin-bottom: 0.75rem;">
          <div>
            <div style="display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap;">
              <h3 style="font-size: 1.15rem; font-weight: 700;">${r.title}</h3>
              <span class="status-pill status-approved">Target: ${r.target_branch} (${r.target_year})</span>
              ${r.is_compulsory ? `<span class="status-pill" style="background: rgba(239,68,68,0.2); color: #f87171; border: 1px solid rgba(239,68,68,0.35);">&#128308; COMPULSORY</span>` : ''}
            </div>
            <p style="font-size: 0.88rem; color: var(--text-light); margin-top: 0.35rem;">${r.description}</p>
            ${eligBadges.length ? `<div style="display:flex;flex-wrap:wrap;gap:0.4rem;margin-top:0.5rem;">${eligBadges.map(b => `<span style="font-size:0.72rem;background:rgba(59,130,246,0.15);color:#93c5fd;border:1px solid rgba(59,130,246,0.3);padding:0.15rem 0.55rem;border-radius:99px;">${b}</span>`).join('')}</div>` : ''}
          </div>
          <div style="text-align: right;">
            <div style="font-size: 0.8rem; color: var(--text-secondary);">Deadline</div>
            <strong style="color: #fbbf24; font-size: 1rem;">${r.deadline}</strong>
          </div>
        </div>

        <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 1rem; border-top: 1px solid var(--border-subtle); padding-top: 0.85rem;">
          <div style="display: flex; gap: 1.5rem; font-size: 0.85rem;">
            <span>Target Students: <strong>${r.total_students}</strong></span>
            <span>Submitted: <strong style="color: #34d399;">${r.submitted_students}</strong></span>
            <span>Pending / Non-Submitting: <strong style="color: #fb7185;">${r.non_submitting_students}</strong></span>
          </div>
          <div style="display: flex; gap: 0.75rem;">
            <button class="btn btn-secondary btn-sm" onclick="AdminController.viewNonSubmitters(${r.id})">
              🔍 Filter Non-Submitters (${r.non_submitting_students})
            </button>
            <button class="btn btn-primary btn-sm" onclick="AdminController.triggerBulkEmail(${r.id}, '${r.title.replace(/'/g, "\\'")}', ${r.non_submitting_students})" ${r.non_submitting_students === 0 ? 'disabled' : ''}>
              📧 Bulk "Send Mail" Reminder
            </button>
          </div>
        </div>
      </div>
    `}).join('');
  },


  async viewNonSubmitters(reqId) {
    try {
      const res = await API.getNonSubmitters(reqId);
      if (res.success) {
        const req = res.requirement;
        const list = res.non_submitters;

        document.getElementById('modal-ns-title').textContent = req.title;
        document.getElementById('modal-ns-count').textContent = `${list.length} Students Pending Submission`;
        
        const tbody = document.getElementById('modal-ns-tbody');
        tbody.innerHTML = list.length === 0 ? 
          '<tr><td colspan="5" style="text-align: center; color: var(--emerald); padding: 1.5rem;">🎉 All target students have submitted this requirement!</td></tr>' :
          list.map(s => `
            <tr>
              <td><strong>${s.full_name}</strong></td>
              <td style="font-family: var(--font-mono);">${s.enrollment_no}</td>
              <td>${s.branch} • ${s.section}</td>
              <td>${s.email}</td>
              <td><span class="status-pill status-rejected">Missing Proof</span></td>
            </tr>
          `).join('');

        const mailBtn = document.getElementById('modal-ns-mail-btn');
        mailBtn.onclick = () => {
          document.getElementById('modal-non-submitters').classList.remove('active');
          AdminController.triggerBulkEmail(req.id, req.title, list.length);
        };

        document.getElementById('modal-non-submitters').classList.add('active');
      }
    } catch (err) {
      Toast.error('Failed to load non-submitters: ' + err.message);
    }
  },

  async triggerBulkEmail(reqId, title, count) {
    if (count === 0) {
      Toast.info('All students have already submitted! No emails needed.');
      return;
    }

    if (!confirm(`Are you sure you want to automatically dispatch personalized deadline reminder emails to all ${count} non-submitting students?`)) {
      return;
    }

    try {
      Toast.info('Dispatching automated reminder emails in bulk...');
      const res = await API.bulkEmailNonSubmitters(reqId);
      if (res.success) {
        Toast.success(res.message);
        
        document.getElementById('outbox-modal-title').textContent = title;
        document.getElementById('outbox-modal-count').textContent = `Dispatched to ${res.sent_count} non-submitting students`;
        
        const listContainer = document.getElementById('outbox-modal-list');
        listContainer.innerHTML = (res.emails || []).map(em => `
          <div style="background: rgba(15,23,42,0.7); border: 1px solid var(--border-subtle); border-radius: var(--radius-sm); padding: 0.75rem 1rem; margin-bottom: 0.5rem; font-size: 0.82rem;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 0.2rem;">
              <strong>To: ${em.recipient_name} &lt;${em.recipient_email}&gt;</strong>
              <span class="status-pill status-approved">Sent ✓</span>
            </div>
            <div style="color: #60a5fa;">${em.subject}</div>
            <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 0.2rem;">Timestamp: ${em.sent_at}</div>
          </div>
        `).join('');

        document.getElementById('modal-outbox-preview').classList.add('active');
      }
    } catch (err) {
      Toast.error('Bulk email dispatch failed: ' + err.message);
    }
  },

  async loadAnalytics() {
    try {
      const res = await API.getAnalytics();
      if (!res.success) return;

      const kpis = res.kpis;
      document.getElementById('kpi-total-students').textContent = kpis.total_students;
      document.getElementById('kpi-avg-cgpa').textContent = kpis.avg_cgpa.toFixed(2);
      document.getElementById('kpi-avg-att').textContent = `${kpis.avg_attendance}%`;
      document.getElementById('kpi-avg-comp').textContent = `${kpis.avg_completeness}%`;

      const compDist = res.completeness_distribution || {};
      const compChart = document.getElementById('chart-completeness-dist');
      if (compChart) {
        const total = kpis.total_students || 1;
        compChart.innerHTML = Object.entries(compDist).map(([label, val]) => {
          const pct = Math.round((val / total) * 100);
          let color = '#3b82f6';
          if (label.includes('100%')) color = '#10b981';
          if (label.includes('Needs Attention')) color = '#f43f5e';
          if (label.includes('Progressing')) color = '#f59e0b';

          return `
            <div class="bar-chart-row">
              <span class="bar-label">${label}</span>
              <div class="bar-track">
                <div class="bar-progress" style="width: ${pct}%; background: ${color};"></div>
              </div>
              <span class="bar-val">${val} (${pct}%)</span>
            </div>
          `;
        }).join('');
      }

      const branchStats = res.branch_stats || [];
      const branchChart = document.getElementById('chart-branch-stats');
      if (branchChart) {
        branchChart.innerHTML = branchStats.map(b => `
          <div class="bar-chart-row">
            <span class="bar-label" title="${b.branch}">${b.branch}</span>
            <div class="bar-track">
              <div class="bar-progress" style="width: ${(b.avg_cgpa / 10) * 100}%; background: linear-gradient(90deg, #6366f1, #06b6d4);"></div>
            </div>
            <span class="bar-val">${b.avg_cgpa}★</span>
          </div>
        `).join('');
      }

      const skillsContainer = document.getElementById('chart-top-skills');
      if (skillsContainer) {
        const skills = res.top_skills || [];
        skillsContainer.innerHTML = skills.map(([skill, count]) => `
          <span class="tag-chip" style="font-size: 0.85rem; padding: 0.35rem 0.8rem; background: rgba(59,130,246,0.18);">
            ${skill} <span style="background: rgba(255,255,255,0.15); padding: 0.1rem 0.4rem; border-radius: 99px; margin-left: 0.3rem;">${count}</span>
          </span>
        `).join('');
      }

    } catch (err) {
      console.error('Failed to render analytics:', err);
    }
  },

  setupEventListeners() {
    ['admin-filter-search', 'admin-filter-branch', 'admin-filter-year', 'admin-filter-certs', 'admin-filter-internship', 'admin-filter-verification'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.onchange = () => this.loadStudents();
      if (el && el.tagName === 'INPUT') el.oninput = () => this.loadStudents();
    });

    const cgpaSlider = document.getElementById('admin-filter-cgpa');
    const cgpaVal = document.getElementById('cgpa-val-display');
    if (cgpaSlider && cgpaVal) {
      cgpaSlider.oninput = () => {
        cgpaVal.textContent = cgpaSlider.value > 0 ? `≥ ${cgpaSlider.value}` : 'Any';
        this.loadStudents();
      };
    }

    const attSlider = document.getElementById('admin-filter-att');
    const attVal = document.getElementById('att-val-display');
    if (attSlider && attVal) {
      attSlider.oninput = () => {
        attVal.textContent = attSlider.value > 0 ? `≥ ${attSlider.value}%` : 'Any';
        this.loadStudents();
      };
    }

    const subFilter = document.getElementById('admin-sub-status-filter');
    if (subFilter) subFilter.onchange = () => this.loadSubmissions();

    // Dossier tab switching
    document.querySelectorAll('.dossier-tab-btn').forEach(btn => {
      btn.onclick = () => this._switchDossierTab(btn.dataset.dossierTab);
    });

    const reqForm = document.getElementById('form-create-requirement');
    if (reqForm) {
      reqForm.onsubmit = async (e) => {
        e.preventDefault();
        const skillsRaw = document.getElementById('new-req-skills')?.value.trim() || '';
        const skillsArr = skillsRaw ? skillsRaw.split(',').map(s => s.trim()).filter(Boolean) : [];
        const payload = {
          title: document.getElementById('new-req-title').value.trim(),
          description: document.getElementById('new-req-desc').value.trim(),
          target_branch: document.getElementById('new-req-branch').value,
          target_year: document.getElementById('new-req-year').value,
          target_section: document.getElementById('new-req-section')?.value || 'All',
          min_cgpa: document.getElementById('new-req-min-cgpa')?.value || '',
          min_attendance: document.getElementById('new-req-min-att')?.value || '',
          required_skills: skillsArr,
          deadline: document.getElementById('new-req-deadline').value,
          is_compulsory: document.getElementById('new-req-compulsory')?.checked || false,
          created_by: this.currentAdmin.name
        };

        if (!payload.title || !payload.deadline) {
          Toast.warning('Title and Deadline are required.');
          return;
        }

        try {
          const res = await API.createRequirement(payload);
          if (res.success) {
            Toast.success('New VGU academic requirement posted successfully!');
            document.getElementById('modal-create-requirement').classList.remove('active');
            reqForm.reset();
            await this.loadRequirements();
          }
        } catch (err) {
          Toast.error(err.message);
        }
      };
    }
  },


  resetFilters() {
    ['admin-filter-search', 'admin-filter-branch', 'admin-filter-year', 'admin-filter-certs', 'admin-filter-internship', 'admin-filter-verification'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = el.tagName === 'SELECT' ? (el.options[0]?.value || '') : '';
    });

    const cgpa = document.getElementById('admin-filter-cgpa');
    if (cgpa) { cgpa.value = 0; document.getElementById('cgpa-val-display').textContent = 'Any'; }
    
    const att = document.getElementById('admin-filter-att');
    if (att) { att.value = 0; document.getElementById('att-val-display').textContent = 'Any'; }

    this.loadStudents();
  }
};
