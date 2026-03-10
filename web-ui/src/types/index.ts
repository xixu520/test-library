// 权限字符串字面量联合类型（可扩展）
export type Permission =
    | 'document:read'
    | 'document:write'
    | 'document:delete'
    | 'recycle:read'
    | 'recycle:write'
    | 'system:config'
    | 'auth:manage'        // 用户管理（原 auth:write 重命名，语义更清晰）
    | 'register:toggle';   // 控制注册开关专属权限

// 角色类型改为开放字符串，不再硬编码，支持未来扩展
export type UserRole = 'admin' | 'user' | string;

export interface User {
    id: number;
    username: string;
    role: UserRole;
    is_active: boolean;
    groups?: string[];
    permissions: Permission[];  // 改为必填，后端必须下发
}

export interface AuthResponse {
    token: string;
    user: User;
}

export interface Document {
    id: number;
    filename: string;
    original_name: string;
    file_path: string;
    document_number?: string;
    standard_name?: string;
    description?: string;
    category?: string;
    standard_type?: string;
    engineering_type?: string;
    publish_date?: string;
    effective_date?: string;
    abolish_date?: string;
    upload_date?: string; // ISO string
    ocr_status: 'pending' | 'processing' | 'completed' | 'failed' | 'skipped';
    file_size?: number;
    page_count?: number;
    is_deleted: boolean;
    deleted_at?: string | null;
}

// Reuse the same base interface for Recycle Bin, though sometimes it might have extra fields in the specific API return
export interface RecycleBinItem extends Document { }

export interface PaginationMeta {
    total: number;
    page: number;
    pageSize: number;
}

export interface PaginatedResponse<T> {
    documents: T[];
    total: number;
    page: number;
    pageSize: number;
}

export interface Category {
    id: number;
    name: string;
}

export interface OcrSettings {
    enabled?: boolean;
    baidu_api_key?: string;
    baidu_secret_key?: string;
}

// 新增：注册开关状态
export interface RegisterStatus {
    enabled: boolean;
}
