'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Check, Heart, Minus, Plus } from 'lucide-react';
import gsap from 'gsap';
import type { Invitation, RsvpAttendeeInput, RsvpStatus } from '@/lib/invitations';

const weddingDate = new Date('2026-10-04T16:00:00-06:00');

type GalleryPhoto = {
  src: string;
  alt: string;
  frame: 'diagonal-bottom' | 'diagonal-top' | 'arch-bottom' | 'arch-top';
};

const galleryPhotos: readonly GalleryPhoto[] = [
  { src: '/figma/photos/labios-rojos.png', alt: 'Larissa y Luis en la naturaleza', frame: 'diagonal-bottom' },
  { src: '/figma/photos/puerta-del-diablo.png', alt: 'Larissa y Luis en la Puerta del Diablo', frame: 'arch-top' },
  { src: '/figma/photos/playa-negro.png', alt: 'Larissa y Luis en la playa al atardecer', frame: 'arch-bottom' },
  { src: '/figma/photos/lago-celeste.png', alt: 'Larissa y Luis junto al lago', frame: 'diagonal-top' },
  { src: '/figma/photos/playa-oscuro.png', alt: 'Larissa y Luis en la playa', frame: 'diagonal-bottom' },
  { src: '/figma/photos/calles-de-piedra.png', alt: 'Larissa y Luis en calles de piedra', frame: 'arch-top' },
];

function randomGalleryOrder(previous: readonly GalleryPhoto[]) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const next = [...previous];

    for (let index = next.length - 1; index > 0; index -= 1) {
      const randomIndex = Math.floor(Math.random() * (index + 1));
      [next[index], next[randomIndex]] = [next[randomIndex], next[index]];
    }

    if (next.every((photo, index) => photo.src !== previous[index]?.src)) {
      return next;
    }
  }

  return [...previous.slice(1), previous[0]!];
}

type FamilyRsvpMode = 'all' | 'partial' | 'declined';

function initialMemberSelection(invitation: Invitation) {
  return Object.fromEntries(
    invitation.invitees.map((invitee) => [
      invitee.id,
      invitee.isAttending ?? (
        invitation.status === 'ACCEPTED'
          ? true
          : invitation.status === 'DECLINED'
            ? false
            : null
      ),
    ]),
  ) as Record<string, boolean | null>;
}

type WebMcpContext = {
  registerTool: (
    tool: {
      name: string;
      title: string;
      description: string;
      inputSchema: object;
      annotations: { readOnlyHint: boolean; untrustedContentHint: boolean };
      execute: (input: unknown) => Promise<unknown>;
    },
    options: { signal: AbortSignal },
  ) => void | Promise<void>;
};

function Countdown() {
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    const updateRemaining = () => {
      setRemaining(Math.max(0, weddingDate.getTime() - Date.now()));
    };

    updateRemaining();
    const timer = window.setInterval(updateRemaining, 1_000);

    return () => window.clearInterval(timer);
  }, []);

  const parts = useMemo(() => {
    const totalSeconds = Math.floor(remaining / 1_000);
    const days = Math.floor(totalSeconds / 86_400);
    const hours = Math.floor((totalSeconds % 86_400) / 3_600);
    const minutes = Math.floor((totalSeconds % 3_600) / 60);
    const seconds = totalSeconds % 60;

    return [
      { value: days, label: 'Días' },
      { value: hours, label: 'Horas' },
      { value: minutes, label: 'Min' },
      { value: seconds, label: 'Seg' },
    ];
  }, [remaining]);

  return (
    <div className="mx-auto grid w-full max-w-[448px] grid-cols-4 gap-2" aria-label="Cuenta regresiva">
      {parts.map((part, index) => (
        <div key={part.label} className="relative isolate aspect-[106/84] overflow-hidden text-center text-[#2a2a1c]">
          <img
            src={index % 2 === 0
              ? '/figma/design/countdown-chip-olive.svg'
              : '/figma/design/countdown-chip-cream.svg'}
            alt=""
            className="absolute inset-0 -z-10 h-full w-full"
          />
          <p className="pt-[14px] font-display text-[22px] font-bold leading-none tabular-nums">
            {String(part.value).padStart(2, '0')}
          </p>
          <p className="mt-[3px] text-[8.5px] font-bold uppercase tracking-[1px]">{part.label}</p>
        </div>
      ))}
    </div>
  );
}

export function InvitationExperience({
  invitation,
}: {
  invitation: Invitation;
}) {
  const pageRef = useRef<HTMLDivElement>(null);
  const heroImageRef = useRef<HTMLImageElement>(null);
  const galleryCardsRef = useRef<(HTMLElement | null)[]>([]);
  const hasRenderedGalleryRef = useRef(false);
  const [visibleGalleryPhotos, setVisibleGalleryPhotos] = useState(() => [...galleryPhotos]);
  const isFamilyInvitation = invitation.invitees.length > 1 || invitation.maxGuests > 1;
  const [decision, setDecision] = useState<RsvpStatus | null>(
    invitation.status === 'PENDING' ? null : invitation.status,
  );
  const [guestCount, setGuestCount] = useState(
    invitation.attendingCount || invitation.maxGuests,
  );
  const [note, setNote] = useState(invitation.note ?? '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [savedStatus, setSavedStatus] = useState<RsvpStatus | null>(invitation.status === 'PENDING' ? null : invitation.status);
  const [error, setError] = useState('');
  const [familyMode, setFamilyMode] = useState<FamilyRsvpMode | null>(() => {
    if (!isFamilyInvitation) return null;
    if (invitation.status === 'DECLINED') return 'declined';
    if (invitation.status === 'ACCEPTED') {
      const hasDeclinedMember = invitation.invitees.some((invitee) => invitee.isAttending === false);
      return hasDeclinedMember ? 'partial' : 'all';
    }
    return null;
  });
  const [memberSelection, setMemberSelection] = useState(() => initialMemberSelection(invitation));

  useEffect(() => {
    const root = document.documentElement;
    const visualViewport = window.visualViewport;
    const updateViewportHeight = () => {
      const height = visualViewport?.height ?? window.innerHeight;
      root.style.setProperty('--invitation-browser-height', `${Math.round(height)}px`);
    };

    updateViewportHeight();
    visualViewport?.addEventListener('resize', updateViewportHeight);
    visualViewport?.addEventListener('scroll', updateViewportHeight);
    window.addEventListener('resize', updateViewportHeight);

    return () => {
      visualViewport?.removeEventListener('resize', updateViewportHeight);
      visualViewport?.removeEventListener('scroll', updateViewportHeight);
      window.removeEventListener('resize', updateViewportHeight);
      root.style.removeProperty('--invitation-browser-height');
    };
  }, []);

  const persistRsvp = useCallback(
    async (
      status: RsvpStatus,
      attendingCount: number,
      message: string,
      attendees?: RsvpAttendeeInput[],
    ) => {
      const response = await fetch('/api/rsvp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug: invitation.slug,
          status,
          attendingCount,
          note: message,
          attendees,
        }),
      });
      const payload = (await response.json().catch(() => null)) as {
        invitation?: Invitation;
        error?: string;
      } | null;

      if (!response.ok || !payload?.invitation) {
        throw new Error(payload?.error ?? 'No se pudo guardar tu respuesta.');
      }

      setSavedStatus(status);
      return payload.invitation;
    },
    [invitation.slug],
  );

  useEffect(() => {
    const context = gsap.context(() => {
      gsap.from('[data-invitation-reveal]', {
        autoAlpha: 0,
        duration: 0.75,
        ease: 'power2.out',
        stagger: 0.08,
        y: 18,
      });
    }, pageRef);

    const heroImage = heroImageRef.current;
    const scroller = pageRef.current;
    if (!heroImage || !scroller) return () => context.revert();

    const moveHero = gsap.quickTo(heroImage, 'y', {
      duration: 0.55,
      ease: 'power2.out',
    });
    const onScroll = () => moveHero(Math.min(scroller.scrollTop * 0.045, 26));

    scroller.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      context.revert();
      scroller.removeEventListener('scroll', onScroll);
    };
  }, []);

  useEffect(() => {
    const cards = galleryCardsRef.current.filter((card): card is HTMLElement => Boolean(card));
    if (!hasRenderedGalleryRef.current) {
      hasRenderedGalleryRef.current = true;
      return;
    }

    const timeline = gsap.fromTo(
      cards,
      { autoAlpha: 0, scale: 0.975 },
      {
        autoAlpha: 1,
        scale: 1,
        duration: 0.7,
        ease: 'power3.out',
        stagger: { each: 0.075, from: 'random' },
      },
    );

    return () => {
      timeline.kill();
    };
  }, [visibleGalleryPhotos]);

  const refreshGallery = useCallback(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const cards = galleryCardsRef.current.filter((card): card is HTMLElement => Boolean(card));
    if (!cards.length) return;

    gsap.killTweensOf(cards);
    gsap.to(cards, {
      autoAlpha: 0,
      scale: 0.975,
      duration: 0.32,
      ease: 'power2.in',
      stagger: { each: 0.055, from: 'random' },
      onComplete: () => setVisibleGalleryPhotos((photos) => randomGalleryOrder(photos)),
    });
  }, []);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const rotation = window.setInterval(refreshGallery, 7_500);

    return () => window.clearInterval(rotation);
  }, [refreshGallery]);

  useEffect(() => {
    const context = (document as Document & { modelContext?: WebMcpContext }).modelContext;
    if (!context?.registerTool) return;

    const lifecycle = new AbortController();

    try {
      void Promise.resolve(
        context.registerTool(
          {
            name: 'confirm_wedding_rsvp',
            title: 'Confirmar RSVP',
            description: 'Registra la confirmacion o declinacion de esta invitacion de boda.',
            inputSchema: {
              type: 'object',
              properties: {
                status: { type: 'string', enum: ['ACCEPTED', 'DECLINED'] },
                attendingCount: { type: 'integer', minimum: 0, maximum: invitation.maxGuests },
                note: { type: 'string', maxLength: 500 },
              },
              required: ['status'],
              additionalProperties: false,
            },
            annotations: { readOnlyHint: false, untrustedContentHint: false },
            async execute(input) {
              if (!input || typeof input !== 'object') {
                throw new Error('RSVP input must be an object.');
              }

              const values = input as Record<string, unknown>;
              const status = values.status;
              if (status !== 'ACCEPTED' && status !== 'DECLINED') {
                throw new Error('status must be ACCEPTED or DECLINED.');
              }

              const count = status === 'ACCEPTED'
                ? Math.max(
                    1,
                    Math.min(
                      invitation.maxGuests,
                      Number.isInteger(values.attendingCount)
                        ? Number(values.attendingCount)
                        : invitation.maxGuests,
                    ),
                  )
                : 0;
              const message = typeof values.note === 'string' ? values.note.slice(0, 500) : '';

              setDecision(status);
              setGuestCount(count || invitation.maxGuests);
              setNote(message);
              const saved = await persistRsvp(status, count, message);

              return {
                status: saved.status,
                attendingCount: saved.attendingCount,
                recipientName: saved.recipientName,
              };
            },
          },
          { signal: lifecycle.signal },
        ),
      ).catch(() => undefined);
    } catch {
      return () => lifecycle.abort();
    }

    return () => lifecycle.abort();
  }, [invitation.maxGuests, persistRsvp]);

  async function submitRsvp() {
    if (isFamilyInvitation && !familyMode) {
      setError('Elige si asistirán todos o si deseas confirmar de forma parcial.');
      return;
    }

    if (isFamilyInvitation && familyMode === 'partial') {
      const missingMember = invitation.invitees.some((invitee) => memberSelection[invitee.id] === null);
      if (missingMember) {
        setError('Selecciona quién asistirá y quién no podrá asistir.');
        return;
      }
    }

    const attendees = isFamilyInvitation && invitation.invitees.length
      ? invitation.invitees.map((invitee) => ({
          id: invitee.id,
          isAttending: memberSelection[invitee.id] === true,
        }))
      : undefined;
    const selectedCount = attendees?.filter((attendee) => attendee.isAttending).length ?? guestCount;
    const resolvedStatus = isFamilyInvitation
      ? familyMode === 'declined'
        ? 'DECLINED'
        : attendees
          ? selectedCount > 0 ? 'ACCEPTED' : 'DECLINED'
          : decision
      : decision;

    if (!resolvedStatus) {
      setError('Selecciona una respuesta para continuar.');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      await persistRsvp(resolvedStatus, selectedCount, '', attendees);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'No se pudo guardar tu respuesta.',
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  const selectedMemberCount = invitation.invitees.filter((invitee) => memberSelection[invitee.id] === true).length;

  function selectAllFamilyMembers() {
    setMemberSelection(Object.fromEntries(invitation.invitees.map((invitee) => [invitee.id, true])));
    setFamilyMode('all');
    setDecision('ACCEPTED');
    setGuestCount(invitation.invitees.length || invitation.maxGuests);
    setSavedStatus(null);
    setError('');
  }

  function selectNoFamilyMembers() {
    setMemberSelection(Object.fromEntries(invitation.invitees.map((invitee) => [invitee.id, false])));
    setFamilyMode('declined');
    setDecision('DECLINED');
    setGuestCount(0);
    setSavedStatus(null);
    setError('');
  }

  function selectFamilyMode(mode: FamilyRsvpMode) {
    setFamilyMode(mode);
    setSavedStatus(null);
    setError('');
  }

  function updateMemberSelection(id: string, isAttending: boolean) {
    const nextSelection = { ...memberSelection, [id]: isAttending };
    const nextCount = Object.values(nextSelection).filter(Boolean).length;
    setMemberSelection(nextSelection);
    setFamilyMode('partial');
    setDecision(nextCount > 0 ? 'ACCEPTED' : 'DECLINED');
    setGuestCount(nextCount);
    setSavedStatus(null);
    setError('');
  }

  return (
    <main className="invitation-shell overflow-hidden bg-[#24291e] md:p-5">
      <div
        ref={pageRef}
        className="invitation-scroller mx-auto h-full max-w-[480px] overflow-y-auto bg-[#f4eee2] shadow-2xl"
      >
        <nav aria-label="Secciones de la invitación" className="invitation-nav sticky top-0 z-50 flex h-[var(--invitation-nav-height)] items-center border-b border-[#2a2a1c]/15 bg-[#c7b79c] px-3 text-center text-[8px] font-bold uppercase tracking-[0.4px] text-[#2a2a1c]">
          <a href="#inicio" aria-label="Inicio" className="grid h-full w-8 shrink-0 place-items-center"><img src="/figma/design/navbar-mark.svg" alt="" className="h-7 w-6" /></a>
          <div className="invitation-nav-links min-w-0 flex-1">
            <div className="flex min-w-max items-center justify-between gap-3 px-1">
              <a href="#bienvenida" className="shrink-0 whitespace-nowrap px-1 py-3 hover:opacity-60">Bienvenida</a>
              <a href="#vestimenta" className="shrink-0 whitespace-nowrap px-1 py-3 hover:opacity-60">Vestimenta</a>
              <a href="#ubicacion" className="shrink-0 whitespace-nowrap px-1 py-3 hover:opacity-60">Ubicación</a>
              <a href="#rsvp" className="shrink-0 whitespace-nowrap px-1 py-3 hover:opacity-60">RSVP</a>
              <a href="#galeria" className="shrink-0 whitespace-nowrap px-1 py-3 hover:opacity-60">Galería</a>
            </div>
          </div>
        </nav>

        <section id="inicio" className="story-screen relative isolate overflow-hidden bg-[#2a2a1c] text-[#f4eee2]">
          <div className="relative h-full overflow-hidden text-center">
            <img
              ref={heroImageRef}
              src="/figma/hero-1.png"
              alt="Larissa y Luis frente a la iglesia"
              className="absolute inset-0 -z-30 h-full w-full object-cover object-center"
            />
            <div className="absolute inset-0 -z-20 bg-[#1d2118]/[0.12]" />

            <p data-invitation-reveal className="absolute left-1/2 top-[5.1%] w-full -translate-x-1/2 text-[20px] font-normal tracking-[5px] text-[#f4eee2]">4 · 10 · 2026</p>
            <h1 className="sr-only">Larissa y Luis</h1>
            <img data-invitation-reveal src="/figma/type/larissa.svg" alt="" className="absolute left-[38.125%] top-[53.63%] h-auto w-[51.4583%] -translate-x-1/2" />
            <img data-invitation-reveal src="/figma/type/ampersand.svg" alt="" className="absolute left-1/2 top-[65.48%] h-auto w-[11.4583%] -translate-x-1/2" />
            <img data-invitation-reveal src="/figma/type/luis.svg" alt="" className="absolute left-[63.5417%] top-[72.99%] h-auto w-[35.2083%] -translate-x-1/2" />
            <p data-invitation-reveal className="absolute left-1/2 top-[89.94%] w-full -translate-x-1/2 text-[20px] font-bold uppercase tracking-[4px] text-[#c7b79c]">Nos casamos</p>
          </div>
        </section>

        <section id="cuenta-regresiva" className="story-screen relative isolate overflow-hidden bg-[#2a2a1c] text-center text-[#f4eee2]">
          <img src="/figma/countdown-card.png" alt="" className="absolute inset-0 -z-10 h-full w-full object-cover object-center" />
          <h2 className="sr-only">Cuenta regresiva</h2>
          <img
            data-invitation-reveal
            src="/figma/type/countdown-title.svg"
            alt=""
            className="absolute left-[40.2083%] top-[55.4%] h-auto w-[281px] max-w-[72%] -translate-x-1/2 scale-x-[0.82]"
          />
          <p data-invitation-reveal className="absolute left-[61.6667%] top-[68.15%] -translate-x-1/2 whitespace-nowrap text-[26px] font-bold uppercase tracking-normal">
            Falta poco
          </p>
          <div data-invitation-reveal className="absolute inset-x-0 top-[81.4%] px-4"><Countdown /></div>
        </section>

        <section id="bienvenida" className="story-screen flex flex-col items-center justify-center bg-[#8b9574] px-7 text-center text-[#2a2a1c]">
          <div data-invitation-reveal className="w-full max-w-[374px]">
            <img src="/figma/design/welcome-photo.png" alt="Larissa y Luis juntos" className="mx-auto block h-auto w-full max-w-[374px] object-contain" loading="lazy" />
            <p className="font-script mt-5 text-[30px] leading-none tracking-normal">¡Bienvenidos!</p>
            <p className="mx-auto mt-5 max-w-[335px] text-[13px] leading-[1.7]">
              Queremos que nos acompañes a celebrar el inicio de esta nueva etapa, rodeados de las personas que más queremos. El amor se multiplica cuando se comparte.
            </p>
            <p className="mt-7 text-[15px] font-bold uppercase tracking-[0.5px]">¡Te esperamos!</p>
          </div>
        </section>

        <section className="story-screen paper-texture relative isolate flex flex-col items-center justify-center overflow-hidden px-7 text-center text-[#2a2a1c]">
          <img src="/figma/design/ceremony-texture.png" alt="" className="absolute inset-0 -z-10 h-full w-full object-cover opacity-[0.14] mix-blend-multiply" />
          <div data-invitation-reveal className="max-w-[355px]">
            <p className="font-script text-[30px] leading-none text-[#8b9574]">Ceremonia civil</p>
            <p className="mt-4 text-[21px] font-bold">7:00 - 10:00 AM</p>
            <div className="mx-auto mt-7 h-px w-20 bg-[#c7b79c]" />
            <p className="mt-7 text-[13px] leading-[1.75]">
              La ceremonia civil se realizara en un ambiente intimo, seguida de un desayuno para celebrar los primeros minutos como esposos. Un momento sencillo, cercano y lleno de carino.
            </p>
          </div>
        </section>

        <section id="vestimenta" className="story-screen dress-screen relative isolate overflow-hidden bg-[#2a2a1c] text-center text-[#2a2a1c]">
          <img src="/figma/design/dress-photo.png" alt="Larissa y Luis vestidos de negro" className="dress-photo absolute inset-x-0 top-0 z-0 w-full object-cover object-center" loading="lazy" />
          <div aria-hidden="true" className="dress-veil absolute inset-x-0 top-0 z-10" />
          <img src="/figma/design/dress-card.svg" alt="" className="dress-card absolute inset-x-0 z-20 w-full" />
          <div data-invitation-reveal className="dress-content absolute inset-0 z-30">
            <p className="dress-script font-script text-[#8b9574] [text-shadow:0px_4px_10px_rgba(0,0,0,0.25)]">Código de vestimenta</p>
            <p className="dress-title font-bold uppercase tracking-[0.5px]">Etiqueta semi-formal</p>
            <div className="dress-copy text-[rgba(42,42,28,0.85)]">
              <p>Pedimos a nuestros invitados vestir de etiqueta semi-formal.</p>
              <p>Evitar el <em>blanco, marfil y tonos beige</em>, reservados para los <em>novios</em>.</p>
            </div>
            <a href="https://pin.it/4PcnHhnvF" target="_blank" rel="noreferrer" aria-label="Ver inspiración de vestimenta en Pinterest" className="dress-inspo-button">
              <img src="/figma/design/map-button.svg" alt="" className="absolute inset-0 h-full w-full" />
              <span className="relative">Ver inspo</span>
            </a>
            <p className="dress-adults-note font-bold">En esta ocasión, el evento es solo para adultos.</p>
          </div>
        </section>

        <section id="ubicacion" className="story-screen relative isolate flex flex-col overflow-hidden bg-[#2a2a1c] text-center">
          <div className="relative z-10 h-[53%] shrink-0 overflow-hidden rounded-b-[46px]">
            <img src="/figma/design/location-photo.png" alt="Larissa y Luis sentados juntos" className="h-full w-full object-cover object-center" loading="lazy" />
          </div>
          <img src="/figma/design/location-background.png" alt="" className="absolute inset-0 z-0 h-full w-full object-cover" />
          <div data-invitation-reveal className="relative z-20 flex flex-1 flex-col items-center justify-center px-7 text-[#f4eee2]">
            <p className="font-script text-[30px] leading-none text-[#c7b79c]">Ubicación</p>
            <p className="mt-4 text-[20px] font-bold uppercase tracking-[0.2px]">Restaurante Hacienda Real</p>
            <p className="mt-2 text-[11px] tracking-[0.5px] text-[#c7b79c]">Km 14.5 carretera a Santa Tecla, La Libertad</p>
            <p className="mt-6 max-w-[340px] text-[13px] leading-[1.7] text-[#f4eee2]/80">Habrá parqueo disponible dentro de las instalaciones para todos los invitados.</p>
            <a href="https://www.google.com/maps/search/?api=1&query=Restaurante+Hacienda+Real+La+Libertad+El+Salvador" target="_blank" rel="noreferrer" className="relative mt-7 grid h-[54px] w-[184px] place-items-center text-[12px] font-bold uppercase tracking-[0.8px] text-[#2a2a1c]">
              <img src="/figma/design/map-button.svg" alt="" className="absolute inset-0 h-full w-full" />
              <span className="relative">Ver mapa</span>
            </a>
          </div>
        </section>

        <section id="rsvp" className="story-screen rsvp-screen relative isolate flex flex-col justify-center bg-[#d9dfc2] px-7 py-8 text-center text-[#2a2a1c]">
          <img src="/figma/design/rsvp-background.png" alt="" className="absolute inset-0 z-0 h-full w-full object-cover object-center" />
          <div data-invitation-reveal className="relative z-10 mx-auto flex w-full max-w-[348px] flex-col items-center">
            <p className="font-script text-[30px] leading-none text-[#2a2a1c]">Reservación</p>
            <h2 className="mt-4 text-[22px] font-bold uppercase tracking-[0.2px]">Confirma tu asistencia</h2>
            <p className="mt-4 text-[12px] leading-[1.55]">
              Antes del <strong>21 de septiembre de 2026</strong>, por favor.<br />
              En esta <strong>ocasión</strong>, el evento es solo para <strong>adultos.</strong>
            </p>

            <div className="mt-6 w-full">
              <p className="text-[12px] font-bold uppercase tracking-[1px]">Hemos reservado:</p>
              <p className="mt-2 text-[25px] font-bold uppercase leading-[1.05]">{invitation.recipientName}</p>
              <p className="mt-2 text-[14px] italic">{invitation.tableName ?? 'Mesa por asignar'}</p>
              <p className="mt-3 text-[12px]">
                {isFamilyInvitation ? `${invitation.maxGuests} espacios para adultos` : '1 espacio para adultos'}
              </p>
              <p className="mt-3 text-[11px] leading-4">Aquí puedes modificar el estado de tu invitación.</p>
            </div>

            {savedStatus ? (
              <div data-invitation-reveal className="mt-5 w-full border border-[#2a2a1c]/25 bg-[#f4eee2]/75 px-5 py-5">
                {savedStatus === 'ACCEPTED' ? <Check className="mx-auto" size={25} /> : <Heart className="mx-auto" size={25} />}
                <p className="font-script mt-3 text-[30px] leading-none">
                  {savedStatus === 'ACCEPTED' ? '¡Te esperamos!' : 'Gracias por avisarnos'}
                </p>
                <p className="mt-3 text-[12px] leading-5">
                  {savedStatus === 'ACCEPTED'
                    ? `${selectedMemberCount || guestCount} de ${invitation.maxGuests} personas confirmadas.`
                    : 'La invitación quedó cancelada.'}
                </p>
                <button
                  type="button"
                  onClick={() => { setSavedStatus(null); setError(''); }}
                  className="mt-5 h-[40px] border border-[#2a2a1c] bg-[#f4eee2]/40 px-5 text-[11px] font-bold uppercase tracking-[0.7px]"
                >
                  Modificar respuesta
                </button>
              </div>
            ) : (
              <div className="mt-5 w-full">
                <p className="text-left text-[12px] font-bold uppercase tracking-[1px]">
                  {isFamilyInvitation ? '¿Quiénes asistirán?' : '¿Asistirás?'}
                </p>

                {isFamilyInvitation ? (
                  <>
                    <div className="mt-3 grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        aria-pressed={familyMode === 'all'}
                        onClick={selectAllFamilyMembers}
                        className={`relative h-[46px] text-[11px] font-bold uppercase tracking-[0.35px] transition-colors ${familyMode === 'all' ? 'overflow-hidden text-[#f4eee2] ring-2 ring-[#c7b79c] ring-offset-1 ring-offset-[#d9dfc2]' : 'border border-[#2a2a1c] bg-[#f4eee2]/40 text-[#2a2a1c]'}`}
                      >
                        {familyMode === 'all' && <img src="/figma/design/rsvp-yes-button.svg" alt="" className="absolute inset-0 h-full w-full" />}
                        <span className="relative">Confirmar todos</span>
                      </button>
                      <button
                        type="button"
                        aria-pressed={familyMode === 'partial'}
                        onClick={() => selectFamilyMode('partial')}
                        className={`h-[46px] border border-[#2a2a1c] text-[11px] font-bold uppercase tracking-[0.35px] transition-colors ${familyMode === 'partial' ? 'bg-[#f4eee2] text-[#2a2a1c]' : 'bg-[#f4eee2]/40 text-[#2a2a1c]'}`}
                      >
                        Confirmación parcial
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={selectNoFamilyMembers}
                      className={`mt-3 h-[36px] w-full border border-[#2a2a1c] text-[11px] font-bold uppercase tracking-[0.65px] ${familyMode === 'declined' ? 'bg-[#2a2a1c] text-[#f4eee2]' : 'bg-[#f4eee2]/30 text-[#2a2a1c]'}`}
                    >
                      No podremos asistir
                    </button>

                    {familyMode === 'partial' && (
                      <div className="mt-3 w-full border border-[#2a2a1c]/25 bg-[#f4eee2]/45 px-3 py-3 text-left">
                        <p className="text-[11px] font-bold uppercase tracking-[0.7px]">Selecciona por persona</p>
                        <div className="mt-2 space-y-2">
                          {invitation.invitees.map((invitee) => (
                            <div key={invitee.id} className="flex items-center justify-between gap-2 border-b border-[#2a2a1c]/15 pb-2 last:border-0 last:pb-0">
                              <span className="min-w-0 flex-1 text-[11px] leading-4">{invitee.name}</span>
                              <div className="grid shrink-0 grid-cols-2 gap-1">
                                <button
                                  type="button"
                                  aria-pressed={memberSelection[invitee.id] === true}
                                  onClick={() => updateMemberSelection(invitee.id, true)}
                                  className={`h-[28px] w-[34px] text-[10px] font-bold uppercase ${memberSelection[invitee.id] === true ? 'bg-[#2a2a1c] text-[#f4eee2]' : 'border border-[#2a2a1c]/50 bg-[#f4eee2]/35'}`}
                                >
                                  Sí
                                </button>
                                <button
                                  type="button"
                                  aria-pressed={memberSelection[invitee.id] === false}
                                  onClick={() => updateMemberSelection(invitee.id, false)}
                                  className={`h-[28px] w-[34px] text-[10px] font-bold uppercase ${memberSelection[invitee.id] === false ? 'bg-[#8b9574] text-[#2a2a1c]' : 'border border-[#2a2a1c]/50 bg-[#f4eee2]/35'}`}
                                >
                                  No
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                        <p className="mt-3 text-right text-[11px] font-bold">{selectedMemberCount} de {invitation.invitees.length} asistirán</p>
                      </div>
                    )}
                    {familyMode === 'all' && <p className="mt-3 text-[11px]">Asistirán todos los integrantes de la invitación.</p>}
                    {familyMode === 'declined' && <p className="mt-3 text-[11px]">No asistirá ningún integrante de la invitación.</p>}
                  </>
                ) : (
                  <>
                    <div className="mt-3 grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        aria-pressed={decision === 'ACCEPTED'}
                        onClick={() => { setDecision('ACCEPTED'); setSavedStatus(null); setError(''); }}
                        className={`relative h-[46px] text-[11px] font-bold uppercase tracking-[0.35px] transition-colors ${decision === 'ACCEPTED' ? 'overflow-hidden text-[#f4eee2]' : 'border border-[#2a2a1c] bg-[#f4eee2]/40 text-[#2a2a1c]'}`}
                      >
                        {decision === 'ACCEPTED' && <img src="/figma/design/rsvp-yes-button.svg" alt="" className="absolute inset-0 h-full w-full" />}
                        <span className="relative">Sí, asistiré</span>
                      </button>
                      <button
                        type="button"
                        aria-pressed={decision === 'DECLINED'}
                        onClick={() => { setDecision('DECLINED'); setSavedStatus(null); setError(''); }}
                        className={`h-[46px] border border-[#2a2a1c] text-[11px] font-bold uppercase tracking-[0.35px] transition-colors ${decision === 'DECLINED' ? 'bg-[#2a2a1c] text-[#f4eee2]' : 'bg-[#f4eee2]/40 text-[#2a2a1c]'}`}
                      >
                        No podré asistir
                      </button>
                    </div>

                    {decision === 'ACCEPTED' && invitation.maxGuests > 1 && (
                      <div className="mt-4 flex items-center justify-center gap-4 text-[12px]">
                        <span>Personas que asistirán</span>
                        <div className="flex h-8 items-center border border-[#2a2a1c] bg-[#f4eee2]/75">
                          <button type="button" aria-label="Reducir cantidad de asistentes" title="Reducir cantidad" onClick={() => setGuestCount((count) => Math.max(1, count - 1))} className="grid h-full w-8 place-items-center border-r border-[#2a2a1c]/25"><Minus size={14} /></button>
                          <span className="grid h-full w-8 place-items-center tabular-nums">{guestCount}</span>
                          <button type="button" aria-label="Aumentar cantidad de asistentes" title="Aumentar cantidad" onClick={() => setGuestCount((count) => Math.min(invitation.maxGuests, count + 1))} className="grid h-full w-8 place-items-center border-l border-[#2a2a1c]/25"><Plus size={14} /></button>
                        </div>
                      </div>
                    )}
                  </>
                )}

                {error && <p className="mt-3 text-[12px] font-bold text-[#7d3028]">{error}</p>}
                <button type="button" onClick={submitRsvp} disabled={isSubmitting} className="relative mt-4 h-[60px] w-full overflow-hidden text-[13px] font-bold uppercase tracking-[0.65px] text-[#f4eee2] disabled:opacity-60">
                  <img src="/figma/design/rsvp-confirm-button.svg" alt="" className="absolute inset-0 h-full w-full" />
                  <span className="relative">{isSubmitting ? 'Guardando...' : 'Confirmar asistencia'}</span>
                </button>
              </div>
            )}

          </div>
        </section>

        <section id="galeria" className="gallery-screen paper-texture relative isolate flex flex-col overflow-hidden px-5 pt-[26px] pb-5 text-[#2a2a1c]">
          <img src="/figma/design/gallery-texture.png" alt="" className="absolute inset-0 -z-10 h-full w-full object-cover opacity-50" />
          <header data-invitation-reveal className="text-center">
            <p className="font-script text-[30px] leading-normal text-[#8b9574] [text-shadow:0px_4px_4px_rgba(0,0,0,0.25)]">Galería</p>
            <p className="mt-[3px] text-[20px] font-bold uppercase leading-[28px]">Nuestros momentos</p>
          </header>
          <div className="mt-5 grid min-h-0 flex-1 grid-cols-2 grid-rows-3 gap-[10px]" aria-live="polite">
            {visibleGalleryPhotos.map((photo, index) => (
              <figure
                key={`${index}-${photo.src}`}
                ref={(element) => {
                  galleryCardsRef.current[index] = element;
                }}
                className={`gallery-card gallery-frame-${photo.frame} h-full will-change-transform`}
              >
                <img src={photo.src} alt={photo.alt} loading="lazy" className="h-full w-full object-cover" />
              </figure>
            ))}
          </div>
        </section>

      </div>
    </main>
  );
}
