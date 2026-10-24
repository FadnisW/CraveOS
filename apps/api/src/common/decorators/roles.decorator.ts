import { SetMetadata } from '@nestjs/common';
import { AdminSubRole } from '@prisma/client';

export type UserRole = 'CUSTOMER' | 'HUB_STAFF' | 'HUB_MANAGER' | 'BRAND_OPS' | 'RIDER' | 'ADMIN';

export const ROLES_KEY = 'roles';
export const ADMIN_SUB_ROLES_KEY = 'adminSubRoles';

export const Roles = (...roles: (UserRole | string)[]) => SetMetadata(ROLES_KEY, roles);
export const AdminSubRoles = (...subRoles: (AdminSubRole | string)[]) => SetMetadata(ADMIN_SUB_ROLES_KEY, subRoles);

