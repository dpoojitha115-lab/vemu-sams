(function () {
  const STORAGE_KEY = 'sams_auth';
  const roleButtons = document.querySelectorAll('.role-btn');
  const loginForm = document.getElementById('loginForm');
  const forgotLink = document.querySelector('.forgot-link');
  const errorEl = document.getElementById('errorMsg');
  const loginBtn = document.getElementById('loginBtn');
  const departmentGroup = document.getElementById('departmentGroup');
  const departmentCode = document.getElementById('departmentCode');
  const roleHint = document.getElementById('roleHint');

  let selectedRole = 'admin';

  function initParticles() {
    const container = document.getElementById('particles');
    if (!container) return;
    for (let i = 0; i < 30; i += 1) {
      const particle = document.createElement('div');
      particle.className = 'particle';
      const size = Math.random() * 3 + 1;
      particle.style.cssText = [
        `width:${size}px`,
        `height:${size}px`,
        `left:${Math.random() * 100}%`,
        `bottom:${Math.random() * 20}%`,
        `animation-duration:${Math.random() * 15 + 10}s`,
        `animation-delay:${Math.random() * 10}s`
      ].join(';');
      container.appendChild(particle);
    }
  }

  function showMessage(message, success) {
    errorEl.textContent = message;
    errorEl.classList.add('show');
    errorEl.style.color = success ? '#27ae60' : '';
  }

  function hideMessage() {
    errorEl.classList.remove('show');
    errorEl.style.color = '';
  }

  function setLoading(loading) {
    const text = loginBtn.querySelector('.btn-text');
    const loader = loginBtn.querySelector('.btn-loader');
    const arrow = loginBtn.querySelector('.btn-arrow');
    loginBtn.disabled = loading;
    text.style.display = loading ? 'none' : 'inline';
    loader.style.display = loading ? 'inline-flex' : 'none';
    arrow.style.display = loading ? 'none' : 'inline';
  }

  function storeAuth(payload, remember) {
    const storage = remember ? localStorage : sessionStorage;
    const otherStorage = remember ? sessionStorage : localStorage;
    otherStorage.removeItem(STORAGE_KEY);
    storage.setItem(STORAGE_KEY, JSON.stringify({
      token: payload.token,
      user: payload.user,
      timestamp: Date.now()
    }));
  }

  function getAuth() {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || sessionStorage.getItem(STORAGE_KEY) || 'null');
  }

  function redirectByRole(role) {
    const routes = {
      admin: '/admin',
      hod: '/hod',
      teacher: '/teacher',
      student: '/student'
    };
    window.location.href = routes[role] || '/';
  }

  function updateRoleUi() {
    const hints = {
      admin: 'Administrator access for reports, departments, faculty, and portal settings.',
      hod: 'HOD login requires department selection along with your username and password.',
      teacher: 'Faculty and teacher login opens attendance marking, reports, and leave tools.',
      student: 'Students can sign in with either roll number or student user ID.'
    };
    if (roleHint) roleHint.textContent = hints[selectedRole] || '';
    if (departmentGroup) {
      departmentGroup.style.display = selectedRole === 'hod' ? 'block' : 'none';
      departmentCode.required = selectedRole === 'hod';
      if (selectedRole !== 'hod') {
        departmentCode.value = '';
      }
    }
  }

  async function api(path, options) {
    const response = await fetch(path, {
      headers: { 'Content-Type': 'application/json' },
      ...options
    });
    const result = await response.json();
    if (!response.ok || !result.success) {
      throw new Error(result.error || 'Request failed.');
    }
    return result.data;
  }

  async function loadDepartments() {
    try {
      const response = await fetch('/api/public/departments');
      const result = await response.json();
      if (!response.ok || !result.success) return;
      departmentCode.innerHTML = '<option value="">Select department</option>' + result.data.map((dept) => (
        `<option value="${dept.code}">${dept.code} - ${dept.name}</option>`
      )).join('');
    } catch (error) {
      console.error(error);
    }
  }

  initParticles();
  loadDepartments();
  updateRoleUi();

  roleButtons.forEach((button) => {
    button.addEventListener('click', function () {
      roleButtons.forEach((item) => item.classList.remove('active'));
      button.classList.add('active');
      selectedRole = button.dataset.role;
      updateRoleUi();
      hideMessage();
    });
  });

  document.getElementById('togglePwd').addEventListener('click', function () {
    const input = document.getElementById('password');
    input.type = input.type === 'password' ? 'text' : 'password';
  });

  document.querySelectorAll('.demo-item').forEach((item) => {
    item.addEventListener('click', function () {
      const role = item.dataset.role;
      roleButtons.forEach((button) => button.classList.toggle('active', button.dataset.role === role));
      selectedRole = role;
      document.getElementById('userId').value = item.dataset.user;
      document.getElementById('password').value = item.dataset.pass;
      if (item.dataset.dept) {
        departmentCode.value = item.dataset.dept;
      }
      updateRoleUi();
      hideMessage();
    });
  });

  loginForm.addEventListener('submit', async function (event) {
    event.preventDefault();
    hideMessage();
    setLoading(true);

    try {
      const data = await api('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          user_id: document.getElementById('userId').value.trim(),
          password: document.getElementById('password').value,
          department_code: selectedRole === 'hod' ? departmentCode.value : ''
        })
      });

      if (data.user.role !== selectedRole) {
        throw new Error(`This account belongs to ${data.user.role.toUpperCase()}, not ${selectedRole.toUpperCase()}.`);
      }

      storeAuth(data, document.getElementById('rememberMe').checked);
      redirectByRole(data.user.role);
    } catch (error) {
      showMessage(error.message || 'Unable to sign in.', false);
    } finally {
      setLoading(false);
    }
  });

  forgotLink.addEventListener('click', async function (event) {
    event.preventDefault();
    hideMessage();

    const userId = window.prompt('Enter your User ID / Roll Number');
    if (!userId) return;
    const email = window.prompt('Enter your registered email (optional)');

    try {
      const data = await api('/api/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({
          user_id: userId.trim(),
          email: email ? email.trim() : ''
        })
      });

      showMessage('Reset link generated successfully. A local preview link is ready for testing.', true);
      if (data.reset_link && window.confirm('Open the reset link now?')) {
        window.location.href = data.reset_link;
      }
    } catch (error) {
      showMessage(error.message || 'Unable to start password reset.', false);
    }
  });

  const auth = getAuth();
  if (auth?.token && auth?.user?.role) {
    redirectByRole(auth.user.role);
  }
})();
