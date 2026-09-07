import { notFound } from 'next/navigation';
import { InvitationExperience } from '@/components/invitation-experience';
import { getInvitationBySlug } from '@/lib/invitations';

export const dynamic = 'force-dynamic';

export default async function InvitationPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const invitation = await getInvitationBySlug(slug);

  if (!invitation) notFound();

  return <InvitationExperience invitation={invitation} />;
}
