/**
 * AuthService.gs — autorización en servidor. Usuarios y administradores se definen en CONFIGURACION
 * (usuarios_emails, admin_emails; separados por coma). Si ambas listas están vacías (instalación inicial)
 * solo el propietario/deployer puede operar.
 */
var AuthService = {
  currentEmail: function () { return String(Session.getActiveUser().getEmail() || '').toLowerCase(); },
  _list: function (v) { return String(v || '').toLowerCase().split(',').map(function (s) { return s.trim(); }).filter(Boolean); },
  isOwner: function () { return AuthService.currentEmail() !== '' && AuthService.currentEmail() === String(Session.getEffectiveUser().getEmail() || '').toLowerCase(); },
  isAdmin: function () {
    var cfg = ConfigService.getAll(), me = AuthService.currentEmail();
    return AuthService.isOwner() || AuthService._list(cfg.admin_emails).indexOf(me) >= 0;
  },
  isUser: function () {
    var cfg = ConfigService.getAll(), me = AuthService.currentEmail();
    return AuthService.isAdmin() || AuthService._list(cfg.usuarios_emails).indexOf(me) >= 0;
  },
  requireUser: function () { if (!AuthService.isUser()) throw new Error('No autorizado.'); },
  requireAdmin: function () { if (!AuthService.isAdmin()) throw new Error('Acción reservada a administradores.'); }
};
