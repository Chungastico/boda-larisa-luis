import { AdminAccessForm } from '@/components/admin-access-form';
import { AdminDashboard } from '@/components/admin-dashboard';
import { hasAdminAccessConfiguration, isAdminSession } from '@/lib/admin-session';
import { getAdminInvitations, isDatabaseConfigured } from '@/lib/invitations';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  const isAdmin = await isAdminSession();

  if (!isAdmin) {
    return <AdminAccessForm configured={hasAdminAccessConfiguration()} />;
  }

  const invitations = await getAdminInvitations();

  return (
    <AdminDashboard
      initialInvitations={invitations}
      isDemo={!isDatabaseConfigured()}
    />
  );
}
