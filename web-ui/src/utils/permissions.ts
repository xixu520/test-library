import { Permission, UserRole } from '../types';

// 角色默认权限表（仅作后端未下发时的离线降级兜底）
const ROLE_PERMISSION_MAP: Record<string, Permission[]> = {
    admin: [
        'document:read', 'document:write', 'document:delete',
        'recycle:read', 'recycle:write',
        'system:config', 'auth:manage', 'register:toggle',
    ],
    user: ['document:read'],
    // 新增角色只需在此追加，无需改动任何组件
};

export const mapRoleToPermissions = (role: UserRole): Permission[] =>
    ROLE_PERMISSION_MAP[role] ?? ['document:read'];
