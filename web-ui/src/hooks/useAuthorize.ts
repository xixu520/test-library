import { useAuthStore } from '../store/AuthContext';

export const useAuthorize = () => {
    const { permissions } = useAuthStore();

    /**
     * Checks if the currently authenticated user has the specified permission claim.
     * @param action The specific capability to check (e.g. 'document:delete', 'system:config')
     * @returns true if the user possesses the permission, false otherwise.
     */
    const can = (action: string): boolean => {
        return permissions.includes(action);
    };

    /**
     * Checks if the user has ALL of the specified permissions.
     */
    const canAll = (actions: string[]): boolean => {
        return actions.every(action => permissions.includes(action));
    };

    /**
     * Checks if the user has ANY of the specified permissions.
     */
    const canAny = (actions: string[]): boolean => {
        return actions.some(action => permissions.includes(action));
    };

    return { can, canAll, canAny, permissions };
};
