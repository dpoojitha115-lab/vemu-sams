(function () {
  const STORAGE_KEY = 'sams_auth';

  function getAuth() {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || sessionStorage.getItem(STORAGE_KEY) || 'null');
  }

  function clearAuth() {
    localStorage.removeItem(STORAGE_KEY);
    sessionStorage.removeItem(STORAGE_KEY);
  }

  async function api(path, options) {
    const auth = getAuth();
    const response = await fetch(path, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: auth?.token ? `Bearer ${auth.token}` : ''
      },
      ...options
    });
    const result = await response.json();
    if (response.status === 401) {
      clearAuth();
      window.location.href = '/';
      throw new Error('Session expired.');
    }
    if (!response.ok || !result.success) {
      throw new Error(result.error || 'Request failed.');
    }
    return result.data;
  }

  window.showView = function (viewId) {
    document.querySelectorAll('.view, .view-section').forEach((node) => node.classList.remove('active'));
    const target = document.getElementById(`view-${viewId}`);
    if (target) target.classList.add('active');

    document.querySelectorAll('.nav-item').forEach((node) => {
      const isMatch = node.getAttribute('onclick')?.includes(`'${viewId}'`) || node.dataset.view === viewId;
      node.classList.toggle('active', Boolean(isMatch));
    });
  };

  window.openModal = function (id) {
    document.getElementById(id)?.classList.add('open');
  };

  window.closeModal = function (id) {
    document.getElementById(id)?.classList.remove('open');
  };

  window.showToast = function (message, type) {
    const container = document.getElementById('toastContainer');
    if (!container) {
      console.log(`${type || 'info'}: ${message}`);
      return;
    }
    const toast = document.createElement('div');
    toast.className = `toast toast-${type || 'info'}`;
    toast.innerHTML = `<span>${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => {
      toast.remove();
    }, 3000);
  };

  window.logout = function () {
    clearAuth();
    window.location.href = '/';
  };

  document.addEventListener('click', function (event) {
    if (event.target.classList.contains('modal-overlay')) {
      event.target.classList.remove('open');
    }
  });

  function pctClass(value) {
    if (value < 60) return 'low';
    if (value < 75) return 'medium';
    return 'high';
  }

  function badgeFor(value) {
    if (value < 60) return ['badge-danger', 'Critical'];
    if (value < 75) return ['badge-warning', 'Warning'];
    return ['badge-success', 'Regular'];
  }

  function setText(selector, value) {
    const element = document.querySelector(selector);
    if (element) element.textContent = value;
  }

  function renderDepartmentChart(container, departments) {
    if (!container) return;
    const colors = ['var(--gold-500)', '#5DADE2', 'var(--success)', '#C39BD3', 'var(--warning)', 'var(--danger)'];
    container.innerHTML = departments.map((dept, index) => `
      <div class="chart-bar-wrap">
        <div class="chart-bar" data-val="${Math.round(dept.avg_attendance || 0)}%" style="height:${Math.max(20, (dept.avg_attendance || 0) * 1.8)}px;background:${colors[index % colors.length]};opacity:0.9"></div>
        <span class="chart-label">${dept.code}</span>
      </div>
    `).join('');
  }

  function getPageRole() {
    if (document.body.innerHTML.includes('Administrator')) return 'admin';
    if (document.body.innerHTML.includes('HOD')) return 'hod';
    if (document.body.innerHTML.includes('Faculty')) return 'teacher';
    if (document.body.innerHTML.includes('Student Portal')) return 'student';
    return null;
  }

  async function initAdmin() {
    const overview = await api('/api/admin/overview');
    const statCards = document.querySelectorAll('#view-dashboard .stat-card .stat-value');
    if (statCards.length >= 6) {
      statCards[0].textContent = overview.stats.total_students.toLocaleString();
      statCards[1].textContent = overview.stats.total_faculty.toLocaleString();
      statCards[2].textContent = `${Math.round(overview.stats.avg_attendance)}%`;
      statCards[3].textContent = overview.stats.low_count.toLocaleString();
      statCards[4].textContent = overview.stats.total_departments.toLocaleString();
      statCards[5].textContent = overview.stats.pending_leaves.toLocaleString();
    }

    const studentRows = overview.students.map((student) => {
      const low = overview.lowStudents.find((row) => String(row.student_id) === String(student.id));
      const attendance = low ? Math.round(low.avg_pct) : 82;
      const [badgeClass, badgeText] = badgeFor(attendance);
      return `
        <tr>
          <td>${student.roll_number}</td>
          <td><strong>${student.name}</strong></td>
          <td>${student.dept_code}</td>
          <td>Sem ${student.semester}</td>
          <td>Sec ${student.section}</td>
          <td>
            <span class="att-pct ${pctClass(attendance)}">${attendance}%</span>
            <div class="progress-bar" style="margin-top:4px;width:80px"><div class="progress-fill ${pctClass(attendance)}" style="width:${attendance}%"></div></div>
          </td>
          <td><span class="badge ${badgeClass}">${badgeText}</span></td>
          <td><button class="btn btn-xs btn-secondary" onclick="showToast('Student profile view is ready for extension','info')">View</button></td>
        </tr>
      `;
    });

    window.__adminStudents = studentRows;
    window.renderStudents = function (htmlRows) {
      const tbody = document.getElementById('studentsTbody');
      if (tbody) tbody.innerHTML = htmlRows.join('');
    };
    window.filterStudents = function () {
      const search = (document.getElementById('stuSearch')?.value || '').toLowerCase();
      const dept = document.getElementById('stuDeptFilter')?.value || '';
      const filtered = overview.students.filter((student) => {
        const matchSearch = !search || student.name.toLowerCase().includes(search) || student.roll_number.toLowerCase().includes(search);
        const matchDept = !dept || student.dept_code.toLowerCase().includes(dept.split(' ')[0].toLowerCase());
        return matchSearch && matchDept;
      }).map((student) => {
        const low = overview.lowStudents.find((row) => String(row.student_id) === String(student.id));
        const attendance = low ? Math.round(low.avg_pct) : 82;
        const [badgeClass, badgeText] = badgeFor(attendance);
        return `
          <tr>
            <td>${student.roll_number}</td>
            <td><strong>${student.name}</strong></td>
            <td>${student.dept_code}</td>
            <td>Sem ${student.semester}</td>
            <td>Sec ${student.section}</td>
            <td><span class="att-pct ${pctClass(attendance)}">${attendance}%</span></td>
            <td><span class="badge ${badgeClass}">${badgeText}</span></td>
            <td><button class="btn btn-xs btn-secondary" onclick="showToast('Student profile view is ready for extension','info')">View</button></td>
          </tr>
        `;
      });
      window.renderStudents(filtered);
    };
    window.renderStudents(studentRows);

    renderDepartmentChart(document.getElementById('deptChart'), overview.departments);

    window.sendBulkWarnings = async function () {
      const ids = overview.lowStudents.map((row) => row.student_id);
      if (!ids.length) {
        showToast('No low-attendance students right now.', 'info');
        return;
      }
      await api('/api/warnings/send', {
        method: 'POST',
        body: JSON.stringify({ student_ids: ids, via: 'system' })
      });
      showToast('Warnings sent to low-attendance students.', 'success');
    };
  }

  function renderHodSemesters(card, semesters, deptCode) {
    if (!card) return;
    card.innerHTML = `
      <div class="card-title">Semester-wise Attendance Breakdown - ${deptCode}</div>
      <div class="card-sub">Average attendance by semester for the selected department</div>
      <div style="display:grid;grid-template-columns:repeat(${Math.max(semesters.length, 1)},1fr);gap:12px;margin-top:16px">
        ${semesters.map((row) => `
          <div class="semester-col" style="text-align:center">
            <div style="font-size:11px;color:var(--gray-500);margin-bottom:6px">Sem ${row.semester}</div>
            <div style="height:120px;background:var(--navy-750);border-radius:6px;display:flex;align-items:flex-end;overflow:hidden">
              <div style="width:100%;height:${Math.max(10, row.avg_attendance || 0)}%;background:linear-gradient(180deg,var(--gold-500),rgba(201,168,76,0.6));border-radius:6px 6px 0 0"></div>
            </div>
            <div style="margin-top:4px;font-weight:600;color:var(--gold-400);font-size:14px">${Math.round(row.avg_attendance || 0)}%</div>
          </div>
        `).join('')}
      </div>
    `;
  }

  function renderHodTables(overview) {
    const view = document.getElementById('view-hodDashboard');
    const statCards = view?.querySelectorAll('.stat-card .stat-value') || [];
    if (statCards.length >= 5) {
      statCards[0].textContent = overview.stats.total_students;
      statCards[1].textContent = overview.stats.total_faculty;
      statCards[2].textContent = `${Math.round(overview.stats.avg_attendance)}%`;
      statCards[3].textContent = overview.stats.low_count;
      statCards[4].textContent = overview.stats.pending_leaves;
    }

    setText('#pageTitle', `${overview.department.code} Department Overview`);
    setText('#pageSubtitle', `${overview.department.name} · Live attendance analytics`);

    renderHodSemesters(document.querySelector('#view-hodDashboard .card.mb-6'), overview.semesters, overview.department.code);

    const monitoringCard = document.querySelector('#view-hodDashboard .grid-2 .card');
    if (monitoringCard) {
      monitoringCard.innerHTML = `
        <div class="card-title">Faculty Attendance Marking Status</div>
        <div class="card-sub">Today&apos;s attendance completion for ${overview.department.code}</div>
        <div style="display:flex;flex-direction:column;gap:12px;margin-top:12px">
          ${overview.facultyStatus.map((row) => `
            <div style="display:flex;justify-content:space-between;align-items:center">
              <span style="font-size:13px;color:var(--gray-300)">${row.name}</span>
              <div style="display:flex;align-items:center;gap:10px">
                <span class="badge ${row.classes_marked ? 'badge-success' : 'badge-warning'}">${row.classes_marked}/${Math.max(row.subjects, 1)} Marked</span>
              </div>
            </div>
          `).join('')}
        </div>
      `;
    }

    const leavesTable = document.querySelector('#view-hodLeaves tbody');
    if (leavesTable) {
      leavesTable.innerHTML = overview.leaves.map((leave) => `
        <tr>
          <td>#L${String(leave.id).padStart(3, '0')}</td>
          <td>${leave.applicant_name}</td>
          <td><span class="badge ${leave.applicant_role === 'teacher' ? 'badge-info' : 'badge-neutral'}">${leave.applicant_role}</span></td>
          <td>${leave.leave_type}</td>
          <td>${leave.from_date} to ${leave.to_date}</td>
          <td>${leave.reason}</td>
          <td><span class="badge ${leave.status === 'Pending' ? 'badge-warning' : leave.status === 'Approved' ? 'badge-success' : 'badge-danger'}">${leave.status}</span></td>
          <td>
            ${leave.status === 'Pending'
              ? `<button class="btn btn-xs btn-success" onclick="approveHOD(this, ${leave.id})">Approve</button> <button class="btn btn-xs btn-danger" onclick="rejectHOD(this, ${leave.id})">Reject</button>`
              : '<span style="color:var(--gray-500);font-size:12px">Done</span>'}
          </td>
        </tr>
      `).join('');
    }

    const alertsBanner = document.querySelector('#view-hodAlerts .alert-banner');
    if (alertsBanner) {
      alertsBanner.innerHTML = `<strong>${overview.lowStudents.length} students</strong> in ${overview.department.code} are below the attendance threshold.`;
    }

    const alertsTable = document.querySelector('#view-hodAlerts tbody');
    if (alertsTable) {
      alertsTable.innerHTML = overview.lowStudents.map((student) => `
        <tr>
          <td>${student.roll_number}</td>
          <td>${student.name}</td>
          <td>${student.semester}</td>
          <td><span class="att-pct ${pctClass(student.avg_pct)}">${Math.round(student.avg_pct)}%</span></td>
          <td>${overview.department.code}</td>
          <td>Registered</td>
          <td><button class="btn btn-xs btn-danger" onclick="warnStudent(${student.id}, '${student.name.replace(/'/g, "\\'")}')">Send Warning</button></td>
        </tr>
      `).join('');
    }

    const facultyTable = document.querySelector('#view-faculty tbody');
    if (facultyTable) {
      facultyTable.innerHTML = overview.facultyStatus.map((row) => `
        <tr>
          <td>${row.user_id}</td>
          <td>${row.name}</td>
          <td>${row.subjects}</td>
          <td><span class="badge ${row.classes_marked ? 'badge-success' : 'badge-warning'}">${row.classes_marked ? 'Active' : 'Pending'}</span></td>
          <td>${row.classes_marked}</td>
          <td>${row.last_marked || '-'}</td>
          <td><span class="att-pct ${row.classes_marked ? 'high' : 'medium'}">${row.subjects ? Math.round((row.classes_marked / row.subjects) * 100) : 0}%</span></td>
        </tr>
      `).join('');
    }

    const studentsTable = document.querySelector('#view-students tbody');
    if (studentsTable) {
      studentsTable.innerHTML = overview.students.map((student) => {
        const [badgeClass, badgeText] = badgeFor(student.avg_pct);
        return `
          <tr>
            <td>${student.roll_number}</td>
            <td>${student.name}</td>
            <td>${student.semester}</td>
            <td>${student.section}</td>
            <td><span class="att-pct ${pctClass(student.avg_pct)}">${Math.round(student.avg_pct)}%</span></td>
            <td><span class="badge ${badgeClass}">${badgeText}</span></td>
            <td><button class="btn btn-xs btn-secondary" onclick="showToast('Student attendance details can be expanded here','info')">View</button></td>
          </tr>
        `;
      }).join('');
    }
  }

  async function initHod() {
    const departments = await api('/api/departments');
    const filter = document.getElementById('hodDepartmentFilter');
    const auth = getAuth();
    const defaultDept = auth?.user?.role === 'admin' ? departments[0]?.code : 'CSE';

    if (filter) {
      filter.innerHTML = departments.map((dept) => `<option value="${dept.code}">${dept.code} - ${dept.name}</option>`).join('');
      filter.value = defaultDept;
      filter.addEventListener('change', loadOverview);
    }

    async function loadOverview() {
      const dept = filter?.value || defaultDept;
      const overview = await api(`/api/hod/overview?dept=${encodeURIComponent(dept)}`);
      renderHodTables(overview);
    }

    window.warnStudent = async function (studentId, name) {
      await api('/api/warnings/send', {
        method: 'POST',
        body: JSON.stringify({ student_ids: [studentId], via: 'system' })
      });
      showToast(`Warning sent to ${name}.`, 'success');
    };

    window.approveHOD = async function (_, leaveId) {
      await api(`/api/leaves/${leaveId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'Approved' })
      });
      showToast('Leave approved.', 'success');
      await loadOverview();
    };

    window.rejectHOD = async function (_, leaveId) {
      await api(`/api/leaves/${leaveId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'Rejected' })
      });
      showToast('Leave rejected.', 'warning');
      await loadOverview();
    };

    await loadOverview();
  }

  async function initTeacher() {
    const overview = await api('/api/teacher/overview');
    const subjectSelect = document.getElementById('attSubject');
    const dateInput = document.getElementById('attDate');
    const hourSelect = document.getElementById('attHour');
    const sectionSelect = document.getElementById('attSection');

    if (dateInput) dateInput.value = new Date().toISOString().slice(0, 10);

    if (subjectSelect) {
      subjectSelect.innerHTML = '<option value="">Select Subject</option>' + overview.subjects.map((subject) => (
        `<option value="${subject.id}">${subject.code} - ${subject.name}</option>`
      )).join('');
    }

    if (sectionSelect && overview.subjects[0]) {
      sectionSelect.innerHTML = overview.subjects.map((subject) => (
        `<option value="${subject.section}">${subject.code} - Section ${subject.section} Sem ${subject.semester}</option>`
      )).join('');
    }

    let currentStudents = [];

    async function loadAttendanceStudents() {
      if (!subjectSelect?.value) return;
      const data = await api(`/api/attendance/session?subject_id=${subjectSelect.value}&date=${dateInput.value}&hour=${hourSelect?.value || 1}`);
      currentStudents = data.students;
      const subject = overview.subjects.find((item) => String(item.id) === String(subjectSelect.value));

      const tbody = document.getElementById('attendanceTbody');
      if (tbody) {
        tbody.innerHTML = data.students.map((student, index) => `
          <tr>
            <td style="color:var(--gray-500)">${index + 1}</td>
            <td>${student.roll_number}</td>
            <td>${student.name}</td>
            <td><span class="att-pct ${pctClass(student.status === 'Present' ? 90 : student.status === 'Absent' ? 45 : 75)}">${student.status}</span></td>
            <td style="text-align:center"><input type="radio" name="att_${student.id}" value="Present" ${student.status === 'Present' ? 'checked' : ''} onchange="updateCount()" /></td>
            <td style="text-align:center"><input type="radio" name="att_${student.id}" value="Absent" ${student.status === 'Absent' ? 'checked' : ''} onchange="updateCount()" /></td>
            <td style="text-align:center"><input type="radio" name="att_${student.id}" value="OD" ${student.status === 'OD' || student.status === 'Leave' ? 'checked' : ''} onchange="updateCount()" /></td>
          </tr>
        `).join('');
      }

      setText('#attendanceSessionTitle', `${subject?.code || data.subject.code} - ${subject?.name || data.subject.name}`);
      setText('#attendanceSessionMeta', `${data.students.length} Students · Hour ${hourSelect?.value || 1} · ${dateInput.value}`);
      window.updateCount();
    }

    window.loadStudents = loadAttendanceStudents;

    window.updateCount = function () {
      const count = document.querySelectorAll('input[type="radio"][value="Present"]:checked').length;
      const total = currentStudents.length || 0;
      const node = document.getElementById('presentCount');
      if (node) node.textContent = `${count}`;
      const wrapper = node?.parentElement;
      if (wrapper) wrapper.innerHTML = `Present: <span id="presentCount" style="color:var(--success);font-weight:600">${count}</span> / ${total}`;
    };

    window.markAll = function (status) {
      const value = status === 'present' ? 'Present' : 'Absent';
      currentStudents.forEach((student) => {
        const radio = document.querySelector(`input[name="att_${student.id}"][value="${value}"]`);
        if (radio) radio.checked = true;
      });
      window.updateCount();
    };

    window.submitAttendance = async function () {
      if (!subjectSelect?.value || !currentStudents.length) {
        showToast('Select a subject first.', 'warning');
        return;
      }
      const records = currentStudents.map((student) => {
        const checked = document.querySelector(`input[name="att_${student.id}"]:checked`);
        return {
          student_id: student.id,
          status: checked ? checked.value : 'Absent'
        };
      });
      await api('/api/attendance/mark', {
        method: 'POST',
        body: JSON.stringify({
          subject_id: Number(subjectSelect.value),
          date: dateInput.value,
          hour_number: Number(hourSelect?.value || 1),
          records
        })
      });
      showToast('Attendance submitted successfully.', 'success');
      await loadAttendanceStudents();
    };

    subjectSelect?.addEventListener('change', loadAttendanceStudents);
    dateInput?.addEventListener('change', loadAttendanceStudents);
    hourSelect?.addEventListener('change', loadAttendanceStudents);

    if (overview.subjects[0]) {
      subjectSelect.value = overview.subjects[0].id;
      await loadAttendanceStudents();
    }
  }

  function renderStudentCards(summary) {
    const grid = document.getElementById('subject-cards-grid');
    if (!grid) return;
    grid.innerHTML = summary.map((subject) => `
      <div class="content-card" style="padding:1rem">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.4rem">
          <strong style="font-size:0.88rem">${subject.subject_name}</strong>
          <span style="font-family:'Cormorant Garamond',serif;font-size:1.3rem;font-weight:700;color:${subject.percentage < 75 ? '#e74c3c' : '#27ae60'}">${Math.round(subject.percentage || 0)}%</span>
        </div>
        <div class="subject-bar"><div class="subject-bar-fill ${pctClass(subject.percentage || 0)}" style="width:${Math.round(subject.percentage || 0)}%"></div></div>
        <div style="display:flex;justify-content:space-between;font-size:0.75rem;color:var(--text-muted);margin-top:0.4rem">
          <span>${subject.subject_code}</span>
          <span>${subject.attended}/${subject.total_classes}</span>
        </div>
      </div>
    `).join('');
  }

  async function initStudent() {
    const overview = await api('/api/student/overview');
    setText('#student-name', overview.student.name);
    setText('#welcome-name', overview.student.name.split(' ')[0]);
    setText('#overall-pct', `${overview.overall}%`);

    renderStudentCards(overview.summary);

    const warningBox = document.getElementById('warnings-container');
    if (warningBox) {
      const risky = overview.summary.filter((subject) => (subject.percentage || 0) < overview.threshold);
      warningBox.innerHTML = risky.length
        ? risky.map((subject) => `<div class="warning-card mild" style="margin-bottom:1rem"><strong>${subject.subject_name}</strong><p style="margin:0.4rem 0 0">${Math.round(subject.percentage || 0)}% attendance. Improve this subject to reach ${overview.threshold}%.</p></div>`).join('')
        : '<div class="warning-card mild"><strong>Great work.</strong><p style="margin:0.4rem 0 0">You are above the minimum threshold in all subjects.</p></div>';
    }

    window.submitLeave = async function () {
      const leaveType = document.getElementById('leave-type')?.value;
      const fromDate = document.getElementById('leave-from')?.value;
      const toDate = document.getElementById('leave-to')?.value || fromDate;
      const reason = document.getElementById('leave-reason')?.value;
      if (!leaveType || !fromDate || !reason) {
        showToast('Please fill all required leave details.', 'warning');
        return;
      }
      await api('/api/leaves', {
        method: 'POST',
        body: JSON.stringify({
          leave_type: leaveType,
          from_date: fromDate,
          to_date: toDate,
          reason
        })
      });
      showToast('Leave request submitted successfully.', 'success');
    };
  }

  async function boot() {
    if (!getAuth()?.token) {
      window.location.href = '/';
      return;
    }

    try {
      await api('/api/auth/me');
      const role = getPageRole();
      if (role === 'admin') await initAdmin();
      if (role === 'hod') await initHod();
      if (role === 'teacher') await initTeacher();
      if (role === 'student') await initStudent();
    } catch (error) {
      console.error(error);
    }
  }

  window.addEventListener('load', boot);
})();
