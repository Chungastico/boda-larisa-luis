import { AdminDashboard } from '@/components/admin-dashboard';
import { getAdminInvitations, isDatabaseConfigured } from '@/lib/invitations';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  const invitations = await getAdminInvitations();

  return (
    <AdminDashboard
      initialInvitations={invitations}
      isDemo={!isDatabaseConfigured()}
    />
  );
}
