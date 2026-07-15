const ADMIN_PASSWORD = 'aral';
const SESSION_KEY = 'quiz_admin_auth';

const AdminAuth = {
  isAuthenticated() {
    return sessionStorage.getItem(SESSION_KEY) === '1';
  },

  login(password) {
    if (password === ADMIN_PASSWORD) {
      sessionStorage.setItem(SESSION_KEY, '1');
      return true;
    }
    return false;
  },

  logout() {
    sessionStorage.removeItem(SESSION_KEY);
  },

  checkPassword(password) {
    return password === ADMIN_PASSWORD;
  },
};

window.AdminAuth = AdminAuth;
