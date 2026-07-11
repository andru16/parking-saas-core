import { catchAsync } from '#utils/catchAsync.js';
import { sendSuccess } from '#utils/apiResponse.js';
import { orgUsersService } from './orgUsers.service.js';
import { orgRolesService } from './orgRoles.service.js';
import { rbacService } from '#services/rbac/rbac.service.js';

const audit = (req) => ({
  ip: req.ip,
  userAgent: req.get('user-agent') ?? null,
});

export const listUsers = catchAsync(async (req, res) => {
  const users = await orgUsersService.list(req.auth.organizationId);
  sendSuccess(res, { data: { users } });
});

export const getUser = catchAsync(async (req, res) => {
  const user = await orgUsersService.getById(req.auth.organizationId, req.params.userId);
  sendSuccess(res, { data: { user } });
});

export const createUser = catchAsync(async (req, res) => {
  const result = await orgUsersService.create(
    req.auth.organizationId,
    req.auth.userId,
    req.body,
    audit(req),
  );
  sendSuccess(res, {
    statusCode: 201,
    message: 'Usuario creado',
    data: result,
  });
});

export const updateUser = catchAsync(async (req, res) => {
  const user = await orgUsersService.update(
    req.auth.organizationId,
    req.auth.userId,
    req.params.userId,
    req.body,
    audit(req),
  );
  sendSuccess(res, { message: 'Usuario actualizado', data: { user } });
});

export const resetUserPassword = catchAsync(async (req, res) => {
  const result = await orgUsersService.requestPasswordReset(
    req.auth.organizationId,
    req.auth.userId,
    req.params.userId,
    audit(req),
  );
  sendSuccess(res, {
    message: 'Contraseña temporal generada (arquitectura de reset preparada)',
    data: result,
  });
});

export const listRoles = catchAsync(async (req, res) => {
  const roles = await orgRolesService.list(req.auth.organizationId);
  sendSuccess(res, { data: { roles } });
});

export const getRole = catchAsync(async (req, res) => {
  const role = await orgRolesService.getById(req.auth.organizationId, req.params.roleId);
  sendSuccess(res, { data: { role } });
});

export const createRole = catchAsync(async (req, res) => {
  const role = await orgRolesService.create(
    req.auth.organizationId,
    req.auth.userId,
    req.body,
    audit(req),
  );
  sendSuccess(res, { statusCode: 201, message: 'Rol creado', data: { role } });
});

export const updateRole = catchAsync(async (req, res) => {
  const role = await orgRolesService.update(
    req.auth.organizationId,
    req.auth.userId,
    req.params.roleId,
    req.body,
    audit(req),
  );
  sendSuccess(res, { message: 'Rol actualizado', data: { role } });
});

export const duplicateRole = catchAsync(async (req, res) => {
  const role = await orgRolesService.duplicate(
    req.auth.organizationId,
    req.auth.userId,
    req.params.roleId,
    audit(req),
  );
  sendSuccess(res, { statusCode: 201, message: 'Rol duplicado', data: { role } });
});

export const deleteRole = catchAsync(async (req, res) => {
  const result = await orgRolesService.remove(
    req.auth.organizationId,
    req.auth.userId,
    req.params.roleId,
    audit(req),
  );
  sendSuccess(res, { message: 'Rol eliminado', data: result });
});

export const getPermissionCatalog = catchAsync(async (_req, res) => {
  sendSuccess(res, { data: { modules: rbacService.getPermissionCatalog() } });
});
