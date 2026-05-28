import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { useAdminUsers, useAdminUpdateUser, useAdminDeleteUser, type AdminUser } from "@/hooks/useAdmin";
import { Card, CardBody } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { Button } from "@/components/ui/Button";

const ROLES = ["admin", "employee", "owner"] as const;

export function AdminUsersPage() {
  const { data, isLoading } = useAdminUsers();
  const update = useAdminUpdateUser();
  const del = useAdminDeleteUser();

  const changeRole = async (u: AdminUser, role: string) => {
    try {
      await update.mutateAsync({ user_id: u.user_id, role });
      toast.success(`${u.email} → ${role}`);
    } catch (e) { toast.error((e as Error).message); }
  };

  const remove = async (u: AdminUser) => {
    if (!confirm(`Delete ${u.email}? They will lose access immediately.`)) return;
    try {
      await del.mutateAsync(u.user_id);
      toast.success("User deleted.");
    } catch (e) { toast.error((e as Error).message); }
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-ink-900 dark:text-ink-100">Users</h1>
        <p className="mt-1 text-sm text-ink-500">
          Promote TableAI staff to admin/employee. New users auto-provision as owners on first Supabase login.
        </p>
      </div>

      {isLoading ? (
        <Skeleton className="h-40" />
      ) : !data || data.length === 0 ? (
        <Card><CardBody className="py-8 text-center text-sm text-ink-500">No users yet.</CardBody></Card>
      ) : (
        <Card>
          <CardBody className="p-0">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wider text-ink-500 border-b border-ink-100 dark:border-ink-800">
                <tr>
                  <th className="px-5 py-3 font-medium">User</th>
                  <th className="px-5 py-3 font-medium">Role</th>
                  <th className="px-5 py-3 font-medium">Tenants</th>
                  <th className="px-5 py-3 font-medium"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100 dark:divide-ink-800">
                {data.map((u) => (
                  <tr key={u.user_id} className="hover:bg-ink-50 dark:hover:bg-ink-800/40">
                    <td className="px-5 py-3">
                      <div className="font-semibold text-ink-900 dark:text-ink-100">{u.email}</div>
                      {u.display_name && <div className="text-xs text-ink-500">{u.display_name}</div>}
                    </td>
                    <td className="px-5 py-3">
                      <select
                        value={u.role}
                        onChange={(e) => changeRole(u, e.target.value)}
                        className="rounded-lg border border-ink-200 bg-white px-2 py-1 text-sm capitalize dark:border-ink-700 dark:bg-ink-800"
                      >
                        {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                      </select>
                    </td>
                    <td className="px-5 py-3">
                      <Badge>{u.tenant_count}</Badge>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <Button variant="ghost" size="sm" onClick={() => remove(u)} className="text-red-500 hover:bg-red-50 dark:hover:bg-red-950">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
